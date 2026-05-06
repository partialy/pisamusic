import { app } from "electron";
import path from "node:path";
import Database from "better-sqlite3";
import type { PlayHistoryItem, QueueSnapshot, SearchHistoryItem } from "@shared/library";
import type { TrackSearchResult } from "@shared/music";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "@shared/settings";

type Db = Database.Database;

let db: Db | null = null;

export function getDb(): Db {
  if (!db) {
    const dbPath = path.join(app.getPath("userData"), "pisamusic-desktop.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    migrate(db);
  }
  return db;
}

function migrate(database: Db): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS search_history (
      keyword TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT NOT NULL,
      source TEXT NOT NULL,
      track_json TEXT NOT NULL,
      played_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS queue_snapshot (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      snapshot_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  database.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1')").run();
}

export function readSettings(): AppSettings {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = 'app'")
    .get() as { value: string } | undefined;
  if (!row) return DEFAULT_APP_SETTINGS;
  try {
    return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(row.value) as AppSettings) };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function writeSettings(settings: AppSettings): AppSettings {
  const normalized: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    ...settings,
    theme: {
      ...DEFAULT_APP_SETTINGS.theme,
      ...settings.theme,
      version: 1,
    },
    version: 1,
  };
  getDb()
    .prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('app', ?, ?)")
    .run(JSON.stringify(normalized), Date.now());
  return normalized;
}

export function readSearchHistory(): SearchHistoryItem[] {
  return getDb()
    .prepare("SELECT keyword, created_at as createdAt FROM search_history ORDER BY created_at DESC LIMIT 20")
    .all() as SearchHistoryItem[];
}

export function addSearchHistory(keyword: string): void {
  const value = keyword.trim();
  if (!value) return;
  getDb()
    .prepare("INSERT OR REPLACE INTO search_history (keyword, created_at) VALUES (?, ?)")
    .run(value, Date.now());
}

export function readPlayHistory(): PlayHistoryItem[] {
  const rows = getDb()
    .prepare("SELECT track_json as trackJson, played_at as playedAt FROM play_history ORDER BY played_at DESC LIMIT 100")
    .all() as { trackJson: string; playedAt: number }[];
  return rows.map((row) => ({ track: JSON.parse(row.trackJson) as TrackSearchResult, playedAt: row.playedAt }));
}

export function addPlayHistory(track: TrackSearchResult): void {
  getDb()
    .prepare("INSERT INTO play_history (track_id, source, track_json, played_at) VALUES (?, ?, ?, ?)")
    .run(track.id, track.source, JSON.stringify(track), Date.now());
}

export function readQueueSnapshot(): QueueSnapshot | null {
  const row = getDb()
    .prepare("SELECT snapshot_json as snapshotJson FROM queue_snapshot WHERE id = 1")
    .get() as { snapshotJson: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.snapshotJson) as QueueSnapshot;
}

export function writeQueueSnapshot(snapshot: QueueSnapshot): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO queue_snapshot (id, snapshot_json, updated_at) VALUES (1, ?, ?)")
    .run(JSON.stringify(snapshot), snapshot.updatedAt);
}
