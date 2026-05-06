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

  addPlayHistory(track: TrackSnapshot) {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO play_history (
           track_id, source, title, artist, album, artwork, duration, payload_json, played_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        track.id,
        track.source,
        track.name ?? "",
        track.singer ?? "",
        track.album ?? "",
        track.cover ?? "",
        track.duration ?? 0,
        JSON.stringify(track),
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
    `);
    this.db
      .prepare(
        `INSERT INTO schema_migrations (version, name, applied_at)
         VALUES (1, 'initial local library schema', ?)
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
}
