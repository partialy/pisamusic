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
  filePath?: string;
  [key: string]: unknown;
};

export type LocalSongItem = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  filePath: string;
  directory: string;
  fileName: string;
  extension: string;
  size: number;
  mtimeMs: number;
  payload: TrackSnapshot;
  updatedAt: string;
};

export type LocalLibraryScanMeta = {
  fingerprint: string;
  directories: string[];
  totalFiles: number;
  scannedAt: string;
};

export type DownloadMetadataStatus = "embedded" | "sidecar" | "failed";
export type DownloadRecordStatus = "queued" | "running" | "completed" | "failed";

export type DownloadRecordInput = {
  source: string;
  songId: string;
  qualityKey: string;
  status: DownloadRecordStatus;
  downloadDirectory: string;
  filePath?: string;
  cachePath?: string;
  metadataStatus: DownloadMetadataStatus;
  metadataJsonPath?: string;
  lyricPath?: string;
  coverPath?: string;
  totalBytes?: number;
  receivedBytes?: number;
  completedAt?: string;
  payload: TrackSnapshot;
  message?: string;
};

export type DownloadRecordItem = DownloadRecordInput & {
  id: number;
  createdAt: string;
  updatedAt: string;
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

export type PlaylistSource = "kg" | "wy" | "kw" | "qq" | "local";

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

export type UserPlaylistItem = {
  playlistKey: string;
  playlistId: string;
  source: PlaylistSource;
  name: string;
  description: string;
  artwork: string;
  songCount: string;
  playCount: string;
  collectCount: string;
  payload: PlaylistSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type UserPlaylistTrackItem = {
  playlistId: string;
  trackKey: string;
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

export type UserCloudSongItem = {
  cloudSource: string;
  trackKey: string;
  trackId: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload: TrackSnapshot;
  updatedAt: string;
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

type UserPlaylistRow = {
  playlist_key: string;
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
  updated_at: string;
};

type UserPlaylistTrackRow = {
  playlist_id: string;
  track_key: string;
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

type UserCloudSongRow = {
  cloud_source: string;
  track_key: string;
  track_id: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  payload_json: string;
  updated_at: string;
};

type LocalSongRow = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  file_path: string;
  directory: string;
  file_name: string;
  extension: string;
  size: number;
  mtime_ms: number;
  payload_json: string;
  updated_at: string;
};

type LocalLibraryScanMetaRow = {
  id: number;
  fingerprint: string;
  directories_json: string;
  total_files: number;
  scanned_at: string;
};

type DownloadRecordRow = {
  id: number;
  source: string;
  song_id: string;
  quality_key: string;
  status: DownloadRecordStatus;
  download_directory: string;
  file_path: string;
  cache_path: string;
  metadata_status: DownloadMetadataStatus;
  metadata_json_path: string;
  lyric_path: string;
  cover_path: string;
  total_bytes: number;
  received_bytes: number;
  payload_json: string;
  message: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
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

  listUserPlaylists(source?: PlaylistSource | "all"): UserPlaylistItem[] {
    const rows = source && source !== "all"
      ? this.db
          .prepare(
            `SELECT playlist_key, playlist_id, source, name, description, artwork,
                    song_count, play_count, collect_count, payload_json, created_at, updated_at
             FROM user_playlists
             WHERE source = ?
             ORDER BY updated_at DESC, created_at DESC`
          )
          .all(source) as UserPlaylistRow[]
      : this.db
          .prepare(
            `SELECT playlist_key, playlist_id, source, name, description, artwork,
                    song_count, play_count, collect_count, payload_json, created_at, updated_at
             FROM user_playlists
             ORDER BY source = 'local' DESC, updated_at DESC, created_at DESC`
          )
          .all() as UserPlaylistRow[];
    return rows.map((row) => this.toUserPlaylist(row));
  }

  upsertUserPlaylist(playlist: PlaylistSnapshot) {
    const normalizedPlaylist = this.normalizePlaylistSnapshot(playlist);
    const { id, source } = this.requireFavoriteIdentity(normalizedPlaylist, "姝屽崟");
    const key = this.favoriteKey(source, id);
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO user_playlists (
           playlist_key, playlist_id, source, name, description, artwork,
           song_count, play_count, collect_count, payload_json, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(playlist_key) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           artwork = excluded.artwork,
           song_count = excluded.song_count,
           play_count = excluded.play_count,
           collect_count = excluded.collect_count,
           payload_json = excluded.payload_json,
           updated_at = excluded.updated_at`
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
        now,
        now
      );
    return this.getUserPlaylist(source, id);
  }

  createUserPlaylist(input: Partial<PlaylistSnapshot>) {
    const playlist = this.normalizePlaylistSnapshot({
      ...input,
      id: this.toStringValue(input.id) || this.createLocalPlaylistId(),
      source: "local",
      tags: this.normalizePlaylistTags(input.tags).slice(0, 3),
      song_count: input.song_count ?? 0,
    });
    return this.upsertUserPlaylist(playlist);
  }

  replaceUserPlaylists(source: Exclude<PlaylistSource, "local">, playlists: PlaylistSnapshot[]) {
    const normalizedPlaylists = playlists.map((playlist) =>
      this.normalizePlaylistSnapshot({ ...playlist, source })
    );
    const now = new Date().toISOString();
    const insert = this.db.prepare(
      `INSERT INTO user_playlists (
         playlist_key, playlist_id, source, name, description, artwork,
         song_count, play_count, collect_count, payload_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.db.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      this.db.prepare("DELETE FROM user_playlists WHERE source = ?").run(source);
      normalizedPlaylists.forEach((playlist) => {
        insert.run(
          this.favoriteKey(playlist.source, playlist.id),
          playlist.id,
          playlist.source,
          playlist.name,
          playlist.desc,
          playlist.cover,
          String(playlist.song_count ?? ""),
          String(playlist.play_count ?? ""),
          String(playlist.collect_count ?? ""),
          JSON.stringify(playlist),
          now,
          now
        );
      });
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
    return this.listUserPlaylists(source);
  }

  listUserPlaylistTracks(playlistId: string): UserPlaylistTrackItem[] {
    const rows = this.db
      .prepare(
        `SELECT playlist_id, track_key, track_id, source, title, artist, album,
                artwork, duration, payload_json, created_at
         FROM user_playlist_tracks
         WHERE playlist_id = ?
         ORDER BY id ASC`
      )
      .all(playlistId) as UserPlaylistTrackRow[];
    return rows.map((row) => this.toUserPlaylistTrack(row));
  }

  addUserPlaylistTrack(playlistId: string, track: TrackSnapshot) {
    const normalizedPlaylistId = this.toStringValue(playlistId);
    if (!normalizedPlaylistId) throw new Error("添加歌曲需要歌单 ID");
    const normalizedTrack = this.normalizeTrackSnapshot(track);
    const trackKey = this.favoriteKey(normalizedTrack.source, normalizedTrack.id);
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO user_playlist_tracks (
           playlist_id, track_key, track_id, source, title, artist, album,
           artwork, duration, payload_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(playlist_id, track_key) DO UPDATE SET
           title = excluded.title,
           artist = excluded.artist,
           album = excluded.album,
           artwork = excluded.artwork,
           duration = excluded.duration,
           payload_json = excluded.payload_json`
      )
      .run(
        normalizedPlaylistId,
        trackKey,
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
    this.updateUserPlaylistSongCount(normalizedPlaylistId);
    return this.listUserPlaylistTracks(normalizedPlaylistId);
  }

  listUserCloudSongs(cloudSource?: string | "all"): UserCloudSongItem[] {
    const rows = cloudSource && cloudSource !== "all"
      ? this.db
          .prepare(
            `SELECT cloud_source, track_key, track_id, source, title, artist,
                    album, artwork, duration, payload_json, updated_at
             FROM user_cloud_songs
             WHERE cloud_source = ?
             ORDER BY updated_at DESC`
          )
          .all(cloudSource) as UserCloudSongRow[]
      : this.db
          .prepare(
            `SELECT cloud_source, track_key, track_id, source, title, artist,
                    album, artwork, duration, payload_json, updated_at
             FROM user_cloud_songs
             ORDER BY updated_at DESC`
          )
          .all() as UserCloudSongRow[];
    return rows.map((row) => this.toUserCloudSong(row));
  }

  replaceUserCloudSongs(cloudSource: string, songs: TrackSnapshot[]) {
    const normalizedSource = this.toStringValue(cloudSource);
    if (!normalizedSource) throw new Error("云盘来源不能为空");
    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO user_cloud_songs (
         cloud_source, track_key, track_id, source, title, artist, album,
         artwork, duration, payload_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      this.db.prepare("DELETE FROM user_cloud_songs WHERE cloud_source = ?").run(normalizedSource);
      songs.forEach((song) => {
        const normalizedSong = this.normalizeTrackSnapshot(song);
        insert.run(
          normalizedSource,
          this.favoriteKey(normalizedSong.source, normalizedSong.id),
          normalizedSong.id,
          normalizedSong.source,
          normalizedSong.name ?? "",
          normalizedSong.singer ?? "",
          normalizedSong.album ?? "",
          normalizedSong.cover ?? "",
          normalizedSong.duration ?? 0,
          JSON.stringify(normalizedSong),
          now
        );
      });
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
    return this.listUserCloudSongs(normalizedSource);
  }

  listLocalSongs(): LocalSongItem[] {
    const rows = this.db
      .prepare(
        `SELECT id, title, artist, album, duration, file_path, directory, file_name,
                extension, size, mtime_ms, payload_json, updated_at
         FROM local_songs
         ORDER BY title COLLATE NOCASE ASC, artist COLLATE NOCASE ASC`
      )
      .all() as LocalSongRow[];
    return rows.map((row) => this.toLocalSong(row));
  }

  removeLocalSongByFilePath(filePath: string) {
    const normalizedPath = this.toStringValue(filePath);
    if (!normalizedPath) return false;
    this.db.prepare("DELETE FROM local_songs WHERE file_path = ?").run(normalizedPath);
    return true;
  }

  replaceLocalSongs(songs: LocalSongItem[], meta: LocalLibraryScanMeta) {
    const insertSong = this.db.prepare(
      `INSERT INTO local_songs (
         id, title, artist, album, duration, file_path, directory, file_name,
         extension, size, mtime_ms, payload_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const replaceMeta = this.db.prepare(
      `INSERT INTO local_library_scan_meta (
         id, fingerprint, directories_json, total_files, scanned_at
       ) VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         fingerprint = excluded.fingerprint,
         directories_json = excluded.directories_json,
         total_files = excluded.total_files,
         scanned_at = excluded.scanned_at`
    );

    this.db.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      this.db.prepare("DELETE FROM local_songs").run();
      songs.forEach((song) => {
        insertSong.run(
          song.id,
          song.title,
          song.artist,
          song.album,
          song.duration,
          song.filePath,
          song.directory,
          song.fileName,
          song.extension,
          song.size,
          song.mtimeMs,
          this.stringifyJson(song.payload),
          song.updatedAt
        );
      });
      replaceMeta.run(
        meta.fingerprint,
        this.stringifyJson(meta.directories),
        meta.totalFiles,
        meta.scannedAt
      );
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
    return this.listLocalSongs();
  }

  getLocalLibraryScanMeta(): LocalLibraryScanMeta | null {
    const row = this.db
      .prepare(
        `SELECT id, fingerprint, directories_json, total_files, scanned_at
         FROM local_library_scan_meta
         WHERE id = 1`
      )
      .get() as LocalLibraryScanMetaRow | undefined;
    if (!row) return null;
    return {
      fingerprint: row.fingerprint,
      directories: this.parseJson<string[]>(row.directories_json, []),
      totalFiles: row.total_files,
      scannedAt: row.scanned_at,
    };
  }

  upsertDownloadRecord(input: DownloadRecordInput): DownloadRecordItem | null {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO download_records (
           source, song_id, quality_key, status, download_directory, file_path, cache_path,
           metadata_status, metadata_json_path, lyric_path, cover_path, total_bytes,
           received_bytes, payload_json, message, completed_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source, song_id, quality_key) DO UPDATE SET
           status = excluded.status,
           download_directory = excluded.download_directory,
           file_path = excluded.file_path,
           cache_path = excluded.cache_path,
           metadata_status = excluded.metadata_status,
           metadata_json_path = excluded.metadata_json_path,
           lyric_path = excluded.lyric_path,
           cover_path = excluded.cover_path,
           total_bytes = excluded.total_bytes,
           received_bytes = excluded.received_bytes,
           payload_json = excluded.payload_json,
           message = excluded.message,
           completed_at = excluded.completed_at,
           updated_at = excluded.updated_at`
      )
      .run(
        input.source,
        input.songId,
        input.qualityKey,
        input.status,
        input.downloadDirectory,
        input.filePath ?? "",
        input.cachePath ?? "",
        input.metadataStatus,
        input.metadataJsonPath ?? "",
        input.lyricPath ?? "",
        input.coverPath ?? "",
        input.totalBytes ?? 0,
        input.receivedBytes ?? 0,
        this.stringifyJson(input.payload),
        input.message ?? "",
        input.completedAt ?? "",
        now,
        now
      );
    return this.getDownloadRecord(input.source, input.songId, input.qualityKey);
  }

  listDownloadRecords(): DownloadRecordItem[] {
    const rows = this.db
      .prepare(
        `SELECT id, source, song_id, quality_key, status, download_directory, file_path,
                cache_path, metadata_status, metadata_json_path, lyric_path, cover_path,
                total_bytes, received_bytes, payload_json, message, completed_at,
                created_at, updated_at
         FROM download_records
         ORDER BY updated_at DESC, id DESC`
      )
      .all() as DownloadRecordRow[];
    return rows.map((row) => this.toDownloadRecord(row));
  }

  listDownloadedSongs(): TrackSnapshot[] {
    return this.listDownloadRecords()
      .filter((record) => record.status === "completed" && Boolean(record.filePath))
      .map((record) => {
        const payload = this.normalizeTrackSnapshot(record.payload);
        return {
          ...payload,
          source: "local",
          id: record.filePath || `${record.source}:${record.songId}:${record.qualityKey}`,
          urlParam: record.filePath,
          filePath: record.filePath,
        };
      });
  }

  removeDownloadRecordsByFilePath(filePath: string) {
    const normalizedPath = this.toStringValue(filePath);
    if (!normalizedPath) return false;
    this.db.prepare("DELETE FROM download_records WHERE file_path = ?").run(normalizedPath);
    return true;
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

      CREATE TABLE IF NOT EXISTS user_playlists (
        playlist_key TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        source TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        artwork TEXT NOT NULL DEFAULT '',
        song_count TEXT NOT NULL DEFAULT '',
        play_count TEXT NOT NULL DEFAULT '',
        collect_count TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_user_playlists_source_updated_at
        ON user_playlists(source, updated_at DESC);

      CREATE TABLE IF NOT EXISTS user_playlist_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id TEXT NOT NULL,
        track_key TEXT NOT NULL,
        track_id TEXT NOT NULL,
        source TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        artist TEXT NOT NULL DEFAULT '',
        album TEXT NOT NULL DEFAULT '',
        artwork TEXT NOT NULL DEFAULT '',
        duration INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(playlist_id, track_key)
      );

      CREATE INDEX IF NOT EXISTS idx_user_playlist_tracks_playlist_id
        ON user_playlist_tracks(playlist_id, id ASC);

      CREATE TABLE IF NOT EXISTS user_cloud_songs (
        cloud_source TEXT NOT NULL,
        track_key TEXT NOT NULL,
        track_id TEXT NOT NULL,
        source TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        artist TEXT NOT NULL DEFAULT '',
        album TEXT NOT NULL DEFAULT '',
        artwork TEXT NOT NULL DEFAULT '',
        duration INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(cloud_source, track_key)
      );

      CREATE INDEX IF NOT EXISTS idx_user_cloud_songs_source_updated_at
        ON user_cloud_songs(cloud_source, updated_at DESC);

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

      CREATE TABLE IF NOT EXISTS local_songs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        artist TEXT NOT NULL DEFAULT '',
        album TEXT NOT NULL DEFAULT '',
        duration INTEGER NOT NULL DEFAULT 0,
        file_path TEXT NOT NULL,
        directory TEXT NOT NULL DEFAULT '',
        file_name TEXT NOT NULL DEFAULT '',
        extension TEXT NOT NULL DEFAULT '',
        size INTEGER NOT NULL DEFAULT 0,
        mtime_ms REAL NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_local_songs_title_artist
        ON local_songs(title COLLATE NOCASE, artist COLLATE NOCASE);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_local_songs_file_path
        ON local_songs(file_path);

      CREATE TABLE IF NOT EXISTS local_library_scan_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        fingerprint TEXT NOT NULL,
        directories_json TEXT NOT NULL,
        total_files INTEGER NOT NULL DEFAULT 0,
        scanned_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS download_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        song_id TEXT NOT NULL,
        quality_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        download_directory TEXT NOT NULL DEFAULT '',
        file_path TEXT NOT NULL DEFAULT '',
        cache_path TEXT NOT NULL DEFAULT '',
        metadata_status TEXT NOT NULL DEFAULT 'sidecar',
        metadata_json_path TEXT NOT NULL DEFAULT '',
        lyric_path TEXT NOT NULL DEFAULT '',
        cover_path TEXT NOT NULL DEFAULT '',
        total_bytes INTEGER NOT NULL DEFAULT 0,
        received_bytes INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        completed_at TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(source, song_id, quality_key)
      );

      CREATE INDEX IF NOT EXISTS idx_download_records_updated_at
        ON download_records(updated_at DESC, id DESC);
    `);
    this.ensureDownloadRecordColumns();
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
         VALUES (3, 'local library songs schema', ?)
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
    this.db
      .prepare(
        `INSERT INTO schema_migrations (version, name, applied_at)
         VALUES (4, 'download records schema', ?)
         ON CONFLICT(version) DO NOTHING`
      )
      .run(new Date().toISOString());
  }

  private normalizeLimit(limit: number) {
    if (!Number.isFinite(limit)) return 50;
    return Math.min(Math.max(Math.floor(limit), 1), 500);
  }

  private ensureDownloadRecordColumns() {
    const rows = this.db.prepare("PRAGMA table_info(download_records)").all() as { name: string }[];
    const columns = new Set(rows.map((row) => row.name));
    const additions: Record<string, string> = {
      status: "ALTER TABLE download_records ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'",
      total_bytes: "ALTER TABLE download_records ADD COLUMN total_bytes INTEGER NOT NULL DEFAULT 0",
      received_bytes: "ALTER TABLE download_records ADD COLUMN received_bytes INTEGER NOT NULL DEFAULT 0",
      completed_at: "ALTER TABLE download_records ADD COLUMN completed_at TEXT NOT NULL DEFAULT ''",
    };
    Object.entries(additions).forEach(([column, sql]) => {
      if (!columns.has(column)) this.db.exec(sql);
    });
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

  private getDownloadRecord(source: string, songId: string, qualityKey: string) {
    const row = this.db
      .prepare(
        `SELECT id, source, song_id, quality_key, status, download_directory, file_path,
                cache_path, metadata_status, metadata_json_path, lyric_path,
                cover_path, total_bytes, received_bytes, payload_json, message,
                completed_at, created_at, updated_at
         FROM download_records
         WHERE source = ? AND song_id = ? AND quality_key = ?`
      )
      .get(source, songId, qualityKey) as DownloadRecordRow | undefined;
    return row ? this.toDownloadRecord(row) : null;
  }

  private toDownloadRecord(row: DownloadRecordRow): DownloadRecordItem {
    return {
      id: row.id,
      source: row.source,
      songId: row.song_id,
      qualityKey: row.quality_key,
      status: row.status,
      downloadDirectory: row.download_directory,
      filePath: row.file_path,
      cachePath: row.cache_path,
      metadataStatus: row.metadata_status,
      metadataJsonPath: row.metadata_json_path,
      lyricPath: row.lyric_path,
      coverPath: row.cover_path,
      totalBytes: row.total_bytes,
      receivedBytes: row.received_bytes,
      payload: this.parseJson<TrackSnapshot>(row.payload_json, {
        id: row.song_id,
        source: row.source,
      }),
      message: row.message,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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

  private getUserPlaylist(source: string, id: string) {
    const row = this.db
      .prepare(
        `SELECT playlist_key, playlist_id, source, name, description, artwork,
                song_count, play_count, collect_count, payload_json, created_at, updated_at
         FROM user_playlists
         WHERE playlist_key = ?`
      )
      .get(this.favoriteKey(source, id)) as UserPlaylistRow | undefined;
    return row ? this.toUserPlaylist(row) : null;
  }

  private toUserPlaylist(row: UserPlaylistRow): UserPlaylistItem {
    const payload = this.normalizePlaylistSnapshot(
      this.parseJson<Partial<PlaylistSnapshot>>(row.payload_json, {
        id: row.playlist_id,
        source: this.normalizePlaylistSource(row.source),
      })
    );
    return {
      playlistKey: row.playlist_key,
      playlistId: row.playlist_id,
      source: this.normalizePlaylistSource(row.source),
      name: row.name,
      description: row.description,
      artwork: row.artwork,
      songCount: row.song_count,
      playCount: row.play_count,
      collectCount: row.collect_count,
      payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toUserPlaylistTrack(row: UserPlaylistTrackRow): UserPlaylistTrackItem {
    const payload = this.normalizeTrackSnapshot(
      this.parseJson<TrackSnapshot>(row.payload_json, {
        id: row.track_id,
        source: row.source,
      })
    );
    return {
      playlistId: row.playlist_id,
      trackKey: row.track_key,
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

  private toUserCloudSong(row: UserCloudSongRow): UserCloudSongItem {
    const payload = this.normalizeTrackSnapshot(
      this.parseJson<TrackSnapshot>(row.payload_json, {
        id: row.track_id,
        source: row.source,
      })
    );
    return {
      cloudSource: row.cloud_source,
      trackKey: row.track_key,
      trackId: row.track_id,
      source: row.source,
      title: row.title,
      artist: row.artist,
      album: row.album,
      artwork: row.artwork,
      duration: row.duration,
      payload,
      updatedAt: row.updated_at,
    };
  }

  private updateUserPlaylistSongCount(playlistId: string) {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM user_playlist_tracks WHERE playlist_id = ?")
      .get(playlistId) as { count: number } | undefined;
    const count = String(row?.count ?? 0);
    const existing = this.db
      .prepare("SELECT payload_json FROM user_playlists WHERE source = 'local' AND playlist_id = ?")
      .get(playlistId) as { payload_json: string } | undefined;
    const payload = existing
      ? this.normalizePlaylistSnapshot(this.parseJson<Partial<PlaylistSnapshot>>(existing.payload_json, {
          id: playlistId,
          source: "local",
        }))
      : null;
    if (payload) payload.song_count = count;
    this.db
      .prepare(
        `UPDATE user_playlists
         SET song_count = ?, payload_json = COALESCE(?, payload_json), updated_at = ?
         WHERE source = 'local' AND playlist_id = ?`
      )
      .run(count, payload ? JSON.stringify(payload) : null, new Date().toISOString(), playlistId);
  }

  private createLocalPlaylistId() {
    return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
    return source === "kg" || source === "wy" || source === "kw" || source === "qq" || source === "local";
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

    const filePath = this.toStringValue(input.filePath);
    if (filePath) track.filePath = filePath;

    return track;
  }

  private toLocalSong(row: LocalSongRow): LocalSongItem {
    const payload = this.normalizeTrackSnapshot(
      this.parseJson<TrackSnapshot>(row.payload_json, {
        id: row.id,
        source: "local",
        urlParam: row.file_path,
        filePath: row.file_path,
      })
    );
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: row.duration,
      filePath: row.file_path,
      directory: row.directory,
      fileName: row.file_name,
      extension: row.extension,
      size: row.size,
      mtimeMs: row.mtime_ms,
      payload,
      updatedAt: row.updated_at,
    };
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
