import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = path.resolve(process.cwd(), "data/pm.db");

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS device_info (
    id                  TEXT        PRIMARY KEY,
    fingerprint         TEXT        NOT NULL UNIQUE,
    device_name         TEXT        NOT NULL,
    brand               TEXT        NOT NULL,
    model               TEXT        NOT NULL,
    os_version          TEXT        NOT NULL,
    sdk_version         INTEGER     NOT NULL,
    app_version         TEXT        NOT NULL,
    app_version_code    INTEGER     NOT NULL,
    locked              INTEGER     NOT NULL DEFAULT 0,
    lock_end_time       INTEGER     DEFAULT NULL,
    first_seen_at       INTEGER     NOT NULL,
    last_active_at      INTEGER     NOT NULL,
    first_seen_ip       TEXT,
    last_seen_ip        TEXT,
    last_country_code   TEXT,
    last_timezone       TEXT,
    last_locale         TEXT,
    extra_info          TEXT        NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_device_info_last_active ON device_info (last_active_at);
CREATE INDEX IF NOT EXISTS idx_device_info_brand_model ON device_info (brand, model);

CREATE TABLE IF NOT EXISTS desktop_device_info (
    id                  TEXT        PRIMARY KEY,
    fingerprint         TEXT        NOT NULL UNIQUE,
    device_name         TEXT        NOT NULL,
    hostname            TEXT        NOT NULL,
    os_name             TEXT        NOT NULL,
    os_version          TEXT        NOT NULL,
    platform            TEXT        NOT NULL,
    arch                TEXT        NOT NULL,
    app_version         TEXT        NOT NULL,
    locked              INTEGER     NOT NULL DEFAULT 0,
    lock_end_time       INTEGER     DEFAULT NULL,
    first_seen_at       INTEGER     NOT NULL,
    last_active_at      INTEGER     NOT NULL,
    first_seen_ip       TEXT,
    last_seen_ip        TEXT,
    extra_info          TEXT        NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_desktop_device_info_last_active ON desktop_device_info (last_active_at);
CREATE INDEX IF NOT EXISTS idx_desktop_device_info_platform_arch ON desktop_device_info (platform, arch);

CREATE TABLE IF NOT EXISTS app_settings (
    id                      INTEGER     PRIMARY KEY CHECK (id = 1),
    app_available           INTEGER     NOT NULL DEFAULT 1,
    unavailable_reason      TEXT        NOT NULL DEFAULT '',
    bootstrap_version       TEXT        NOT NULL DEFAULT 'v1.0.0',
    bootstrap_updated_at    INTEGER     NOT NULL DEFAULT 0,
    gateway_secret          TEXT        NOT NULL DEFAULT 'partialypartialypartialypartialy',
    gateway_as              TEXT        NOT NULL DEFAULT 'yixivip',
    updater_enabled         INTEGER     NOT NULL DEFAULT 1,
    updater_feed_base_url   TEXT        NOT NULL DEFAULT 'https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64',
    updater_check_startup   INTEGER     NOT NULL DEFAULT 1,
    updater_startup_delay   INTEGER     NOT NULL DEFAULT 15000,
    created_at              INTEGER     NOT NULL,
    updated_at              INTEGER     NOT NULL
);

CREATE TABLE IF NOT EXISTS bootstrap_endpoints (
    key         TEXT    PRIMARY KEY,
    value       TEXT    NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_pages (
    code        TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS about_config (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    app_name        TEXT    NOT NULL,
    website_label   TEXT    NOT NULL,
    website_url     TEXT    NOT NULL,
    description     TEXT    NOT NULL,
    team            TEXT    NOT NULL,
    copyright       TEXT    NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS current_update (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    latest_version  TEXT    NOT NULL,
    update_time     TEXT    NOT NULL,
    force_update    INTEGER NOT NULL DEFAULT 0,
    download_url    TEXT    NOT NULL,
    official_url    TEXT    NOT NULL,
    update_content  TEXT    NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS release_info (
    platform        TEXT    PRIMARY KEY,
    latest_version  TEXT    NOT NULL,
    update_time     TEXT    NOT NULL,
    force_update    INTEGER NOT NULL DEFAULT 0,
    download_url    TEXT    NOT NULL,
    official_url    TEXT    NOT NULL,
    update_content  TEXT    NOT NULL,
    platform_label  TEXT    NOT NULL,
    file_size_text  TEXT    NOT NULL,
    available       INTEGER NOT NULL DEFAULT 0,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS discover_config (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    url             TEXT    NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dynamic_configs (
    id          TEXT    PRIMARY KEY,
    type        TEXT    NOT NULL,
    content     TEXT    NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dynamic_configs_updated_at ON dynamic_configs (updated_at DESC, id ASC);

CREATE TABLE IF NOT EXISTS update_history (
    id              TEXT    PRIMARY KEY,
    platform        TEXT    NOT NULL DEFAULT 'android',
    version         TEXT    NOT NULL,
    update_time     TEXT    NOT NULL,
    force_update    INTEGER NOT NULL DEFAULT 0,
    download_url    TEXT    NOT NULL,
    official_url    TEXT    NOT NULL,
    update_content  TEXT    NOT NULL,
    release_file_id TEXT,
    created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS release_files (
    id              TEXT    PRIMARY KEY,
    history_id      TEXT,
    platform        TEXT    NOT NULL,
    provider        TEXT    NOT NULL DEFAULT 'qiniu',
    bucket          TEXT    NOT NULL,
    object_key      TEXT    NOT NULL,
    hash            TEXT    NOT NULL DEFAULT '',
    file_name       TEXT    NOT NULL,
    mime_type       TEXT    NOT NULL DEFAULT '',
    file_size       INTEGER NOT NULL DEFAULT 0,
    download_url    TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'uploaded',
    created_at      INTEGER NOT NULL,
    deleted_at      INTEGER,
    FOREIGN KEY (history_id) REFERENCES update_history(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_release_files_provider_key ON release_files (provider, bucket, object_key);
CREATE INDEX IF NOT EXISTS idx_release_files_history ON release_files (history_id);

CREATE TABLE IF NOT EXISTS desktop_update_assets (
    id              TEXT    PRIMARY KEY,
    version         TEXT    NOT NULL,
    platform        TEXT    NOT NULL DEFAULT 'win32',
    arch            TEXT    NOT NULL DEFAULT 'x64',
    file_type       TEXT    NOT NULL,
    provider        TEXT    NOT NULL DEFAULT 'qiniu',
    bucket          TEXT    NOT NULL,
    object_key      TEXT    NOT NULL,
    hash            TEXT    NOT NULL DEFAULT '',
    file_name       TEXT    NOT NULL,
    mime_type       TEXT    NOT NULL DEFAULT '',
    file_size       INTEGER NOT NULL DEFAULT 0,
    status          TEXT    NOT NULL DEFAULT 'uploaded',
    active          INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    deleted_at      INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_desktop_update_assets_provider_key ON desktop_update_assets (provider, bucket, object_key);
CREATE INDEX IF NOT EXISTS idx_desktop_update_assets_active ON desktop_update_assets (platform, arch, active, file_name);
CREATE INDEX IF NOT EXISTS idx_desktop_update_assets_version ON desktop_update_assets (platform, arch, version);

CREATE TABLE IF NOT EXISTS announcements (
    id                  TEXT    PRIMARY KEY,
    content             TEXT    NOT NULL,
    time                TEXT    NOT NULL,
    publisher           TEXT    NOT NULL,
    confirm_text        TEXT    NOT NULL,
    show_every_time     INTEGER NOT NULL DEFAULT 0,
    show_goto_button    INTEGER NOT NULL DEFAULT 0,
    goto_url            TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS encryption_plaintext_paths (
    path        TEXT    PRIMARY KEY,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_users (
    username       TEXT    PRIMARY KEY,
    password_hash  TEXT    NOT NULL,
    updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
    id             TEXT    PRIMARY KEY,
    created_at     TEXT    NOT NULL,
    feedback_type  TEXT    NOT NULL,
    description    TEXT    NOT NULL,
    contact        TEXT,
    device_json    TEXT    NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS feedback_images (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback_id  TEXT    NOT NULL,
    image_path   TEXT    NOT NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feedback_images_feedback_id ON feedback_images (feedback_id);

CREATE TABLE IF NOT EXISTS users (
    id              TEXT    PRIMARY KEY,
    email           TEXT    NOT NULL UNIQUE,
    username        TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,
    avatar          TEXT    NOT NULL DEFAULT '',
    sync_version    INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    last_login_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

CREATE TABLE IF NOT EXISTS user_sync_items (
    user_id           TEXT    NOT NULL,
    item_type         TEXT    NOT NULL,
    item_key          TEXT    NOT NULL,
    payload_json      TEXT    NOT NULL DEFAULT '{}',
    deleted           INTEGER NOT NULL DEFAULT 0,
    last_op_id        TEXT    NOT NULL DEFAULT '',
    last_device_id    TEXT    NOT NULL DEFAULT '',
    client_updated_at TEXT    NOT NULL DEFAULT '',
    server_version    INTEGER NOT NULL,
    server_updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_type, item_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_sync_items_version ON user_sync_items (user_id, server_version);

CREATE TABLE IF NOT EXISTS user_sync_change_log (
    user_id           TEXT    NOT NULL,
    version           INTEGER NOT NULL,
    op_id             TEXT    NOT NULL,
    device_id         TEXT    NOT NULL,
    item_type         TEXT    NOT NULL,
    item_key          TEXT    NOT NULL,
    action            TEXT    NOT NULL,
    payload_json      TEXT    NOT NULL DEFAULT '{}',
    client_updated_at TEXT    NOT NULL DEFAULT '',
    server_updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, version),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_sync_change_log_version ON user_sync_change_log (user_id, version);

CREATE TABLE IF NOT EXISTS user_sync_applied_ops (
    user_id           TEXT    NOT NULL,
    device_id         TEXT    NOT NULL,
    op_id             TEXT    NOT NULL,
    server_version    INTEGER NOT NULL,
    applied_at        INTEGER NOT NULL,
    PRIMARY KEY (user_id, device_id, op_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

function getColumnNames(db: DatabaseSync, table: string): Set<string> {
  const stmt = db.prepare(`PRAGMA table_info(${table})`);
  const rows = stmt.all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function migrateDeviceInfo(db: DatabaseSync) {
  const cols = getColumnNames(db, "device_info");
  const add = (name: string, decl: string) => {
    if (!cols.has(name)) {
      db.exec(`ALTER TABLE device_info ADD COLUMN ${name} ${decl}`);
    }
  };
  add("fingerprint", "TEXT");
  add("first_seen_ip", "TEXT");
  add("last_seen_ip", "TEXT");
  add("last_country_code", "TEXT");
  add("last_timezone", "TEXT");
  add("last_locale", "TEXT");
  if (!cols.has("extra_info")) {
    db.exec(`ALTER TABLE device_info ADD COLUMN extra_info TEXT NOT NULL DEFAULT '{}'`);
  }
  db.prepare(
    `UPDATE device_info SET fingerprint = id WHERE fingerprint IS NULL OR fingerprint = ''`,
  ).run();
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_device_info_fingerprint ON device_info(fingerprint)`);
}

function migrateUpdateHistory(db: DatabaseSync) {
  const cols = getColumnNames(db, "update_history");
  if (!cols.has("platform")) {
    db.exec(`ALTER TABLE update_history ADD COLUMN platform TEXT NOT NULL DEFAULT 'android'`);
  }
  if (!cols.has("release_file_id")) {
    db.exec(`ALTER TABLE update_history ADD COLUMN release_file_id TEXT`);
  }
}

function migrateAppSettings(db: DatabaseSync) {
  const cols = getColumnNames(db, "app_settings");
  const add = (name: string, decl: string) => {
    if (!cols.has(name)) {
      db.exec(`ALTER TABLE app_settings ADD COLUMN ${name} ${decl}`);
    }
  };
  add("updater_enabled", "INTEGER NOT NULL DEFAULT 1");
  add("updater_feed_base_url", "TEXT NOT NULL DEFAULT 'https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64'");
  add("updater_check_startup", "INTEGER NOT NULL DEFAULT 1");
  add("updater_startup_delay", "INTEGER NOT NULL DEFAULT 15000");
}

function migrateDynamicConfigs(db: DatabaseSync) {
  const cols = getColumnNames(db, "dynamic_configs");
  const add = (name: string, decl: string) => {
    if (!cols.has(name)) {
      db.exec(`ALTER TABLE dynamic_configs ADD COLUMN ${name} ${decl}`);
    }
  };
  add("type", "TEXT NOT NULL DEFAULT 'string'");
  add("content", "TEXT NOT NULL DEFAULT ''");
  add("created_at", "INTEGER NOT NULL DEFAULT 0");
  add("updated_at", "INTEGER NOT NULL DEFAULT 0");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_dynamic_configs_updated_at ON dynamic_configs (updated_at DESC, id ASC)`);
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    DROP TABLE IF EXISTS sync_applied_ops;
    DROP TABLE IF EXISTS sync_change_log;
    DROP TABLE IF EXISTS sync_items;
    DROP TABLE IF EXISTS sync_devices;
    DROP TABLE IF EXISTS sync_spaces;
  `);
  db.exec(CREATE_SQL);
  migrateDeviceInfo(db);
  migrateAppSettings(db);
  migrateUpdateHistory(db);
  migrateDynamicConfigs(db);
}

let singleton: DatabaseSync | null = null;

export function getAppDb(): DatabaseSync {
  if (singleton) return singleton;
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  initSchema(db);
  singleton = db;
  return db;
}
