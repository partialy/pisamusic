import { DatabaseSync } from "node:sqlite";
import type {
  MediaCacheEntry,
  MediaCacheEntryStatus,
  MediaCacheRepositoryStats,
  MediaCacheSegment,
} from "./types";

type EntryRow = {
  cache_key: string;
  source: string;
  song_id: string;
  quality_key: string;
  total_bytes: number;
  cached_bytes: number;
  mime_type: string;
  status: MediaCacheEntryStatus;
  hit_count: number;
  last_accessed_at: string;
  created_at: string;
  updated_at: string;
};

type SegmentRow = {
  id: number;
  cache_key: string;
  start_byte: number;
  end_byte: number;
  file_path: string;
  size_bytes: number;
  created_at: string;
  last_accessed_at: string;
};

export class MediaCacheRepository {
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

  upsertEntry(input: {
    cacheKey: string;
    source: string;
    songId: string;
    qualityKey: string;
    totalBytes?: number;
    mimeType?: string;
  }) {
    const now = new Date().toISOString();
    const mimeType = input.mimeType?.trim()
      || this.getEntry(input.cacheKey)?.mimeType
      || "application/octet-stream";
    this.db.prepare(
      `INSERT INTO media_cache_entries (
         cache_key, source, song_id, quality_key, total_bytes, mime_type,
         last_accessed_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         source = excluded.source,
         song_id = excluded.song_id,
         quality_key = excluded.quality_key,
         total_bytes = CASE
           WHEN excluded.total_bytes > 0 THEN excluded.total_bytes
           ELSE media_cache_entries.total_bytes
         END,
         mime_type = CASE
           WHEN excluded.mime_type <> '' THEN excluded.mime_type
           ELSE media_cache_entries.mime_type
         END,
         updated_at = excluded.updated_at`
    ).run(
      input.cacheKey,
      input.source,
      input.songId,
      input.qualityKey,
      normalizeBytes(input.totalBytes),
      mimeType,
      now,
      now,
      now,
    );
    return this.getEntry(input.cacheKey);
  }

  getEntry(cacheKey: string): MediaCacheEntry | null {
    const row = this.db.prepare(
      `SELECT cache_key, source, song_id, quality_key, total_bytes, cached_bytes,
              mime_type, status, hit_count, last_accessed_at, created_at, updated_at
       FROM media_cache_entries
       WHERE cache_key = ?`
    ).get(cacheKey) as EntryRow | undefined;
    return row ? mapEntry(row) : null;
  }

  findCoveringSegment(cacheKey: string, startByte: number, endByte: number) {
    const row = this.db.prepare(
      `SELECT id, cache_key, start_byte, end_byte, file_path, size_bytes,
              created_at, last_accessed_at
       FROM media_cache_segments
       WHERE cache_key = ? AND start_byte <= ? AND end_byte >= ?
       ORDER BY size_bytes ASC, id DESC
       LIMIT 1`
    ).get(cacheKey, startByte, endByte) as SegmentRow | undefined;
    return row ? mapSegment(row) : null;
  }

  findCoveringSegments(cacheKey: string, startByte: number, endByte: number) {
    const rows = this.db.prepare(
      `SELECT id, cache_key, start_byte, end_byte, file_path, size_bytes,
              created_at, last_accessed_at
       FROM media_cache_segments
       WHERE cache_key = ? AND end_byte >= ? AND start_byte <= ?
       ORDER BY start_byte ASC, end_byte DESC`
    ).all(cacheKey, startByte, endByte) as SegmentRow[];
    const candidates = rows.map(mapSegment);
    const selected: MediaCacheSegment[] = [];
    let coveredEnd = startByte - 1;
    for (const segment of candidates) {
      if (segment.endByte <= coveredEnd) continue;
      if (segment.startByte > coveredEnd + 1) break;
      selected.push(segment);
      coveredEnd = segment.endByte;
      if (coveredEnd >= endByte) return selected;
    }
    return [];
  }

  recordSegment(input: {
    cacheKey: string;
    startByte: number;
    endByte: number;
    filePath: string;
    sizeBytes: number;
    totalBytes?: number;
    mimeType?: string;
  }) {
    if (input.startByte < 0 || input.endByte < input.startByte || input.sizeBytes <= 0) {
      throw new Error("缓存分片区间无效");
    }
    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(
        `INSERT INTO media_cache_segments (
           cache_key, start_byte, end_byte, file_path, size_bytes, created_at, last_accessed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(cache_key, start_byte, end_byte) DO UPDATE SET
           file_path = excluded.file_path,
           size_bytes = excluded.size_bytes,
           last_accessed_at = excluded.last_accessed_at`
      ).run(
        input.cacheKey,
        input.startByte,
        input.endByte,
        input.filePath,
        input.sizeBytes,
        now,
        now,
      );
      const segments = this.listSegments(input.cacheKey);
      const totalBytes = normalizeBytes(input.totalBytes) || this.getEntry(input.cacheKey)?.totalBytes || 0;
      const cachedBytes = segments.reduce((total, segment) => total + segment.sizeBytes, 0);
      const status: MediaCacheEntryStatus = isCompleteCoverage(segments, totalBytes) ? "ready" : "partial";
      this.db.prepare(
        `UPDATE media_cache_entries
         SET total_bytes = ?, cached_bytes = ?, mime_type = ?, status = ?, updated_at = ?
         WHERE cache_key = ?`
      ).run(
        totalBytes,
        cachedBytes,
        input.mimeType?.trim() || this.getEntry(input.cacheKey)?.mimeType || "application/octet-stream",
        status,
        now,
        input.cacheKey,
      );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.getEntry(input.cacheKey);
  }

  touchHit(cacheKey: string) {
    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE media_cache_entries
       SET hit_count = hit_count + 1, last_accessed_at = ?, updated_at = ?
       WHERE cache_key = ?`
    ).run(now, now, cacheKey);
    this.db.prepare(
      `UPDATE media_cache_segments SET last_accessed_at = ? WHERE cache_key = ?`
    ).run(now, cacheKey);
  }

  getStats(): MediaCacheRepositoryStats {
    const row = this.db.prepare(
      `SELECT COALESCE(SUM(cached_bytes), 0) AS used_bytes,
              COUNT(*) AS entry_count,
              COALESCE(SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END), 0) AS ready_count
       FROM media_cache_entries`
    ).get() as { used_bytes: number; entry_count: number; ready_count: number };
    return {
      usedBytes: Number(row.used_bytes) || 0,
      entryCount: Number(row.entry_count) || 0,
      readyCount: Number(row.ready_count) || 0,
    };
  }

  listEvictionCandidates(excludedCacheKeys: string[] = []) {
    const rows = this.db.prepare(
      `SELECT cache_key, source, song_id, quality_key, total_bytes, cached_bytes,
              mime_type, status, hit_count, last_accessed_at, created_at, updated_at
       FROM media_cache_entries
       ORDER BY last_accessed_at ASC, created_at ASC`
    ).all() as EntryRow[];
    const excluded = new Set(excludedCacheKeys);
    return rows.map(mapEntry).filter((entry) => !excluded.has(entry.cacheKey));
  }

  deleteEntry(cacheKey: string) {
    const paths = this.listSegments(cacheKey).map((segment) => segment.filePath);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM media_cache_segments WHERE cache_key = ?").run(cacheKey);
      this.db.prepare("DELETE FROM media_cache_entries WHERE cache_key = ?").run(cacheKey);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return paths;
  }

  clearAll() {
    const rows = this.db.prepare("SELECT file_path FROM media_cache_segments").all() as { file_path: string }[];
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.exec("DELETE FROM media_cache_segments; DELETE FROM media_cache_entries;");
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return rows.map((row) => row.file_path);
  }

  private listSegments(cacheKey: string) {
    const rows = this.db.prepare(
      `SELECT id, cache_key, start_byte, end_byte, file_path, size_bytes,
              created_at, last_accessed_at
       FROM media_cache_segments
       WHERE cache_key = ?
       ORDER BY start_byte ASC, end_byte ASC`
    ).all(cacheKey) as SegmentRow[];
    return rows.map(mapSegment);
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS media_cache_entries (
        cache_key TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        song_id TEXT NOT NULL,
        quality_key TEXT NOT NULL,
        total_bytes INTEGER NOT NULL DEFAULT 0,
        cached_bytes INTEGER NOT NULL DEFAULT 0,
        mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        status TEXT NOT NULL DEFAULT 'partial' CHECK (status IN ('partial', 'ready')),
        hit_count INTEGER NOT NULL DEFAULT 0,
        last_accessed_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS media_cache_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT NOT NULL,
        start_byte INTEGER NOT NULL,
        end_byte INTEGER NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL,
        UNIQUE(cache_key, start_byte, end_byte),
        FOREIGN KEY(cache_key) REFERENCES media_cache_entries(cache_key) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_media_cache_entries_lru
        ON media_cache_entries(last_accessed_at ASC, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_media_cache_segments_range
        ON media_cache_segments(cache_key, start_byte, end_byte);
    `);
  }
}

function mapEntry(row: EntryRow): MediaCacheEntry {
  return {
    cacheKey: row.cache_key,
    source: row.source,
    songId: row.song_id,
    qualityKey: row.quality_key,
    totalBytes: row.total_bytes,
    cachedBytes: row.cached_bytes,
    mimeType: row.mime_type,
    status: row.status,
    hitCount: row.hit_count,
    lastAccessedAt: row.last_accessed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSegment(row: SegmentRow): MediaCacheSegment {
  return {
    id: row.id,
    cacheKey: row.cache_key,
    startByte: row.start_byte,
    endByte: row.end_byte,
    filePath: row.file_path,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

function normalizeBytes(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function isCompleteCoverage(segments: MediaCacheSegment[], totalBytes: number) {
  if (!segments.length || totalBytes <= 0 || segments[0].startByte !== 0) return false;
  let coveredEnd = segments[0].endByte;
  for (const segment of segments.slice(1)) {
    if (segment.startByte > coveredEnd + 1) return false;
    coveredEnd = Math.max(coveredEnd, segment.endByte);
  }
  return coveredEnd >= totalBytes - 1;
}
