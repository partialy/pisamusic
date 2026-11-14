import { AccountLibraryRepository } from "./accountLibraryRepository";
import type { LibraryScope, SyncOperationInput } from "./accountLibraryPolicy";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { normalizeLimit, parseJson, stringifyJson } from "./json";
import {
  toDownloadRecord,
  toLocalSong,
  toNetworkErrorDetail,
  toNetworkErrorSummary,
  toUserCloudSong,
} from "./mappers";
import {
  favoriteKey,
  normalizeTrackSnapshot,
  toStringValue,
} from "./normalizers";
import { migrateDatabase } from "./schema";
import { sanitizeNetworkErrorInput } from "../faultReport/sanitizer";
import { ListeningStore } from "../listening/listeningStore";
import type {
  DownloadRecordInput,
  DownloadRecordItem,
  DownloadRecordRow,
  LocalLibraryScanMeta,
  LocalLibraryScanMetaRow,
  LocalSongItem,
  LocalSongRow,
  NetworkErrorDetailRow,
  NetworkErrorRecordInput,
  NetworkErrorRecordDetail,
  NetworkErrorRecordPage,
  DesktopFaultReportStats,
  PendingNetworkErrorRecord,
  NetworkErrorSummaryRow,
  PlayHistoryItem,
  PlayHistoryRow,
  PlaylistSnapshot,
  PlaylistSource,
  QueueSnapshot,
  QueueSnapshotRow,
  SearchHistoryItem,
  SearchHistoryRow,
  ServiceDiscoveryCacheRecord,
  ServiceDiscoveryCacheRow,
  SettingRecord,
  SettingRow,
  TrackSnapshot,
  UserCloudSongItem,
  UserCloudSongRow,
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
  DesktopFaultReportStats,
  PendingNetworkErrorRecord,
  PlayHistoryItem,
  PlaylistSnapshot,
  PlaylistSource,
  QueueSnapshot,
  SearchHistoryItem,
  SettingRecord,
  ServiceDiscoveryCacheRecord,
  TrackSnapshot,
  UserCloudSongItem,
  UserPlaylistItem,
  UserPlaylistTrackItem,
} from "./types";

export class AppDatabase {
  private readonly db: DatabaseSync;
  public readonly listening: ListeningStore;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    migrateDatabase(this.db);
    this.listening = new ListeningStore(this.db);
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

  getServiceDiscoveryCache<T = unknown>(): ServiceDiscoveryCacheRecord<T> | null {
    const row = this.db
      .prepare(
        `SELECT document_json, config_version, updated_at
         FROM service_discovery_cache
         WHERE id = 1`
      )
      .get() as ServiceDiscoveryCacheRow | undefined;
    if (!row) return null;
    return {
      document: parseJson<T>(row.document_json, null as T),
      configVersion: row.config_version,
      updatedAt: row.updated_at,
    };
  }

  setServiceDiscoveryCache(document: unknown, configVersion: number) {
    if (!Number.isInteger(configVersion) || configVersion <= 0) {
      throw new Error("服务发现缓存版本必须是正整数");
    }
    const result = this.db
      .prepare(
        `INSERT INTO service_discovery_cache (
           id, document_json, config_version, updated_at
         ) VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           document_json = excluded.document_json,
           config_version = excluded.config_version,
           updated_at = excluded.updated_at
         WHERE excluded.config_version >= service_discovery_cache.config_version`
      )
      .run(JSON.stringify(document), configVersion, new Date().toISOString());
    return Number(result.changes) > 0;
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

  /** 兼容 API 固定使用未关联区；新 IPC/sync 使用 main 捕获的显式 scope。 */
  accountLibrary(scope: LibraryScope) { return new AccountLibraryRepository(this.db, scope); }
  private get unassociatedLibrary() { return this.accountLibrary({ accountId: "", deviceIdentity: "" }); }
  listFavoriteSongs() { return this.unassociatedLibrary.listFavoriteSongs(); }
  addFavoriteSong(track: TrackSnapshot, fromSync = false) { return this.unassociatedLibrary.addFavoriteSong(track, fromSync); }
  removeFavoriteSong(source: string, id: string) { return this.unassociatedLibrary.removeFavoriteSong(source, id); }
  toggleFavoriteSong(track: TrackSnapshot) { return this.unassociatedLibrary.toggleFavoriteSong(track); }
  containsFavoriteSong(source: string, id: string) { return this.unassociatedLibrary.containsFavoriteSong(source, id); }
  listFavoritePlaylists() { return this.unassociatedLibrary.listFavoritePlaylists(); }
  addFavoritePlaylist(playlist: PlaylistSnapshot) { return this.unassociatedLibrary.addFavoritePlaylist(playlist); }
  removeFavoritePlaylist(source: string, id: string) { return this.unassociatedLibrary.removeFavoritePlaylist(source, id); }
  toggleFavoritePlaylist(playlist: PlaylistSnapshot) { return this.unassociatedLibrary.toggleFavoritePlaylist(playlist); }
  containsFavoritePlaylist(source: string, id: string) { return this.unassociatedLibrary.containsFavoritePlaylist(source, id); }
  listUserPlaylists(source?: PlaylistSource | "all") { return this.unassociatedLibrary.listUserPlaylists(source); }
  upsertUserPlaylist(playlist: PlaylistSnapshot) { return this.unassociatedLibrary.upsertUserPlaylist(playlist); }
  replaceUserPlaylists(source: Exclude<PlaylistSource, "local">, playlists: PlaylistSnapshot[]) { return this.unassociatedLibrary.replaceUserPlaylists(source, playlists); }
  listUserPlaylistTracks(playlistId: string) { return this.unassociatedLibrary.listUserPlaylistTracks(playlistId); }
  addUserPlaylistTrack(playlistId: string, track: TrackSnapshot) { return this.unassociatedLibrary.addUserPlaylistTrack(playlistId, track); }
  removeUserPlaylist(source: string, id: string) { return this.unassociatedLibrary.removeUserPlaylist(source, id); }
  removeUserPlaylistTrack(playlistId: string, source: string, id: string) { return this.unassociatedLibrary.removeUserPlaylistTrack(playlistId, source, id); }
  enqueueSyncOp(input: SyncOperationInput) { return this.unassociatedLibrary.enqueueSyncOp(input); }
  listSyncOutbox(limit = 200) { return this.unassociatedLibrary.listSyncOutbox(limit); }
  listPendingSyncKeys() { return this.unassociatedLibrary.listPendingSyncKeys(); }
  createUserPlaylist(input: Partial<PlaylistSnapshot>) { return this.unassociatedLibrary.createUserPlaylist(input).playlist; }

  applySyncTransaction<T>(apply: () => T): T {
    this.db.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      const result = apply();
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  removeSyncOps(opIds: string[]) { return this.unassociatedLibrary.removeSyncOps(opIds); }
  clearSyncOutbox() { return this.unassociatedLibrary.clearSyncOutbox(); }

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
    const clientLogId = randomUUID();
    const sanitized = sanitizeNetworkErrorInput(input);
    this.db
      .prepare(
        `INSERT INTO network_error_records (
           client_log_id, request_scope, method, request_url, request_path, request_params_json,
           http_status, business_code, response_json, error_message, created_at, is_uploaded, uploaded_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`
      )
      .run(
        clientLogId,
        sanitized.requestScope,
        sanitized.method,
        sanitized.requestUrl,
        sanitized.requestPath,
        stringifyJson(sanitized.requestParams ?? null),
        sanitized.httpStatus ?? null,
        sanitized.businessCode === undefined || sanitized.businessCode === null ? null : String(sanitized.businessCode),
        stringifyJson(sanitized.response ?? null),
        sanitized.errorMessage,
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
    return clientLogId;
  }

  getNetworkErrorFaultStats(): DesktopFaultReportStats {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const row = this.db
      .prepare(
        `SELECT
           COUNT(*) AS total_count,
           SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS recent_count,
           SUM(CASE WHEN is_uploaded = 0 THEN 1 ELSE 0 END) AS pending_count,
           MAX(created_at) AS latest_at,
           MAX(uploaded_at) AS last_reported_at
         FROM network_error_records`
      )
      .get(cutoff) as {
        total_count: number;
        recent_count: number | null;
        pending_count: number | null;
        latest_at: string | null;
        last_reported_at: string | null;
      };
    return {
      totalCount: Number(row.total_count) || 0,
      recentSevenDaysCount: Number(row.recent_count) || 0,
      pendingCount: Number(row.pending_count) || 0,
      latestOccurredAt: toTimestamp(row.latest_at),
      lastReportedAt: toTimestamp(row.last_reported_at),
    };
  }

  listPendingNetworkErrors(limit = 300): PendingNetworkErrorRecord[] {
    const safeLimit = Math.min(300, Math.max(1, Math.floor(Number(limit) || 300)));
    const rows = this.db
      .prepare(
        `SELECT id, client_log_id, request_scope, method, request_url, request_path,
                request_params_json, http_status, business_code, response_json,
                error_message, created_at, is_uploaded, uploaded_at
         FROM network_error_records
         WHERE is_uploaded = 0
         ORDER BY created_at ASC, id ASC
         LIMIT ?`
      )
      .all(safeLimit) as NetworkErrorDetailRow[];
    return rows.map((row) => ({
      ...toNetworkErrorDetail(row),
      clientLogId: row.client_log_id ?? "",
    })).filter((row) => Boolean(row.clientLogId));
  }

  markNetworkErrorsUploaded(clientLogIds: string[], uploadedAt = new Date().toISOString()) {
    const ids = [...new Set(clientLogIds.filter(Boolean))];
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(",");
    const result = this.db
      .prepare(
        `UPDATE network_error_records
         SET is_uploaded = 1, uploaded_at = ?
         WHERE client_log_id IN (${placeholders})`
      )
      .run(uploadedAt, ...ids);
    return Number(result.changes) || 0;
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

  getFavoriteSong(source: string, id: string) {
    return this.listFavoriteSongs().find(item => item.source === source && item.trackId === id) ?? null;
  }

}

function toTimestamp(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
