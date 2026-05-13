import { DatabaseSync } from "node:sqlite";

export type SettingRecord<T = unknown> = {
  key: string;
  value: T;
  version: number;
  updatedAt: string;
};

export type TrackSnapshot = {
  id: string;
  source: "kg" | "wy" | "kw" | string;
  name?: string;
  singer?: string;
  album?: string;
  cover?: string;
  duration?: number;
  [key: string]: unknown;
};

export type SearchHistoryItem = {
  id: number;
  keyword: string;
  source: string | null;
  createdAt: string;
};

export type PlayHistoryItem = {
  id: number;
  trackId: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload: TrackSnapshot;
  playedAt: string;
};

export type QueueSnapshot = {
  currentIndex: number;
  queue: TrackSnapshot[];
  updatedAt: string;
};

export type PlaylistSource = "kg" | "wy" | "kw" | "qq";

export type PlaylistSnapshot = {
  id: string;
  source: PlaylistSource;
  name: string;
  desc: string;
  cover: string;
  coverSize?: {
    s: string;
    m: string;
    l: string;
    xl: string;
  };
  tags: {
    name: string;
    id: string;
  }[];
  song_count?: number | string;
  play_count?: number | string;
  collect_count?: number | string;
};

export type FavoriteSongItem = {
  favoriteKey: string;
  trackId: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload: TrackSnapshot;
  createdAt: string;
};

export type FavoritePlaylistItem = {
  favoriteKey: string;
  playlistId: string;
  source: string;
  name: string;
  description: string;
  artwork: string;
  songCount: string;
  playCount: string;
  collectCount: string;
  payload: PlaylistSnapshot;
  createdAt: string;
};

export type NetworkErrorRecordInput = {
  requestScope: "system" | "gateway";
  method: string;
  requestUrl: string;
  requestPath: string;
  requestParams?: unknown;
  httpStatus?: number | null;
  businessCode?: number | string | null;
  response?: unknown;
  errorMessage: string;
};

export type NetworkErrorRecordSummary = {
  id: number;
  requestScope: string;
  method: string;
  requestPath: string;
  httpStatus: number | null;
  businessCode: string | null;
  errorMessage: string;
  createdAt: string;
};

export type NetworkErrorRecordDetail = NetworkErrorRecordSummary & {
  requestUrl: string;
  requestParams: unknown;
  response: unknown;
};

export type NetworkErrorRecordPage = {
  items: NetworkErrorRecordSummary[];
  total: number;
  page: number;
  pageSize: number;
};

type SettingRow = {
  key: string;
  value_json: string;
  version: number;
  updated_at: string;
};

type SearchHistoryRow = {
  id: number;
  keyword: string;
  source: string | null;
  created_at: string;
};

type PlayHistoryRow = {
  id: number;
  track_id: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload_json: string;
  played_at: string;
};

type QueueSnapshotRow = {
  current_index: number;
  queue_json: string;
  updated_at: string;
};

type FavoriteSongRow = {
  favorite_key: string;
  track_id: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload_json: string;
  created_at: string;
};

type FavoritePlaylistRow = {
  favorite_key: string;
  playlist_id: string;
  source: string;
  name: string;
  description: string;
  artwork: string;
  song_count: string;
  play_count: string;
  collect_count: string;
  payload_json: string;
  created_at: string;
};

type NetworkErrorSummaryRow = {
  id: number;
  request_scope: string;
  method: string;
  request_path: string;
  http_status: number | null;
  business_code: string | null;
  error_message: string;
  created_at: string;
};

type NetworkErrorDetailRow = NetworkErrorSummaryRow & {
  request_url: string;
  request_params_json: string;
  response_json: string;
};

export class AppDatabase {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  close() {
    this.db.close();
  }

  getSetting<T = unknown>(key: string): SettingRecord<T> | null {
    const row = this.db
      .prepare("SELECT key, value_json, version, updated_at FROM settings WHERE key = ?")
      .get(key) as SettingRow | undefined;
    if (!row) return null;
    return {
      key: row.key,
      value: this.parseJson<T>(row.value_json, null as T),
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  setSetting(key: string, value: unknown, version = 1) {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO settings (key, value_json, version, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value_json = excluded.value_json,
           version = excluded.version,
           updated_at = excluded.updated_at`
      )
      .run(key, JSON.stringify(value), version, now);
    return this.getSetting(key);
  }

  deleteSetting(key: string) {
    this.db.prepare("DELETE FROM settings WHERE key = ?").run(key);
    return true;
  }

  addSearchHistory(keyword: string, source?: string | null) {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return null;
    const now = new Date().toISOString();
    this.db
      .prepare("DELETE FROM search_history WHERE keyword = ? AND COALESCE(source, '') = COALESCE(?, '')")
      .run(normalizedKeyword, source ?? null);
    this.db
      .prepare("INSERT INTO search_history (keyword, source, created_at) VALUES (?, ?, ?)")
      .run(normalizedKeyword, source ?? null, now);
    return this.listSearchHistory(1)[0] ?? null;
  }

  listSearchHistory(limit = 50): SearchHistoryItem[] {
    const rows = this.db
      .prepare(
        `SELECT id, keyword, source, created_at
         FROM search_history
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(this.normalizeLimit(limit)) as SearchHistoryRow[];
    return rows.map((row) => ({
      id: row.id,
      keyword: row.keyword,
      source: row.source,
      createdAt: row.created_at,
    }));
  }

  clearSearchHistory() {
    this.db.prepare("DELETE FROM search_history").run();
    return true;
  }

  deleteSearchHistory(id: number) {
    this.db.prepare("DELETE FROM search_history WHERE id = ?").run(id);
    return true;
  }

  addPlayHistory(track: TrackSnapshot) {
    const normalizedTrack = this.normalizeTrackSnapshot(track);
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO play_history (
           track_id, source, title, artist, album, artwork, duration, payload_json, played_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        normalizedTrack.id,
        normalizedTrack.source,
        normalizedTrack.name ?? "",
        normalizedTrack.singer ?? "",
        normalizedTrack.album ?? "",
        normalizedTrack.cover ?? "",
        normalizedTrack.duration ?? 0,
        JSON.stringify(normalizedTrack),
        now
      );
    return this.listPlayHistory(1)[0] ?? null;
  }

  listPlayHistory(limit = 100): PlayHistoryItem[] {
    const rows = this.db
      .prepare(
        `SELECT id, track_id, source, title, artist, album, artwork, duration, payload_json, played_at
         FROM play_history
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(this.normalizeLimit(limit)) as PlayHistoryRow[];
    return rows.map((row) => ({
      id: row.id,
      trackId: row.track_id,
      source: row.source,
      title: row.title,
      artist: row.artist,
      album: row.album,
      artwork: row.artwork,
      duration: row.duration,
      payload: this.parseJson<TrackSnapshot>(row.payload_json, {
        id: row.track_id,
        source: row.source,
      }),
      playedAt: row.played_at,
    }));
  }

  saveQueueSnapshot(snapshot: Pick<QueueSnapshot, "currentIndex" | "queue">) {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO queue_snapshot (id, current_index, queue_json, updated_at)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           current_index = excluded.current_index,
           queue_json = excluded.queue_json,
           updated_at = excluded.updated_at`
      )
      .run(snapshot.currentIndex, JSON.stringify(snapshot.queue), now);
    return this.getQueueSnapshot();
  }

  getQueueSnapshot(): QueueSnapshot {
    const row = this.db
      .prepare("SELECT current_index, queue_json, updated_at FROM queue_snapshot WHERE id = 1")
      .get() as QueueSnapshotRow | undefined;
    if (!row) {
      return { currentIndex: 0, queue: [], updatedAt: "" };
    }
    return {
      currentIndex: row.current_index,
      queue: this.parseJson<TrackSnapshot[]>(row.queue_json, []),
      updatedAt: row.updated_at,
    };
  }

  listFavoriteSongs(): FavoriteSongItem[] {
    const rows = this.db
      .prepare(
        `SELECT favorite_key, track_id, source, title, artist, album, artwork, duration, payload_json, created_at
         FROM favorite_songs
         ORDER BY created_at DESC`
      )
      .all() as FavoriteSongRow[];
    return rows.map((row) => this.toFavoriteSong(row));
  }

  addFavoriteSong(track: TrackSnapshot) {
    const normalizedTrack = this.normalizeTrackSnapshot(track);
    const key = this.favoriteKey(normalizedTrack.source, normalizedTrack.id);
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO favorite_songs (
           favorite_key, track_id, source, title, artist, album, artwork, duration, payload_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(favorite_key) DO UPDATE SET
           title = excluded.title,
           artist = excluded.artist,
           album = excluded.album,
           artwork = excluded.artwork,
           duration = excluded.duration,
           payload_json = excluded.payload_json`
      )
      .run(
        key,
        normalizedTrack.id,
        normalizedTrack.source,
        normalizedTrack.name ?? "",
        normalizedTrack.singer ?? "",
        normalizedTrack.album ?? "",
        normalizedTrack.cover ?? "",
        normalizedTrack.duration ?? 0,
        JSON.stringify(normalizedTrack),
        now
      );
    return this.getFavoriteSong(normalizedTrack.source, normalizedTrack.id);
  }

  removeFavoriteSong(source: string, id: string) {
    this.db.prepare("DELETE FROM favorite_songs WHERE favorite_key = ?").run(this.favoriteKey(source, id));
    return true;
  }

  toggleFavoriteSong(track: TrackSnapshot) {
    const normalizedTrack = this.normalizeTrackSnapshot(track);
    if (this.containsFavoriteSong(normalizedTrack.source, normalizedTrack.id)) {
      this.removeFavoriteSong(normalizedTrack.source, normalizedTrack.id);
      return { collected: false, item: null };
    }
    return { collected: true, item: this.addFavoriteSong(normalizedTrack) };
  }

  containsFavoriteSong(source: string, id: string) {
    const row = this.db
      .prepare("SELECT favorite_key FROM favorite_songs WHERE favorite_key = ?")
      .get(this.favoriteKey(source, id)) as { favorite_key: string } | undefined;
    return Boolean(row);
  }

  listFavoritePlaylists(): FavoritePlaylistItem[] {
    const rows = this.db
      .prepare(
        `SELECT favorite_key, playlist_id, source, name, description, artwork,
                song_count, play_count, collect_count, payload_json, created_at
         FROM favorite_playlists
         ORDER BY created_at DESC`
      )
      .all() as FavoritePlaylistRow[];
    return rows.map((row) => this.toFavoritePlaylist(row));
  }

  addFavoritePlaylist(playlist: PlaylistSnapshot) {
    const normalizedPlaylist = this.normalizePlaylistSnapshot(playlist);
    const { id, source } = this.requireFavoriteIdentity(normalizedPlaylist, "歌单");
    const key = this.favoriteKey(source, id);
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO favorite_playlists (
           favorite_key, playlist_id, source, name, description, artwork,
           song_count, play_count, collect_count, payload_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(favorite_key) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           artwork = excluded.artwork,
           song_count = excluded.song_count,
           play_count = excluded.play_count,
           collect_count = excluded.collect_count,
           payload_json = excluded.payload_json`
      )
      .run(
        key,
        id,
        source,
        normalizedPlaylist.name,
        normalizedPlaylist.desc,
        normalizedPlaylist.cover,
        String(normalizedPlaylist.song_count ?? ""),
        String(normalizedPlaylist.play_count ?? ""),
        String(normalizedPlaylist.collect_count ?? ""),
        JSON.stringify(normalizedPlaylist),
        now
      );
    return this.getFavoritePlaylist(source, id);
  }

  removeFavoritePlaylist(source: string, id: string) {
    this.requireFavoriteKey(source, id, "歌单");
    this.db.prepare("DELETE FROM favorite_playlists WHERE favorite_key = ?").run(this.favoriteKey(source, id));
    return true;
  }

  toggleFavoritePlaylist(playlist: PlaylistSnapshot) {
    const normalizedPlaylist = this.normalizePlaylistSnapshot(playlist);
    const { id, source } = this.requireFavoriteIdentity(normalizedPlaylist, "歌单");
    if (this.containsFavoritePlaylist(source, id)) {
      this.removeFavoritePlaylist(source, id);
      return { collected: false, item: null };
    }
    return { collected: true, item: this.addFavoritePlaylist(normalizedPlaylist) };
  }

  containsFavoritePlaylist(source: string, id: string) {
    this.requireFavoriteKey(source, id, "歌单");
    const row = this.db
      .prepare("SELECT favorite_key FROM favorite_playlists WHERE favorite_key = ?")
      .get(this.favoriteKey(source, id)) as { favorite_key: string } | undefined;
    return Boolean(row);
  }

  addNetworkErrorRecord(input: NetworkErrorRecordInput) {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO network_error_records (
           request_scope, method, request_url, request_path, request_params_json,
           http_status, business_code, response_json, error_message, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.requestScope,
        input.method,
        input.requestUrl,
        input.requestPath,
        this.stringifyJson(input.requestParams ?? null),
        input.httpStatus ?? null,
        input.businessCode === undefined || input.businessCode === null ? null : String(input.businessCode),
        this.stringifyJson(input.response ?? null),
        input.errorMessage,
        now
      );

    this.db.prepare(
      `DELETE FROM network_error_records
       WHERE id NOT IN (
         SELECT id
         FROM network_error_records
         ORDER BY created_at DESC, id DESC
         LIMIT 1000
       )`
    ).run();
    return true;
  }

  listNetworkErrorRecords(page = 1, pageSize = 10): NetworkErrorRecordPage {
    const normalizedPageSize = this.normalizeLimit(pageSize);
    const normalizedPage = Math.max(Math.floor(Number(page) || 1), 1);
    const offset = (normalizedPage - 1) * normalizedPageSize;
    const totalRow = this.db
      .prepare("SELECT COUNT(*) AS total FROM network_error_records")
      .get() as { total: number } | undefined;
    const rows = this.db
      .prepare(
        `SELECT id, request_scope, method, request_path, http_status, business_code, error_message, created_at
         FROM network_error_records
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`
      )
      .all(normalizedPageSize, offset) as NetworkErrorSummaryRow[];

    return {
      items: rows.map((row) => this.toNetworkErrorSummary(row)),
      total: totalRow?.total ?? 0,
      page: normalizedPage,
      pageSize: normalizedPageSize,
    };
  }

  getNetworkErrorRecord(id: number): NetworkErrorRecordDetail | null {
    const row = this.db
      .prepare(
        `SELECT id, request_scope, method, request_url, request_path, request_params_json,
                http_status, business_code, response_json, error_message, created_at
         FROM network_error_records
         WHERE id = ?`
      )
      .get(id) as NetworkErrorDetailRow | undefined;
    if (!row) return null;
    return this.toNetworkErrorDetail(row);
  }

  exportNetworkErrorRecords(limit = 10): NetworkErrorRecordDetail[] {
    const rows = this.db
      .prepare(
        `SELECT id, request_scope, method, request_url, request_path, request_params_json,
                http_status, business_code, response_json, error_message, created_at
         FROM network_error_records
         ORDER BY created_at DESC, id DESC
         LIMIT ?`
      )
      .all(this.normalizeLimit(limit)) as NetworkErrorDetailRow[];
    return rows.map((row) => this.toNetworkErrorDetail(row));
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        source TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_search_history_created_at
        ON search_history(created_at DESC);

      CREATE TABLE IF NOT EXISTS play_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT NOT NULL,
        source TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        artist TEXT NOT NULL DEFAULT '',
        album TEXT NOT NULL DEFAULT '',
        artwork TEXT NOT NULL DEFAULT '',
        duration INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        played_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_play_history_played_at
        ON play_history(played_at DESC);

      CREATE TABLE IF NOT EXISTS queue_snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_index INTEGER NOT NULL DEFAULT 0,
        queue_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS favorite_songs (
        favorite_key TEXT PRIMARY KEY,
        track_id TEXT NOT NULL,
        source TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        artist TEXT NOT NULL DEFAULT '',
        album TEXT NOT NULL DEFAULT '',
        artwork TEXT NOT NULL DEFAULT '',
        duration INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_favorite_songs_created_at
        ON favorite_songs(created_at DESC);

      CREATE TABLE IF NOT EXISTS favorite_playlists (
        favorite_key TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        source TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        artwork TEXT NOT NULL DEFAULT '',
        song_count TEXT NOT NULL DEFAULT '',
        play_count TEXT NOT NULL DEFAULT '',
        collect_count TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_favorite_playlists_created_at
        ON favorite_playlists(created_at DESC);

      CREATE TABLE IF NOT EXISTS network_error_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_scope TEXT NOT NULL,
        method TEXT NOT NULL,
        request_url TEXT NOT NULL,
        request_path TEXT NOT NULL,
        request_params_json TEXT NOT NULL,
        http_status INTEGER,
        business_code TEXT,
        response_json TEXT NOT NULL,
        error_message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_network_error_records_created_at
        ON network_error_records(created_at DESC, id DESC);
    `);
    this.db
      .prepare(
        `INSERT INTO schema_migrations (version, name, applied_at)
         VALUES (1, 'initial local library schema', ?)
         ON CONFLICT(version) DO NOTHING`
      )
      .run(new Date().toISOString());
    this.db
      .prepare(
        `INSERT INTO schema_migrations (version, name, applied_at)
         VALUES (2, 'network error records schema', ?)
         ON CONFLICT(version) DO NOTHING`
      )
      .run(new Date().toISOString());
  }

  private normalizeLimit(limit: number) {
    if (!Number.isFinite(limit)) return 50;
    return Math.min(Math.max(Math.floor(limit), 1), 500);
  }

  private parseJson<T>(raw: string, fallback: T): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private stringifyJson(value: unknown) {
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return JSON.stringify({
        stringifyError: true,
        fallback: String(value),
      });
    }
  }

  private toNetworkErrorSummary(row: NetworkErrorSummaryRow): NetworkErrorRecordSummary {
    return {
      id: row.id,
      requestScope: row.request_scope,
      method: row.method,
      requestPath: row.request_path,
      httpStatus: row.http_status,
      businessCode: row.business_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }

  private toNetworkErrorDetail(row: NetworkErrorDetailRow): NetworkErrorRecordDetail {
    return {
      ...this.toNetworkErrorSummary(row),
      requestUrl: row.request_url,
      requestParams: this.parseJson<unknown>(row.request_params_json, null),
      response: this.parseJson<unknown>(row.response_json, null),
    };
  }

  private getFavoriteSong(source: string, id: string) {
    const row = this.db
      .prepare(
        `SELECT favorite_key, track_id, source, title, artist, album, artwork, duration, payload_json, created_at
         FROM favorite_songs
         WHERE favorite_key = ?`
      )
      .get(this.favoriteKey(source, id)) as FavoriteSongRow | undefined;
    return row ? this.toFavoriteSong(row) : null;
  }

  private getFavoritePlaylist(source: string, id: string) {
    const row = this.db
      .prepare(
        `SELECT favorite_key, playlist_id, source, name, description, artwork,
                song_count, play_count, collect_count, payload_json, created_at
         FROM favorite_playlists
         WHERE favorite_key = ?`
      )
      .get(this.favoriteKey(source, id)) as FavoritePlaylistRow | undefined;
    return row ? this.toFavoritePlaylist(row) : null;
  }

  private toFavoriteSong(row: FavoriteSongRow): FavoriteSongItem {
    const payload = this.normalizeTrackSnapshot(
      this.parseJson<TrackSnapshot>(row.payload_json, {
        id: row.track_id,
        source: row.source,
      })
    );
    return {
      favoriteKey: row.favorite_key,
      trackId: row.track_id,
      source: row.source,
      title: row.title,
      artist: row.artist,
      album: row.album,
      artwork: row.artwork,
      duration: row.duration,
      payload,
      createdAt: row.created_at,
    };
  }

  private toFavoritePlaylist(row: FavoritePlaylistRow): FavoritePlaylistItem {
    const payload = this.normalizePlaylistSnapshot(
      this.parseJson<Partial<PlaylistSnapshot>>(row.payload_json, {
        id: row.playlist_id,
        source: this.normalizePlaylistSource(row.source),
      })
    );
    return {
      favoriteKey: row.favorite_key,
      playlistId: row.playlist_id,
      source: row.source,
      name: row.name,
      description: row.description,
      artwork: row.artwork,
      songCount: row.song_count,
      playCount: row.play_count,
      collectCount: row.collect_count,
      payload,
      createdAt: row.created_at,
    };
  }

  private favoriteKey(source: string, id: string) {
    return `${source}:${id}`;
  }

  private requireFavoriteIdentity(item: { id?: unknown; source?: unknown }, label: string) {
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const source = typeof item.source === "string" ? item.source.trim() : "";
    return this.requireFavoriteKey(source, id, label);
  }

  private requireFavoriteKey(source: unknown, id: unknown, label: string) {
    const normalizedSource = typeof source === "string" ? source.trim() : "";
    const normalizedId = typeof id === "string" ? id.trim() : "";
    if (!normalizedId || !this.isPlaylistSource(normalizedSource)) {
      throw new Error(`${label}收藏需要 source 和 id`);
    }
    return { id: normalizedId, source: normalizedSource as PlaylistSource };
  }

  private normalizePlaylistSnapshot(input: Partial<PlaylistSnapshot> | Record<string, unknown>): PlaylistSnapshot {
    const { id, source } = this.requireFavoriteIdentity(input, "歌单");
    const playlist: PlaylistSnapshot = {
      id,
      source,
      name: this.toStringValue(input.name),
      desc: this.toStringValue(input.desc),
      cover: this.toStringValue(input.cover),
      tags: this.normalizePlaylistTags(input.tags),
    };

    const coverSize = this.normalizeCoverSize(input.coverSize);
    if (coverSize) playlist.coverSize = coverSize;

    const songCount = this.normalizeCount(input.song_count);
    if (songCount !== undefined) playlist.song_count = songCount;

    const playCount = this.normalizeCount(input.play_count);
    if (playCount !== undefined) playlist.play_count = playCount;

    const collectCount = this.normalizeCount(input.collect_count);
    if (collectCount !== undefined) playlist.collect_count = collectCount;

    return playlist;
  }

  private normalizePlaylistSource(source: unknown) {
    const normalizedSource = typeof source === "string" ? source.trim() : "";
    if (this.isPlaylistSource(normalizedSource)) return normalizedSource;
    return "kg";
  }

  private isPlaylistSource(source: string): source is PlaylistSource {
    return source === "kg" || source === "wy" || source === "kw" || source === "qq";
  }

  private normalizeCoverSize(value: unknown): PlaylistSnapshot["coverSize"] | undefined {
    if (!this.isRecord(value)) return undefined;
    return {
      s: this.toStringValue(value.s),
      m: this.toStringValue(value.m),
      l: this.toStringValue(value.l),
      xl: this.toStringValue(value.xl),
    };
  }

  private normalizePlaylistTags(value: unknown): PlaylistSnapshot["tags"] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((tag): tag is Record<string, unknown> => this.isRecord(tag))
      .map((tag) => ({
        name: this.toStringValue(tag.name),
        id: this.toStringValue(tag.id),
      }))
      .filter((tag) => tag.name || tag.id);
  }

  private normalizeCount(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") return value;
    return undefined;
  }

  private toStringValue(value: unknown) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  private normalizeTrackSnapshot(input: TrackSnapshot | Record<string, unknown>): TrackSnapshot {
    const id = this.toStringValue(input.id);
    const source = this.toStringValue(input.source);
    if (!id || !source) {
      throw new Error("歌曲收藏需要 source 和 id");
    }

    const track: TrackSnapshot = {
      id,
      source,
      name: this.toStringValue(input.name),
      singer: this.toStringValue(input.singer),
      album: this.toStringValue(input.album),
      cover: this.toStringValue(input.cover),
      duration: this.normalizeDuration(input.duration),
    };

    const urlParam = this.toStringValue(input.urlParam);
    if (urlParam) track.urlParam = urlParam;

    const coverSize = this.normalizeCoverSize(input.coverSize);
    if (coverSize) track.coverSize = coverSize;

    const size = this.normalizeTrackSize(input.size);
    if (size) track.size = size;

    const dCover = this.toStringValue(input.d_cover);
    if (dCover) track.d_cover = dCover;

    const lyric = this.toStringValue(input.lyric);
    if (lyric) track.lyric = lyric;

    const krc = this.toStringValue(input.krc);
    if (krc) track.krc = krc;

    if (typeof input.vip === "boolean") track.vip = input.vip;

    return track;
  }

  private normalizeTrackSize(value: unknown) {
    if (!this.isRecord(value)) return undefined;
    const size: Record<string, number> = {};
    Object.entries(value).forEach(([key, rawValue]) => {
      if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        size[key] = rawValue;
      }
    });
    return Object.keys(size).length ? size : undefined;
  }

  private normalizeDuration(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const duration = Number(value);
      if (Number.isFinite(duration)) return duration;
    }
    return 0;
  }
}
