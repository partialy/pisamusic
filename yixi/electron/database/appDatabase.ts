import { DatabaseSync } from "node:sqlite";
import { normalizeLimit, parseJson, stringifyJson } from "./json";
import {
  toDownloadRecord,
  toFavoritePlaylist,
  toFavoriteSong,
  toLocalSong,
  toNetworkErrorDetail,
  toNetworkErrorSummary,
  toUserCloudSong,
  toUserPlaylist,
  toUserPlaylistTrack,
} from "./mappers";
import {
  favoriteKey,
  normalizePlaylistSnapshot,
  normalizePlaylistTags,
  normalizeTrackSnapshot,
  requireFavoriteIdentity,
  requireFavoriteKey,
  toStringValue,
} from "./normalizers";
import { migrateDatabase } from "./schema";
import type {
  DownloadRecordInput,
  DownloadRecordItem,
  DownloadRecordRow,
  FavoritePlaylistItem,
  FavoritePlaylistRow,
  FavoriteSongItem,
  FavoriteSongRow,
  LocalLibraryScanMeta,
  LocalLibraryScanMetaRow,
  LocalSongItem,
  LocalSongRow,
  NetworkErrorDetailRow,
  NetworkErrorRecordInput,
  NetworkErrorRecordDetail,
  NetworkErrorRecordPage,
  NetworkErrorSummaryRow,
  PlayHistoryItem,
  PlayHistoryRow,
  PlaylistSnapshot,
  PlaylistSource,
  QueueSnapshot,
  QueueSnapshotRow,
  SearchHistoryItem,
  SearchHistoryRow,
  SettingRecord,
  SettingRow,
  TrackSnapshot,
  UserCloudSongItem,
  UserCloudSongRow,
  UserPlaylistItem,
  UserPlaylistRow,
  UserPlaylistTrackItem,
  UserPlaylistTrackRow,
} from "./types";

export type {
  DownloadMetadataStatus,
  DownloadRecordInput,
  DownloadRecordItem,
  DownloadRecordStatus,
  FavoritePlaylistItem,
  FavoriteSongItem,
  LocalLibraryScanMeta,
  LocalSongItem,
  NetworkErrorRecordDetail,
  NetworkErrorRecordInput,
  NetworkErrorRecordPage,
  NetworkErrorRecordSummary,
  PlayHistoryItem,
  PlaylistSnapshot,
  PlaylistSource,
  QueueSnapshot,
  SearchHistoryItem,
  SettingRecord,
  TrackSnapshot,
  UserCloudSongItem,
  UserPlaylistItem,
  UserPlaylistTrackItem,
} from "./types";

export class AppDatabase {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    migrateDatabase(this.db);
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
      value: parseJson<T>(row.value_json, null as T),
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
      .all(normalizeLimit(limit)) as SearchHistoryRow[];
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
    const normalizedTrack = normalizeTrackSnapshot(track);
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
      .all(normalizeLimit(limit)) as PlayHistoryRow[];
    return rows.map((row) => ({
      id: row.id,
      trackId: row.track_id,
      source: row.source,
      title: row.title,
      artist: row.artist,
      album: row.album,
      artwork: row.artwork,
      duration: row.duration,
      payload: parseJson<TrackSnapshot>(row.payload_json, {
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
      queue: parseJson<TrackSnapshot[]>(row.queue_json, []),
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
    return rows.map((row) => toFavoriteSong(row));
  }

  addFavoriteSong(track: TrackSnapshot) {
    const normalizedTrack = normalizeTrackSnapshot(track);
    const key = favoriteKey(normalizedTrack.source, normalizedTrack.id);
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
    this.db.prepare("DELETE FROM favorite_songs WHERE favorite_key = ?").run(favoriteKey(source, id));
    return true;
  }

  toggleFavoriteSong(track: TrackSnapshot) {
    const normalizedTrack = normalizeTrackSnapshot(track);
    if (this.containsFavoriteSong(normalizedTrack.source, normalizedTrack.id)) {
      this.removeFavoriteSong(normalizedTrack.source, normalizedTrack.id);
      return { collected: false, item: null };
    }
    return { collected: true, item: this.addFavoriteSong(normalizedTrack) };
  }

  containsFavoriteSong(source: string, id: string) {
    const row = this.db
      .prepare("SELECT favorite_key FROM favorite_songs WHERE favorite_key = ?")
      .get(favoriteKey(source, id)) as { favorite_key: string } | undefined;
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
    return rows.map((row) => toFavoritePlaylist(row));
  }

  addFavoritePlaylist(playlist: PlaylistSnapshot) {
    const normalizedPlaylist = normalizePlaylistSnapshot(playlist);
    const { id, source } = requireFavoriteIdentity(normalizedPlaylist, "歌单");
    const key = favoriteKey(source, id);
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
    requireFavoriteKey(source, id, "歌单");
    this.db.prepare("DELETE FROM favorite_playlists WHERE favorite_key = ?").run(favoriteKey(source, id));
    return true;
  }

  toggleFavoritePlaylist(playlist: PlaylistSnapshot) {
    const normalizedPlaylist = normalizePlaylistSnapshot(playlist);
    const { id, source } = requireFavoriteIdentity(normalizedPlaylist, "歌单");
    if (this.containsFavoritePlaylist(source, id)) {
      this.removeFavoritePlaylist(source, id);
      return { collected: false, item: null };
    }
    return { collected: true, item: this.addFavoritePlaylist(normalizedPlaylist) };
  }

  containsFavoritePlaylist(source: string, id: string) {
    requireFavoriteKey(source, id, "歌单");
    const row = this.db
      .prepare("SELECT favorite_key FROM favorite_playlists WHERE favorite_key = ?")
      .get(favoriteKey(source, id)) as { favorite_key: string } | undefined;
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
    return rows.map((row) => toUserPlaylist(row));
  }

  upsertUserPlaylist(playlist: PlaylistSnapshot) {
    const normalizedPlaylist = normalizePlaylistSnapshot(playlist);
    const { id, source } = requireFavoriteIdentity(normalizedPlaylist, "姝屽崟");
    const key = favoriteKey(source, id);
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
    const playlist = normalizePlaylistSnapshot({
      ...input,
      id: toStringValue(input.id) || this.createLocalPlaylistId(),
      source: "local",
      tags: normalizePlaylistTags(input.tags).slice(0, 3),
      song_count: input.song_count ?? 0,
    });
    return this.upsertUserPlaylist(playlist);
  }

  replaceUserPlaylists(source: Exclude<PlaylistSource, "local">, playlists: PlaylistSnapshot[]) {
    const normalizedPlaylists = playlists.map((playlist) =>
      normalizePlaylistSnapshot({ ...playlist, source })
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
          favoriteKey(playlist.source, playlist.id),
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
    return rows.map((row) => toUserPlaylistTrack(row));
  }

  addUserPlaylistTrack(playlistId: string, track: TrackSnapshot) {
    const normalizedPlaylistId = toStringValue(playlistId);
    if (!normalizedPlaylistId) throw new Error("添加歌曲需要歌单 ID");
    const normalizedTrack = normalizeTrackSnapshot(track);
    const trackKey = favoriteKey(normalizedTrack.source, normalizedTrack.id);
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
    return rows.map((row) => toUserCloudSong(row));
  }

  replaceUserCloudSongs(cloudSource: string, songs: TrackSnapshot[]) {
    const normalizedSource = toStringValue(cloudSource);
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
        const normalizedSong = normalizeTrackSnapshot(song);
        insert.run(
          normalizedSource,
          favoriteKey(normalizedSong.source, normalizedSong.id),
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
    return rows.map((row) => toLocalSong(row));
  }

  removeLocalSongByFilePath(filePath: string) {
    const normalizedPath = toStringValue(filePath);
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
          stringifyJson(song.payload),
          song.updatedAt
        );
      });
      replaceMeta.run(
        meta.fingerprint,
        stringifyJson(meta.directories),
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
      directories: parseJson<string[]>(row.directories_json, []),
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
        stringifyJson(input.payload),
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
    return rows.map((row) => toDownloadRecord(row));
  }

  listDownloadedSongs(): TrackSnapshot[] {
    return this.listDownloadRecords()
      .filter((record) => record.status === "completed" && Boolean(record.filePath))
      .map((record) => {
        const payload = normalizeTrackSnapshot(record.payload);
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
    const normalizedPath = toStringValue(filePath);
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
        stringifyJson(input.requestParams ?? null),
        input.httpStatus ?? null,
        input.businessCode === undefined || input.businessCode === null ? null : String(input.businessCode),
        stringifyJson(input.response ?? null),
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
    const normalizedPageSize = normalizeLimit(pageSize);
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
      items: rows.map((row) => toNetworkErrorSummary(row)),
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
    return toNetworkErrorDetail(row);
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
      .all(normalizeLimit(limit)) as NetworkErrorDetailRow[];
    return rows.map((row) => toNetworkErrorDetail(row));
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
    return row ? toDownloadRecord(row) : null;
  }

  private getFavoriteSong(source: string, id: string) {
    const row = this.db
      .prepare(
        `SELECT favorite_key, track_id, source, title, artist, album, artwork, duration, payload_json, created_at
         FROM favorite_songs
         WHERE favorite_key = ?`
      )
      .get(favoriteKey(source, id)) as FavoriteSongRow | undefined;
    return row ? toFavoriteSong(row) : null;
  }

  private getUserPlaylist(source: string, id: string) {
    const row = this.db
      .prepare(
        `SELECT playlist_key, playlist_id, source, name, description, artwork,
                song_count, play_count, collect_count, payload_json, created_at, updated_at
         FROM user_playlists
         WHERE playlist_key = ?`
      )
      .get(favoriteKey(source, id)) as UserPlaylistRow | undefined;
    return row ? toUserPlaylist(row) : null;
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
      ? normalizePlaylistSnapshot(parseJson<Partial<PlaylistSnapshot>>(existing.payload_json, {
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
      .get(favoriteKey(source, id)) as FavoritePlaylistRow | undefined;
    return row ? toFavoritePlaylist(row) : null;
  }

}
