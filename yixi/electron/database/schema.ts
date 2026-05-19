import { DatabaseSync } from "node:sqlite";

export function migrateDatabase(db: DatabaseSync) {
  db.exec(`
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
  ensureDownloadRecordColumns(db);
  db
    .prepare(
      `INSERT INTO schema_migrations (version, name, applied_at)
       VALUES (1, 'initial local library schema', ?)
       ON CONFLICT(version) DO NOTHING`
    )
    .run(new Date().toISOString());
  db
    .prepare(
      `INSERT INTO schema_migrations (version, name, applied_at)
       VALUES (3, 'local library songs schema', ?)
       ON CONFLICT(version) DO NOTHING`
    )
    .run(new Date().toISOString());
  db
    .prepare(
      `INSERT INTO schema_migrations (version, name, applied_at)
       VALUES (2, 'network error records schema', ?)
       ON CONFLICT(version) DO NOTHING`
    )
    .run(new Date().toISOString());
  db
    .prepare(
      `INSERT INTO schema_migrations (version, name, applied_at)
       VALUES (4, 'download records schema', ?)
       ON CONFLICT(version) DO NOTHING`
    )
    .run(new Date().toISOString());
}

function ensureDownloadRecordColumns(db: DatabaseSync) {
  const rows = db.prepare("PRAGMA table_info(download_records)").all() as { name: string }[];
  const columns = new Set(rows.map((row) => row.name));
  const additions: Record<string, string> = {
    status: "ALTER TABLE download_records ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'",
    total_bytes: "ALTER TABLE download_records ADD COLUMN total_bytes INTEGER NOT NULL DEFAULT 0",
    received_bytes: "ALTER TABLE download_records ADD COLUMN received_bytes INTEGER NOT NULL DEFAULT 0",
    completed_at: "ALTER TABLE download_records ADD COLUMN completed_at TEXT NOT NULL DEFAULT ''",
  };
  Object.entries(additions).forEach(([column, sql]) => {
    if (!columns.has(column)) db.exec(sql);
  });
}
