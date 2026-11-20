import { notePlaylistUserEdit } from "../playlistCover/coverState";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { normalizeLimit } from "./json";
import { favoriteKey, normalizePlaylistSnapshot, normalizeTrackSnapshot } from "./normalizers";
import { LocalTrackIdentityRepository } from "./localTrackIdentityRepository";
import { SyncStateStore } from "./syncStateStore";
import { captureLibraryScope, onlineCover, publicPlaylist, publicTrack, validateSortOrder } from "./accountLibraryPolicy";
import type { LibraryItemType, LibraryScope, LibraryWriteOptions, SyncOperationInput, TrackWriteOptions } from "./accountLibraryPolicy";
import type { FavoriteSongItem, FavoritePlaylistItem, PlaylistSnapshot, PlaylistSource, TrackSnapshot, UserPlaylistItem, UserPlaylistTrackItem } from "./types";

type ItemRow = { item_key: string; payload_json: string; created_at: string; updated_at: string };
type TrackRow = { track_key: string; payload_json: string; sort_order: number | null; fallback_order: number; server_version: number; created_at: string };
export type ScopedPlaylistTrack = UserPlaylistTrackItem & { sortOrder: number | null; serverVersion: number };

/** 每个实例固定捕获一次 main 上下文；禁止在异步回调中重新读取当前登录用户。 */
export class AccountLibraryRepository {
  private readonly db: DatabaseSync;
  readonly scope: LibraryScope;
  readonly identities: LocalTrackIdentityRepository;
  readonly syncState: SyncStateStore;
  constructor(db: DatabaseSync, scope: LibraryScope) {
    this.db = db;
    this.scope = captureLibraryScope(scope);
    this.identities = new LocalTrackIdentityRepository(db);
    this.syncState = new SyncStateStore(db);
  }
  private transaction<T>(work: () => T): T {
    // SAVEPOINT 同时兼容独立调用和 sync 外层事务；不提前发布通知。
    const savepoint = `library_${randomUUID().replaceAll("-", "")}`;
    this.db.exec(`SAVEPOINT ${savepoint}`);
    try { const result = work(); this.db.exec(`RELEASE ${savepoint}`); return result; }
    catch (error) { this.db.exec(`ROLLBACK TO ${savepoint}`); this.db.exec(`RELEASE ${savepoint}`); throw error; }
  }
  private rows(type: LibraryItemType): ItemRow[] {
    return this.db.prepare("SELECT * FROM account_library_items WHERE account_id = ? AND item_type = ? ORDER BY updated_at DESC,item_key")
      .all(this.scope.accountId, type) as ItemRow[];
  }
  private row(type: LibraryItemType, key: string): ItemRow | undefined {
    return this.db.prepare("SELECT * FROM account_library_items WHERE account_id = ? AND item_type = ? AND item_key = ?")
      .get(this.scope.accountId, type, key) as ItemRow | undefined;
  }
  private save(type: LibraryItemType, key: string, payload: unknown, createdAt?: string, updatedAt?: string) {
    const now = updatedAt ?? new Date().toISOString();
    const previous = this.row(type, key);
    this.db.prepare(`INSERT INTO account_library_items VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id,item_type,item_key) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at`)
      .run(this.scope.accountId, type, key, JSON.stringify(payload), previous?.created_at ?? createdAt ?? now, now);
  }
  private event(input: SyncOperationInput, options: LibraryWriteOptions) {
    if (!options.fromSync && input.itemType === "user_playlist" && input.itemKey.startsWith("local:") && input.action === "upsert") {
      notePlaylistUserEdit(this.db, this.scope.accountId, input.itemKey.slice("local:".length), input.payload as PlaylistSnapshot, options.clientUpdatedAt ?? new Date().toISOString());
    }
    if (!options.fromSync && this.scope.accountId) this.enqueueSyncOp({ ...input, clientUpdatedAt: options.clientUpdatedAt });
  }
  enqueueSyncOp(input: SyncOperationInput): string | null {
    if (!input.itemType || !input.itemKey) return null;
    return this.transaction(() => {
      const previous = this.db.prepare(`SELECT action,payload_json FROM sync_outbox
        WHERE account_id = ? AND item_type = ? AND item_key = ? ORDER BY id DESC LIMIT 1`)
        .get(this.scope.accountId, input.itemType, input.itemKey) as { action: string; payload_json: string } | undefined;
      let payload = input.action === "delete" ? {} : input.payload ?? {};
      if (input.action === "upsert" && previous?.action === "upsert" && payload && typeof payload === "object" && !Array.isArray(payload)) {
        const merged = { ...payload } as Record<string, unknown>;
        const old = JSON.parse(previous.payload_json) as Record<string, unknown>;
        const fields = input.itemType === "playlist_track" ? ["sortOrder"] : input.itemType === "user_playlist" ? ["coverResource", "coverPreset"] : [];
        for (const field of fields) if (merged[field] === undefined && Object.prototype.hasOwnProperty.call(old, field)) merged[field] = old[field];
        payload = merged;
      }
      // 新 opId 保护已在途旧请求的 ACK：它只能清理旧 ID，不能删掉本次更新；同时保留操作日志历史。
      this.syncState.markOpHistoryCoalesced(this.scope.accountId, input.itemType, input.itemKey);
      this.db.prepare("DELETE FROM sync_outbox WHERE account_id = ? AND item_type = ? AND item_key = ?")
        .run(this.scope.accountId, input.itemType, input.itemKey);
      const opId = randomUUID();
      const baseVersion = this.scope.accountId
        ? this.syncState.readBaseVersion(this.scope.accountId, input.itemType, input.itemKey)
        : 0;
      const clientUpdatedAt = input.useHlc !== false && this.scope.accountId
        ? this.syncState.nextLocalOperationClock(this.scope.accountId)
        : (input.clientUpdatedAt ?? new Date().toISOString());
      this.db.prepare("INSERT INTO sync_outbox (account_id,op_id,item_type,item_key,action,payload_json,created_at,base_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(this.scope.accountId, opId, input.itemType, input.itemKey, input.action, JSON.stringify(payload), clientUpdatedAt, baseVersion);
      if (this.scope.accountId) {
        this.syncState.appendOpHistory({
          accountId: this.scope.accountId,
          opId,
          itemType: input.itemType,
          itemKey: input.itemKey,
          action: input.action,
          baseVersion,
          clientUpdatedAt,
          status: "pending",
          detail: input.useHlc === false ? "seed" : "",
        });
      }
      return opId;
    });
  }
  listSyncOutbox(limit = 200) {
    return this.db.prepare("SELECT op_id,item_type,item_key,action,payload_json,created_at,account_id,base_version FROM sync_outbox WHERE account_id = ? ORDER BY created_at,id LIMIT ?")
      .all(this.scope.accountId, normalizeLimit(limit));
  }
  listPendingSyncKeys(): { item_type: string; item_key: string }[] {
    return this.db.prepare("SELECT DISTINCT item_type,item_key FROM sync_outbox WHERE account_id = ?").all(this.scope.accountId) as { item_type: string; item_key: string }[];
  }
  removeSyncOps(opIds: string[]) {
    return this.transaction(() => {
      const remove = this.db.prepare("DELETE FROM sync_outbox WHERE account_id = ? AND op_id = ?");
      opIds.forEach(id => remove.run(this.scope.accountId, id));
    });
  }
  clearSyncOutbox() { this.db.prepare("DELETE FROM sync_outbox WHERE account_id = ?").run(this.scope.accountId); }
  /** 下行逻辑 ID 在来源设备映射回原播放键；异机保持占位 ID，绝不推测文件。 */
  resolveIncomingTrack(input: TrackSnapshot): TrackSnapshot {
    const track = normalizeTrackSnapshot(input);
    if (track.source !== "local") return track;
    const mapping = this.identities.findBySyncId(track.id);
    if (!mapping) return track;
    const key = mapping.local_song_key;
    return { ...track, id: key.startsWith("local:") ? key.slice(6) : key };
  }
  private syncTrackId(track: TrackSnapshot): string {
    if (track.source !== "local") return track.id;
    // 远端占位沿用协议 ID，不能再映射成新曲目。
    if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(track.id)) return track.id;
    return this.identities.ensure(favoriteKey(track.source, track.id), this.scope.deviceIdentity).sync_track_id;
  }
  private trackEvent(track: TrackSnapshot) { return publicTrack(track, this.syncTrackId(track)); }
  listFavoriteSongs(): FavoriteSongItem[] {
    return this.rows("favorite_song").map(row => {
      const payload = normalizeTrackSnapshot(JSON.parse(row.payload_json));
      payload.favoritedAt = Date.parse(row.created_at);
      return { favoriteKey: row.item_key, trackId: payload.id, source: payload.source, title: payload.name ?? "", artist: payload.singer ?? "",
        album: payload.album ?? "", artwork: payload.cover ?? "", duration: payload.duration ?? 0, payload, createdAt: row.created_at };
    });
  }
  addFavoriteSong(input: TrackSnapshot, fromSync = false) {
    return this.transaction(() => {
      const track = fromSync ? this.resolveIncomingTrack(input) : normalizeTrackSnapshot(input);
      const key = favoriteKey(track.source, track.id);
      const row = this.row("favorite_song", key);
      const createdAt = row?.created_at ?? (track.favoritedAt ? new Date(track.favoritedAt).toISOString() : new Date().toISOString());
      track.favoritedAt = Date.parse(createdAt);
      this.save("favorite_song", key, track, createdAt);
      // created_at 是关系字段，下行可显式更新本账号收藏时间。
      if (fromSync && input.favoritedAt) this.db.prepare("UPDATE account_library_items SET created_at = ? WHERE account_id = ? AND item_type = 'favorite_song' AND item_key = ?")
        .run(new Date(input.favoritedAt).toISOString(), this.scope.accountId, key);
      if (this.scope.accountId && !fromSync && track.source !== "local") {
        const payload = this.trackEvent(track);
        this.event({ itemType: "favorite_song", itemKey: `${payload.source}:${payload.id}`, action: "upsert", payload }, { fromSync });
      }
      return this.listFavoriteSongs().find(item => item.favoriteKey === key)!;
    });
  }
  containsFavoriteSong(source: string, id: string) { return Boolean(this.row("favorite_song", favoriteKey(source, id))); }
  ensureFavoriteSong(track: TrackSnapshot): boolean {
    return this.transaction(() => {
      const normalized = normalizeTrackSnapshot(track);
      if (this.containsFavoriteSong(normalized.source, normalized.id)) return false;
      this.addFavoriteSong(normalized);
      return true;
    });
  }
  toggleFavoriteSong(track: TrackSnapshot) {
    return this.transaction(() => {
      if (this.containsFavoriteSong(track.source, track.id)) { this.removeFavoriteSong(track.source, track.id); return { collected: false, item: null }; }
      return { collected: true, item: this.addFavoriteSong(track) };
    });
  }
  private removeItem(type: LibraryItemType, key: string, options: LibraryWriteOptions = {}) {
    const result = this.db.prepare("DELETE FROM account_library_items WHERE account_id = ? AND item_type = ? AND item_key = ?")
      .run(this.scope.accountId, type, key);
    if (Number(result.changes)) this.event({ itemType: type, itemKey: key, action: "delete" }, options);
    return Number(result.changes) > 0;
  }
  removeFavoriteSong(source: string, id: string, options: LibraryWriteOptions = {}) {
    return this.transaction(() => {
      const key = favoriteKey(source, id);
      const row = this.row("favorite_song", key);
      if (!row) return false;
      const removed = this.removeItem("favorite_song", key, { fromSync: true });
      if (this.scope.accountId && !options.fromSync && source !== "local") {
        const track = normalizeTrackSnapshot(JSON.parse(row.payload_json));
        this.event({ itemType: "favorite_song", itemKey: `${track.source}:${this.syncTrackId(track)}`, action: "delete" }, options);
      }
      return removed;
    });
  }
  private playlistItem(row: ItemRow): UserPlaylistItem {
    const payload = normalizePlaylistSnapshot(JSON.parse(row.payload_json));
    return { playlistKey: row.item_key, playlistId: payload.id, source: payload.source, name: payload.name, description: payload.desc,
      artwork: payload.cover, songCount: String(payload.song_count ?? ""), playCount: String(payload.play_count ?? ""),
      collectCount: String(payload.collect_count ?? ""), payload, createdAt: row.created_at, updatedAt: row.updated_at };
  }
  listFavoritePlaylists(): FavoritePlaylistItem[] { return this.rows("favorite_playlist").map(row => ({ ...this.playlistItem(row), favoriteKey: row.item_key })); }
  containsFavoritePlaylist(source: string, id: string) { return Boolean(this.row("favorite_playlist", favoriteKey(source, id))); }
  addFavoritePlaylist(input: PlaylistSnapshot, options: LibraryWriteOptions = {}) {
    return this.transaction(() => {
      const key = favoriteKey(input.source, input.id);
      const previous = this.row("favorite_playlist", key);
      const playlist = normalizePlaylistSnapshot({ ...(previous ? JSON.parse(previous.payload_json) : {}), ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) });
      this.save("favorite_playlist", key, playlist);
      this.event({ itemType: "favorite_playlist", itemKey: key, action: "upsert", payload: publicPlaylist(playlist) }, options);
      return this.listFavoritePlaylists().find(item => item.favoriteKey === key)!;
    });
  }
  removeFavoritePlaylist(source: string, id: string, options: LibraryWriteOptions = {}) {
    return this.transaction(() => this.removeItem("favorite_playlist", favoriteKey(source, id), options));
  }
  toggleFavoritePlaylist(playlist: PlaylistSnapshot) {
    return this.transaction(() => {
      if (this.containsFavoritePlaylist(playlist.source, playlist.id)) { this.removeFavoritePlaylist(playlist.source, playlist.id); return { collected: false, item: null }; }
      return { collected: true, item: this.addFavoritePlaylist(playlist) };
    });
  }
  listUserPlaylists(source?: PlaylistSource | "all"): UserPlaylistItem[] {
    return this.rows("user_playlist").map(row => this.playlistItem(row)).filter(item => !source || source === "all" || item.source === source);
  }
  upsertUserPlaylist(input: PlaylistSnapshot, options: LibraryWriteOptions = {}) {
    return this.transaction(() => {
      const key = favoriteKey(input.source, input.id);
      const previous = this.row("user_playlist", key);
      const playlist = normalizePlaylistSnapshot({ ...(previous ? JSON.parse(previous.payload_json) : {}), ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) });
      const updatedAt = options.clientUpdatedAt ?? new Date().toISOString();
      this.save("user_playlist", key, playlist, undefined, updatedAt);
      this.event({ itemType: "user_playlist", itemKey: favoriteKey(playlist.source, playlist.id), action: "upsert", payload: publicPlaylist(playlist) }, { ...options, clientUpdatedAt: updatedAt });
      return this.playlistItem(this.row("user_playlist", key)!);
    });
  }
  createUserPlaylist(input: Partial<PlaylistSnapshot>, tracks: TrackSnapshot[] = []) {
    return this.transaction(() => {
      const playlist = normalizePlaylistSnapshot({ ...input, id: input.id || randomUUID(), source: "local", song_count: 0 });
      if (this.row("user_playlist", favoriteKey("local", playlist.id))) throw new Error("歌单已存在");
      this.upsertUserPlaylist(playlist);
      const result = this.addUserPlaylistTracks(playlist.id, tracks);
      return { playlist: this.getLocalPlaylist(playlist.id), ...result };
    });
  }
  updateUserPlaylist(id: string, patch: Partial<Omit<PlaylistSnapshot, "id" | "source">>, options: LibraryWriteOptions = {}) {
    return this.transaction(() => this.upsertUserPlaylist({ ...this.getLocalPlaylist(id).payload, ...patch, id, source: "local" }, options));
  }
  private getLocalPlaylist(id: string) {
    const row = this.row("user_playlist", favoriteKey("local", id));
    if (!row) throw new Error("当前账号不存在此自建歌单");
    return this.playlistItem(row);
  }
  replaceUserPlaylists(source: Exclude<PlaylistSource, "local">, playlists: PlaylistSnapshot[]) {
    return this.transaction(() => {
      this.listUserPlaylists(source).forEach(item => this.removeItem("user_playlist", item.playlistKey, { fromSync: true }));
      playlists.forEach(item => this.upsertUserPlaylist({ ...item, source }, { fromSync: true }));
      return this.listUserPlaylists(source);
    });
  }
  listUserPlaylistTracks(playlistId: string): ScopedPlaylistTrack[] {
    const rows = this.db.prepare(`SELECT * FROM account_playlist_tracks WHERE account_id = ? AND playlist_id = ?
      ORDER BY COALESCE(sort_order,fallback_order),server_version,track_key`).all(this.scope.accountId, playlistId) as TrackRow[];
    return rows.map(row => {
      const payload = normalizeTrackSnapshot(JSON.parse(row.payload_json));
      return { playlistId, trackKey: row.track_key, trackId: payload.id, source: payload.source, title: payload.name ?? "", artist: payload.singer ?? "",
        album: payload.album ?? "", artwork: payload.cover ?? "", duration: payload.duration ?? 0, payload, createdAt: row.created_at,
        sortOrder: row.sort_order, serverVersion: row.server_version };
    });
  }
  addUserPlaylistTracks(playlistId: string, tracks: TrackSnapshot[], options: TrackWriteOptions = {}) {
    return this.transaction(() => {
      this.getLocalPlaylist(playlistId);
      validateSortOrder(options.sortOrder);
      if (options.serverVersion !== undefined && (!Number.isSafeInteger(options.serverVersion) || options.serverVersion < 0)) throw new Error("非法服务端版本");
      const added: string[] = [], existing: string[] = [];
      let lastCover: string | undefined;
      const maximum = this.db.prepare("SELECT MAX(COALESCE(sort_order,fallback_order)) AS maximum FROM account_playlist_tracks WHERE account_id = ? AND playlist_id = ?")
        .get(this.scope.accountId, playlistId) as { maximum: number | null };
      let order = (maximum.maximum ?? -1) + 1;
      for (const raw of tracks) {
        const track = options.fromSync ? this.resolveIncomingTrack(raw) : normalizeTrackSnapshot(raw), key = favoriteKey(track.source, track.id);
        const previous = this.db.prepare("SELECT * FROM account_playlist_tracks WHERE account_id = ? AND playlist_id = ? AND track_key = ?")
          .get(this.scope.accountId, playlistId, key) as TrackRow | undefined;
        if (previous) {
          existing.push(key);
          if (options.fromSync) this.db.prepare(`UPDATE account_playlist_tracks SET payload_json = ?,sort_order = ?,server_version = ?
            WHERE account_id = ? AND playlist_id = ? AND track_key = ?`)
            .run(JSON.stringify(track), options.sortOrder === undefined ? previous.sort_order : options.sortOrder,
              options.serverVersion ?? previous.server_version, this.scope.accountId, playlistId, key);
          continue;
        }
        const sortOrder = options.sortOrder === undefined ? (options.fromSync ? null : order) : options.sortOrder;
        this.db.prepare("INSERT INTO account_playlist_tracks VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(this.scope.accountId, playlistId, key, JSON.stringify(track), sortOrder, options.fromSync ? options.serverVersion ?? order++ : order++, options.serverVersion ?? 0, new Date().toISOString());
        added.push(key);
        // 只看最后一首真正新增歌曲；LOCAL/无图保留原封面，不向前寻找。
        lastCover = onlineCover(track) ? track.cover : undefined;
        if (this.scope.accountId && !options.fromSync) {
          const payload: Record<string, unknown> = { ...this.trackEvent(track), sortOrder };
          this.event({ itemType: "playlist_track", itemKey: `${playlistId}|${payload.source}:${payload.id}`, action: "upsert", payload }, options);
        }
      }
      if (added.length) {
        const patch: Partial<PlaylistSnapshot> = { song_count: this.listUserPlaylistTracks(playlistId).length };
        if (lastCover && !options.fromSync) Object.assign(patch, { cover: lastCover, coverResource: null, coverPreset: null });
        this.updateUserPlaylist(playlistId, patch, options);
      }
      return { added, existing, tracks: this.listUserPlaylistTracks(playlistId) };
    });
  }
  addUserPlaylistTrack(playlistId: string, track: TrackSnapshot, options: TrackWriteOptions = {}) { return this.addUserPlaylistTracks(playlistId, [track], options).tracks; }
  removeUserPlaylistTracks(playlistId: string, keys: { source: string; id: string }[], options: LibraryWriteOptions = {}) {
    return this.transaction(() => {
      this.getLocalPlaylist(playlistId);
      const removed: string[] = [];
      for (const identity of keys) {
        const key = favoriteKey(identity.source, identity.id);
        const previous = this.listUserPlaylistTracks(playlistId).find(item => item.trackKey === key);
        if (!previous) continue;
        this.db.prepare("DELETE FROM account_playlist_tracks WHERE account_id = ? AND playlist_id = ? AND track_key = ?")
          .run(this.scope.accountId, playlistId, key);
        removed.push(key);
        if (this.scope.accountId && !options.fromSync) {
          this.event({ itemType: "playlist_track", itemKey: `${playlistId}|${previous.source}:${this.syncTrackId(previous.payload)}`, action: "delete" }, options);
        }
      }
      if (removed.length) this.updateUserPlaylist(playlistId, { song_count: this.listUserPlaylistTracks(playlistId).length }, options);
      return { removed, tracks: this.listUserPlaylistTracks(playlistId) };
    });
  }
  removeUserPlaylistTrack(playlistId: string, source: string, id: string, options: LibraryWriteOptions = {}) { return this.removeUserPlaylistTracks(playlistId, [{ source, id }], options).removed.length > 0; }
  removeUserPlaylist(source: string, id: string, options: LibraryWriteOptions = {}) {
    return this.transaction(() => {
      if (!this.row("user_playlist", favoriteKey(source, id))) return false;
      // 每个子关系产生独立 delete，不依赖父墓碑隐式清理。
      if (this.scope.accountId && !options.fromSync) for (const track of this.listUserPlaylistTracks(id)) {
        this.event({ itemType: "playlist_track", itemKey: `${id}|${track.source}:${this.syncTrackId(track.payload)}`, action: "delete" }, options);
      }
      this.db.prepare("DELETE FROM account_playlist_tracks WHERE account_id = ? AND playlist_id = ?").run(this.scope.accountId, id);
      const removed = this.removeItem("user_playlist", favoriteKey(source, id), { fromSync: true });
      this.event({ itemType: "user_playlist", itemKey: favoriteKey(source, id), action: "delete" }, options);
      return removed;
    });
  }
  /** 仅在用户确认后调用；原未关联行保留，重复收藏不覆盖本账号关系时间。 */
  importUnassociated(prepareTrack: (track: TrackSnapshot) => TrackSnapshot = track => track) {
    if (!this.scope.accountId) throw new Error("导入需要明确账号");
    return this.transaction(() => {
      const unassociated = new AccountLibraryRepository(this.db, { accountId: "", deviceIdentity: this.scope.deviceIdentity });
      let songs = 0, favorites = 0;
      const playlists: { originalId: string; importedId: string }[] = [];
      for (const item of unassociated.listFavoriteSongs()) if (!this.containsFavoriteSong(item.source, item.trackId)) {
        this.addFavoriteSong(prepareTrack(item.payload)); songs++;
      }
      for (const item of unassociated.listFavoritePlaylists()) if (!this.containsFavoritePlaylist(item.source, item.playlistId)) {
        this.save("favorite_playlist", item.favoriteKey, item.payload, item.createdAt);
        this.event({ itemType: "favorite_playlist", itemKey: item.favoriteKey, action: "upsert", payload: publicPlaylist(item.payload) }, {});
        favorites++;
      }
      for (const item of unassociated.listUserPlaylists("local")) {
        const created = this.createUserPlaylist({ ...item.payload, id: randomUUID() }, unassociated.listUserPlaylistTracks(item.playlistId).map(track => prepareTrack(track.payload)));
        this.updateUserPlaylist(created.playlist.playlistId, { name: item.payload.name, desc: item.payload.desc, tags: item.payload.tags, cover: item.payload.cover, coverResource: item.payload.coverResource, coverPreset: item.payload.coverPreset });
        playlists.push({ originalId: item.playlistId, importedId: created.playlist.playlistId });
      }
      return { songs, favorites, playlists };
    });
  }
}
