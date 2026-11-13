import { BrowserWindow } from "electron";
import { getAppDatabase } from "../database";
import { favoriteKey, normalizePlaylistSnapshot, normalizeTrackSnapshot } from "../database/normalizers";
import type { PlaylistSnapshot, TrackSnapshot } from "../database/types";
import {
  getAccountSession,
  getDesktopDeviceClientId,
  getSyncChanges,
  pushSyncChanges,
  type SyncChange,
  type SyncPullResult,
} from "../system/systemClient";

const SYNC_SETTING_KEY = "sync-state";
const TYPE_FAVORITE_SONG = "favorite_song";
const TYPE_FAVORITE_PLAYLIST = "favorite_playlist";
const TYPE_USER_PLAYLIST = "user_playlist";
const TYPE_PLAYLIST_TRACK = "playlist_track";
const DUPLICATE_PULL_GUARD_MS = 1500;

type SyncState = {
  token: string;
  userId: string;
  seededAccountId: string;
  lastVersion: number;
  lastSyncAt: string;
  lastError: string;
};

type SyncOutboxRow = {
  op_id: string;
  item_type: string;
  item_key: string;
  action: "upsert" | "delete";
  payload_json: string;
  created_at: string;
};

type SyncRecordOptions = {
  schedule?: boolean;
};

let syncRunning = false;
let syncQueued = false;
let syncTimer: NodeJS.Timeout | null = null;
let syncInFlight: Promise<SyncState> | null = null;
let lastNetworkSyncAt = 0;
let lastNetworkSyncToken = "";
let lastNetworkSyncVersion = 0;
let syncGeneration = 0;

export function getSyncState(): SyncState {
  const saved = getAppDatabase().getSetting<Partial<SyncState> & Record<string, unknown>>(SYNC_SETTING_KEY)?.value ?? {};
  const account = getAccountSession();
  const userId = account.loggedIn ? account.user.id : "";
  const seededAccountId = saved.seededAccountId ?? "";
  const sameAccount = Boolean(userId && seededAccountId === userId);
  return {
    ...emptyState(),
    ...saved,
    token: account.loggedIn ? account.token : "",
    userId,
    seededAccountId,
    lastVersion: sameAccount ? (saved.lastVersion ?? 0) : 0,
    lastSyncAt: sameAccount ? saved.lastSyncAt ?? "" : "",
    lastError: sameAccount ? saved.lastError ?? "" : "",
  };
}

export function syncNow(): Promise<SyncState> {
  clearPendingSyncTimer();
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSyncNow().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function runSyncNow(): Promise<SyncState> {
  const generation = syncGeneration;
  syncRunning = true;
  try {
    let state = getSyncState();
    if (!state.token) return state;
    if (state.userId && state.seededAccountId !== state.userId) {
      getAppDatabase().clearSyncOutbox();
      seedInitialOutbox();
      saveSyncState({ ...state, seededAccountId: state.userId, lastVersion: 0, lastSyncAt: "", lastError: "" });
      state = getSyncState();
    }

    let nextVersion = state.lastVersion || 0;
    if (shouldSkipDuplicatePull(state, nextVersion)) {
      return state;
    }
    try {
      nextVersion = await pullRemoteChanges(state, generation);
      if (!isCurrentSync(state, generation)) return getSyncState();

      let pending = getAppDatabase().listSyncOutbox(200) as SyncOutboxRow[];
      const hadPending = pending.length > 0;
      let needsSnapshot = false;
      while (pending.length) {
        const pushed = await pushSyncChanges(
          state.token,
          pending.map((row) => ({
            opId: row.op_id,
            itemType: row.item_type,
            itemKey: row.item_key,
            action: row.action,
            payload: parsePayload(row.payload_json),
            clientUpdatedAt: row.created_at,
          }))
        );
        if (!isCurrentSync(state, generation)) return getSyncState();
        needsSnapshot ||= pushed.skipped > 0;
        getAppDatabase().removeSyncOps(pending.map((row) => row.op_id));
        pending = getAppDatabase().listSyncOutbox(200) as SyncOutboxRow[];
      }
      if (hadPending) {
        // 推送版本不是已拉取游标；再拉一次，避免跨过其他设备同时产生的变更。
        // skipped 可能是比起始游标更早的远端胜出，必须从快照恢复权威状态。
        nextVersion = await pullRemoteChanges(needsSnapshot ? { ...state, lastVersion: 0 } : state, generation);
      }

      if (!isCurrentSync(state, generation)) return getSyncState();

      saveSyncState({
        ...state,
        lastVersion: nextVersion,
        lastSyncAt: new Date().toISOString(),
        lastError: "",
      });
      recordNetworkSync(state.token, nextVersion);
      emitSyncChanged();
    } catch (error) {
      if (!isCurrentSync(state, generation)) return getSyncState();
      saveSyncState({
        ...state,
        lastError: error instanceof Error ? error.message : String(error),
      });
      emitSyncChanged();
    }
    return getSyncState();
  } finally {
    syncRunning = false;
    if (syncQueued) {
      syncQueued = false;
      requestSync(250);
    }
  }
}

export async function clearSyncState() {
  syncGeneration++;
  clearPendingSyncTimer();
  syncQueued = false;
  lastNetworkSyncAt = 0;
  lastNetworkSyncToken = "";
  lastNetworkSyncVersion = 0;
  getAppDatabase().clearSyncOutbox();
  getAppDatabase().deleteSetting(SYNC_SETTING_KEY);
  emitSyncChanged();
  return getSyncState();
}

export function startSyncOnStartup() {
  if (!getSyncState().token) return;
  requestSync(1500);
}

export function recordFavoriteSongChange(track: TrackSnapshot, action: "upsert" | "delete", options?: SyncRecordOptions) {
  const normalized = normalizeTrackSnapshot(track);
  if (normalized.source === "local") return;
  if (action === "upsert") {
    const saved = getAppDatabase().getFavoriteSong(normalized.source, normalized.id);
    normalized.favoritedAt = saved ? Date.parse(saved.createdAt) : normalized.favoritedAt ?? Date.now();
  }
  enqueueAndSync(TYPE_FAVORITE_SONG, favoriteKey(normalized.source, normalized.id), action, action === "delete" ? {} : syncSongPayload(normalized), options);
}

export function recordFavoriteSongDelete(source: string, id: string, options?: SyncRecordOptions) {
  if (source === "local") return;
  enqueueAndSync(TYPE_FAVORITE_SONG, favoriteKey(source, id), "delete", {}, options);
}

export function recordFavoritePlaylistChange(playlist: PlaylistSnapshot, action: "upsert" | "delete", options?: SyncRecordOptions) {
  const normalized = normalizePlaylistSnapshot(playlist);
  if (normalized.source === "local") return;
  enqueueAndSync(TYPE_FAVORITE_PLAYLIST, favoriteKey(normalized.source, normalized.id), action, action === "delete" ? {} : normalized, options);
}

export function recordFavoritePlaylistDelete(source: string, id: string, options?: SyncRecordOptions) {
  if (source === "local") return;
  enqueueAndSync(TYPE_FAVORITE_PLAYLIST, favoriteKey(source, id), "delete", {}, options);
}

export function recordUserPlaylistChange(playlist: PlaylistSnapshot, action: "upsert" | "delete", options?: SyncRecordOptions) {
  const normalized = clearLocalFileCover(normalizePlaylistSnapshot(playlist));
  if (normalized.source !== "local") return;
  enqueueAndSync(TYPE_USER_PLAYLIST, favoriteKey(normalized.source, normalized.id), action, action === "delete" ? {} : normalized, options);
}

export function recordUserPlaylistTrackChange(playlistId: string, track: TrackSnapshot, action: "upsert" | "delete", options?: SyncRecordOptions) {
  const normalized = normalizeTrackSnapshot(track);
  if (normalized.source === "local") return;
  enqueueAndSync(
    TYPE_PLAYLIST_TRACK,
    `${playlistId}|${favoriteKey(normalized.source, normalized.id)}`,
    action,
    action === "delete" ? {} : syncSongPayload(normalized),
    options
  );
}

function seedInitialOutbox() {
  const db = getAppDatabase();
  const seedOptions: SyncRecordOptions = { schedule: false };
  db.listFavoriteSongs().forEach((item) => recordFavoriteSongChange(item.payload, "upsert", seedOptions));
  db.listFavoritePlaylists().forEach((item) => recordFavoritePlaylistChange(item.payload, "upsert", seedOptions));
  db.listUserPlaylists("local").forEach((playlist) => {
    recordUserPlaylistChange(playlist.payload, "upsert", seedOptions);
    db.listUserPlaylistTracks(playlist.playlistId).forEach((track) => {
      recordUserPlaylistTrackChange(playlist.playlistId, track.payload, "upsert", seedOptions);
    });
  });
}

function isCurrentSync(state: SyncState, generation: number) {
  const current = getSyncState();
  return generation === syncGeneration && current.userId === state.userId && current.token === state.token;
}

async function pullRemoteChanges(state: SyncState, generation: number): Promise<number> {
  let since = state.lastVersion;
  let snapshot: SyncChange[] = [];
  let page: { snapshotVersion: number; cursor: string } | undefined;
  let restarts = 0;
  while (true) {
    let result: SyncPullResult;
    try {
      result = await getSyncChanges(state.token, page ? 0 : since, page);
    } catch (error) {
      if (page && (error as { code?: number })?.code === 409 && restarts++ < 3) {
        snapshot = [];
        page = undefined;
        since = 0;
        continue;
      }
      throw error;
    }
    if (!isCurrentSync(state, generation)) return state.lastVersion;
    if (result.mode === "snapshot") {
      const version = result.snapshotVersion ?? result.version;
      if (page && version !== page.snapshotVersion) throw new Error("同步快照版本不一致，请重试");
      snapshot.push(...(result.items ?? result.changes));
      if (result.hasMore) {
        if (!result.cursor || result.cursor === page?.cursor) throw new Error("同步快照分页未前进");
        page = { snapshotVersion: version, cursor: result.cursor };
        continue;
      }
      getAppDatabase().applySyncTransaction(() => reconcileSnapshot(snapshot));
      return version;
    }
    if (page) throw new Error("同步快照分页模式已改变，请重试");
    getAppDatabase().applySyncTransaction(() => {
      const pending = pendingSyncKeys();
      result.changes.forEach((change) => {
        if (change.deviceId !== getDesktopDeviceClientId() && !hasPendingChange(change, pending)) applyRemoteChange(change);
      });
    });
    // 旧服务端没有 mode/hasMore；继续拉到空页，绝不使用全局 version 跳过日志。
    const next = Math.max(since, ...result.changes.map((change) => change.version));
    if (!result.changes.length) {
      if (result.hasMore) throw new Error("同步增量分页未前进");
      return since;
    }
    if (next <= since) throw new Error("同步增量游标未前进");
    since = next;
    if (result.hasMore === false) return since;
  }
}

function syncItemKey(type: string, key: string) {
  return JSON.stringify([type, key]);
}

function pendingSyncKeys() {
  const keys = new Set<string>();
  getAppDatabase().listPendingSyncKeys().forEach((row) => {
    keys.add(syncItemKey(row.item_type, row.item_key));
    // 歌单删除会级联删除曲目；未推送曲目同时保护父歌单。
    if (row.item_type === TYPE_PLAYLIST_TRACK) {
      const parsed = playlistTrackFromKey(row.item_key);
      if (parsed) keys.add(syncItemKey(`${TYPE_USER_PLAYLIST}:pending_children`, `local:${parsed.playlistId}`));
    }
  });
  return keys;
}

function hasPendingChange(change: Pick<SyncChange, "itemType" | "itemKey" | "action">, pending: Set<string>) {
  if (pending.has(syncItemKey(change.itemType, change.itemKey))) return true;
  if (change.itemType === TYPE_USER_PLAYLIST && change.action === "delete") {
    return pending.has(syncItemKey(`${TYPE_USER_PLAYLIST}:pending_children`, change.itemKey));
  }
  if (change.itemType === TYPE_PLAYLIST_TRACK) {
    const parsed = playlistTrackFromKey(change.itemKey);
    return Boolean(parsed && pending.has(syncItemKey(TYPE_USER_PLAYLIST, `local:${parsed.playlistId}`)));
  }
  return false;
}

function reconcileSnapshot(items: SyncChange[]) {
  const db = getAppDatabase();
  const pending = pendingSyncKeys();
  const remoteKeys = new Set(items.map((item) => syncItemKey(item.itemType, item.itemKey)));
  const removeMissing = (itemType: string, itemKey: string, remove: () => void) => {
    if (!remoteKeys.has(syncItemKey(itemType, itemKey)) && !hasPendingChange({ itemType, itemKey, action: "delete" }, pending)) remove();
  };
  // 只有完整快照才能删本地缺失项，快照不跳过同设备条目。
  items.filter((item) => item.itemType === TYPE_USER_PLAYLIST).forEach((item) => {
    if (!hasPendingChange(item, pending)) applyRemoteChange(item);
  });
  items.filter((item) => item.itemType !== TYPE_USER_PLAYLIST).forEach((item) => {
    if (!hasPendingChange(item, pending)) applyRemoteChange(item);
  });
  db.listFavoriteSongs().filter((item) => item.source !== "local").forEach((item) => {
    removeMissing(TYPE_FAVORITE_SONG, item.favoriteKey, () => db.removeFavoriteSong(item.source, item.trackId));
  });
  db.listFavoritePlaylists().filter((item) => item.source !== "local").forEach((item) => {
    removeMissing(TYPE_FAVORITE_PLAYLIST, item.favoriteKey, () => db.removeFavoritePlaylist(item.source, item.playlistId));
  });
  db.listUserPlaylists("local").forEach((playlist) => {
    db.listUserPlaylistTracks(playlist.playlistId).filter((track) => track.source !== "local").forEach((track) => {
      removeMissing(TYPE_PLAYLIST_TRACK, `${playlist.playlistId}|${track.trackKey}`, () => db.removeUserPlaylistTrack(playlist.playlistId, track.source, track.trackId));
    });
    removeMissing(TYPE_USER_PLAYLIST, playlist.playlistKey, () => db.removeUserPlaylist(playlist.source, playlist.playlistId));
  });
}

function applyRemoteChange(change: SyncChange) {
  switch (change.itemType) {
    case TYPE_FAVORITE_SONG:
      applyFavoriteSong(change);
      break;
    case TYPE_FAVORITE_PLAYLIST:
      applyFavoritePlaylist(change);
      break;
    case TYPE_USER_PLAYLIST:
      applyUserPlaylist(change);
      break;
    case TYPE_PLAYLIST_TRACK:
      applyPlaylistTrack(change);
      break;
  }
}

function applyFavoriteSong(change: SyncChange) {
  const parsed = songFromPayloadOrKey(change.payload, change.itemKey);
  if (!parsed || parsed.source === "local") return;
  if (change.action === "delete") {
    getAppDatabase().removeFavoriteSong(parsed.source, parsed.id);
  } else {
    getAppDatabase().addFavoriteSong(parsed, true);
  }
}

function applyFavoritePlaylist(change: SyncChange) {
  const parsed = playlistFromPayloadOrKey(change.payload, change.itemKey);
  if (!parsed || parsed.source === "local") return;
  if (change.action === "delete") {
    getAppDatabase().removeFavoritePlaylist(parsed.source, parsed.id);
  } else {
    getAppDatabase().addFavoritePlaylist(parsed);
  }
}

function applyUserPlaylist(change: SyncChange) {
  const parsed = playlistFromPayloadOrKey(change.payload, change.itemKey);
  if (!parsed || parsed.source !== "local") return;
  if (change.action === "delete") {
    getAppDatabase().removeUserPlaylist(parsed.source, parsed.id);
  } else {
    getAppDatabase().upsertUserPlaylist(clearLocalFileCover(parsed));
  }
}

function applyPlaylistTrack(change: SyncChange) {
  const parsed = playlistTrackFromKey(change.itemKey);
  if (!parsed) return;
  const song = songFromPayloadOrKey(change.payload, parsed.trackKey);
  if (!song || song.source === "local") return;
  if (change.action === "delete") {
    getAppDatabase().removeUserPlaylistTrack(parsed.playlistId, song.source, song.id);
  } else {
    getAppDatabase().addUserPlaylistTrack(parsed.playlistId, song);
  }
}

function enqueueAndSync(itemType: string, itemKey: string, action: "upsert" | "delete", payload: unknown, options?: SyncRecordOptions) {
  if (!getSyncState().token) return;
  getAppDatabase().enqueueSyncOp({ itemType, itemKey, action, payload });
  if (options?.schedule === false) return;
  requestSync(500);
}

function requestSync(delayMs = 500) {
  if (!getSyncState().token) return;
  if (syncRunning || syncInFlight) {
    syncQueued = true;
    return;
  }
  if (syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncNow();
  }, delayMs);
}

function clearPendingSyncTimer() {
  if (!syncTimer) return;
  clearTimeout(syncTimer);
  syncTimer = null;
}

function shouldSkipDuplicatePull(state: SyncState, nextVersion: number) {
  if (getAppDatabase().listSyncOutbox(1).length > 0) return false;
  if (state.token !== lastNetworkSyncToken) return false;
  if (nextVersion !== lastNetworkSyncVersion) return false;
  return Date.now() - lastNetworkSyncAt < DUPLICATE_PULL_GUARD_MS;
}

function recordNetworkSync(token: string, version: number) {
  lastNetworkSyncAt = Date.now();
  lastNetworkSyncToken = token;
  lastNetworkSyncVersion = version;
}

function saveSyncState(state: SyncState) {
  getAppDatabase().setSetting(
    SYNC_SETTING_KEY,
    {
      lastVersion: state.lastVersion,
      lastSyncAt: state.lastSyncAt,
      lastError: state.lastError,
      seededAccountId: state.seededAccountId,
    },
    1
  );
}

function emptyState(): SyncState {
  return {
    token: "",
    userId: "",
    seededAccountId: "",
    lastVersion: 0,
    lastSyncAt: "",
    lastError: "",
  };
}

function parsePayload(raw: string) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function songFromPayloadOrKey(payload: unknown, key: string): TrackSnapshot | null {
  try {
    if (payload && typeof payload === "object" && "id" in payload) {
      return normalizeTrackSnapshot(payload as Record<string, unknown>);
    }
  } catch {
    // fallback to key below
  }
  const parts = key.split(":");
  if (parts.length < 2 || !parts[1]) return null;
  return normalizeTrackSnapshot({
    source: parts[0],
    id: parts.slice(1).join(":"),
    urlParam: parts.slice(1).join(":"),
    name: "",
    singer: "",
  });
}

function playlistFromPayloadOrKey(payload: unknown, key: string): PlaylistSnapshot | null {
  try {
    if (payload && typeof payload === "object" && "id" in payload) {
      return normalizePlaylistSnapshot(payload as Record<string, unknown>);
    }
  } catch {
    // fallback to key below
  }
  const parts = key.split(":");
  if (parts.length < 2 || !parts[1]) return null;
  return normalizePlaylistSnapshot({
    source: parts[0],
    id: parts.slice(1).join(":"),
    name: "",
    desc: "",
    cover: "",
    tags: [],
  });
}

function playlistTrackFromKey(key: string) {
  const [playlistId, ...rest] = key.split("|");
  const trackKey = rest.join("|");
  if (!playlistId || !trackKey) return null;
  return { playlistId, trackKey };
}

function syncSongPayload(track: TrackSnapshot): TrackSnapshot {
  const { filePath, url, lyric, krc, ...rest } = track as TrackSnapshot & {
    url?: string;
  };
  return rest;
}

function clearLocalFileCover(playlist: PlaylistSnapshot): PlaylistSnapshot {
  if (playlist.source !== "local") return playlist;
  const cover = playlist.cover.trim().toLowerCase();
  if (cover.startsWith("http://") || cover.startsWith("https://")) return playlist;
  if (!cover.startsWith("file:") && !cover.includes("\\") && !cover.includes("/covers/playlists/")) {
    return playlist;
  }
  return { ...playlist, cover: "" };
}

function emitSyncChanged() {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("sync:changed", getSyncState());
    win.webContents.send("favorites:changed");
    win.webContents.send("mine-library:changed");
  });
}
