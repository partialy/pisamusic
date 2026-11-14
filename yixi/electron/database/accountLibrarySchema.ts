import { DatabaseSync } from "node:sqlite";

/** V9 只复制历史关系到未关联区；不猜测登录账号，原表保留用于回溯。 */
export function migrateAccountLibrary(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE version = 9").get()) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE account_library_items (
        account_id TEXT NOT NULL DEFAULT '', item_type TEXT NOT NULL,
        item_key TEXT NOT NULL, payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        PRIMARY KEY(account_id, item_type, item_key)
      );
      CREATE INDEX idx_account_library_updated ON account_library_items(account_id,item_type,updated_at DESC);
      CREATE TABLE account_playlist_tracks (
        account_id TEXT NOT NULL DEFAULT '', playlist_id TEXT NOT NULL,
        track_key TEXT NOT NULL, payload_json TEXT NOT NULL,
        sort_order INTEGER DEFAULT NULL CHECK(sort_order IS NULL OR sort_order >= 0),
        fallback_order INTEGER NOT NULL DEFAULT 0, server_version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        PRIMARY KEY(account_id,playlist_id,track_key)
      );
      CREATE INDEX idx_account_playlist_order ON account_playlist_tracks(account_id,playlist_id,sort_order,server_version,track_key);
      CREATE TABLE local_sync_device_map (
        device_identity TEXT PRIMARY KEY, device_scope_uuid TEXT NOT NULL UNIQUE
      );
      CREATE TABLE local_sync_track_map (
        local_song_key TEXT PRIMARY KEY, sync_track_id TEXT NOT NULL UNIQUE,
        device_scope_uuid TEXT NOT NULL, local_song_uuid TEXT NOT NULL
      );
      CREATE TABLE local_sync_track_alias (
        local_song_key TEXT PRIMARY KEY,
        canonical_song_key TEXT NOT NULL REFERENCES local_sync_track_map(local_song_key)
      );
      CREATE INDEX idx_local_sync_alias_target ON local_sync_track_alias(canonical_song_key);
      CREATE INDEX idx_local_sync_track_scope ON local_sync_track_map(device_scope_uuid);
      ALTER TABLE sync_outbox ADD COLUMN account_id TEXT NOT NULL DEFAULT '';
      CREATE INDEX idx_sync_outbox_account ON sync_outbox(account_id,created_at,id);
      INSERT INTO account_library_items SELECT '', 'favorite_song', favorite_key, payload_json, created_at, created_at FROM favorite_songs;
      INSERT INTO account_library_items SELECT '', 'favorite_playlist', favorite_key, payload_json, created_at, created_at FROM favorite_playlists;
      INSERT INTO account_library_items SELECT '', 'user_playlist', playlist_key, payload_json, created_at, updated_at FROM user_playlists;
      INSERT INTO account_playlist_tracks SELECT '', playlist_id, track_key, payload_json, id, id, 0, created_at FROM user_playlist_tracks;
    `);
    db.prepare("INSERT INTO schema_migrations VALUES (9, 'account library and stable local sync identity', ?)").run(new Date().toISOString());
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
