import { PLAYLIST_COVER_SQL } from "./schema/playlistCoverSchema";
import { SIDEBAR_MENU_SQL } from "./schema/sidebarMenuSchema";
import { SONG_DOWNLOAD_SQL } from "./schema/songDownloadSchema";
import { APP_SHARE_TRACKING_SQL } from "./appShareTrackingSchema";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runPostSchemaMigrations, runPreSchemaMigrations } from "./schema/sqlite/legacyMigrations";
import { AsyncLocalStorage } from "node:async_hooks";
import { type DbClient, type DbTransaction } from "./core/types";
import { createDatabase, readDatabaseConfig } from "./core/createDatabase";
import { SqliteClient } from "./core/sqliteClient";
import { prepareDatabaseSchema, initializeSqliteSchemaMetadata } from "./schema/runner";

function getDbPath(): string {
  const configuredPath = String(process.env.PISA_APP_DB_PATH ?? "").trim();
  return path.resolve(configuredPath || path.join(process.cwd(), "data/pm.db"));
}

export const CREATE_SQL = `
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
    email_service_url       TEXT        NOT NULL DEFAULT 'https://gateway.partialy.cn/auth-service/api/send/email',
    email_provider          TEXT        NOT NULL DEFAULT 'aliyun',
    email_providers_json    TEXT        NOT NULL DEFAULT '[{"code":"aliyun","name":"阿里云"},{"code":"resend","name":"Resend"}]',
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
    version     INTEGER NOT NULL DEFAULT 1,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_share_config (
 id INTEGER PRIMARY KEY CHECK (id=1), config_json TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_share_icon_uploads (
 object_key TEXT PRIMARY KEY, input_json TEXT NOT NULL, expires_at INTEGER NOT NULL, file_id TEXT
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
    created_at      INTEGER NOT NULL,
    deleted_at      INTEGER
);

CREATE TABLE IF NOT EXISTS file_records (
    id              TEXT    PRIMARY KEY,
    usage_type      TEXT    NOT NULL,
    owner_type      TEXT    NOT NULL DEFAULT 'system',
    owner_user_id   TEXT,
    owner_snapshot_json TEXT NOT NULL DEFAULT '{}',
    platform        TEXT    NOT NULL DEFAULT '',
    version         TEXT    NOT NULL DEFAULT '',
    asset_type      TEXT    NOT NULL DEFAULT '',
    provider        TEXT    NOT NULL DEFAULT 'qiniu',
    bucket          TEXT    NOT NULL,
    object_key      TEXT    NOT NULL,
    hash            TEXT    NOT NULL DEFAULT '',
    file_name       TEXT    NOT NULL,
    mime_type       TEXT    NOT NULL DEFAULT '',
    file_size       INTEGER NOT NULL DEFAULT 0,
    download_url    TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'uploaded',
    referenced_by   TEXT    NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL,
    deleted_at      INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_file_records_provider_key ON file_records (provider, bucket, object_key);
CREATE INDEX IF NOT EXISTS idx_file_records_status ON file_records (status);
CREATE INDEX IF NOT EXISTS idx_file_records_usage ON file_records (usage_type, platform, version);

CREATE TABLE IF NOT EXISTS cloud_music_tracks (
    uuid                       TEXT    PRIMARY KEY,
    status                     TEXT    NOT NULL DEFAULT 'temp',
    upload_state               TEXT    NOT NULL DEFAULT 'reserved',
    status_reason              TEXT    NOT NULL DEFAULT '',
    title                      TEXT    NOT NULL DEFAULT '',
    artist                     TEXT    NOT NULL DEFAULT '未知歌手',
    album                      TEXT    NOT NULL DEFAULT '',
    duration_ms                INTEGER NOT NULL DEFAULT 0,
    format                     TEXT    NOT NULL DEFAULT '',
    codec                      TEXT    NOT NULL DEFAULT '',
    bitrate                    INTEGER NOT NULL DEFAULT 0,
    sample_rate                INTEGER NOT NULL DEFAULT 0,
    channels                   INTEGER NOT NULL DEFAULT 0,
    year                       INTEGER,
    track_no                   INTEGER,
    lyrics_format              TEXT,
    metadata_json              TEXT    NOT NULL DEFAULT '{}',
    reviewed_by                TEXT    NOT NULL DEFAULT '',
    reviewed_at                INTEGER,
    created_at                 INTEGER NOT NULL,
    updated_at                 INTEGER NOT NULL,
    deleted_at                 INTEGER,
    CHECK (status IN ('temp','active','disabled','offline','pending_review','rejected','deleted'))
);
CREATE TABLE IF NOT EXISTS cloud_music_assets (
    id              TEXT    PRIMARY KEY,
    track_uuid      TEXT    NOT NULL,
    file_record_id  TEXT    NOT NULL UNIQUE,
    kind            TEXT    NOT NULL,
    state           TEXT    NOT NULL DEFAULT 'pending',
    is_current      INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER,
    FOREIGN KEY (track_uuid) REFERENCES cloud_music_tracks(uuid),
    FOREIGN KEY (file_record_id) REFERENCES file_records(id),
    CHECK (kind IN ('audio','cover-uploaded','cover-extracted','lyrics')),
    CHECK (state IN ('pending','uploaded','superseded','deleted'))
);
CREATE INDEX IF NOT EXISTS idx_cloud_music_status_updated
ON cloud_music_tracks (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_music_title_artist
ON cloud_music_tracks (title, artist);
CREATE INDEX IF NOT EXISTS idx_cloud_music_assets_track
ON cloud_music_assets (track_uuid, kind, state, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cloud_music_current_asset
ON cloud_music_assets (track_uuid, kind)
WHERE is_current = 1 AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS announcements (
    id                  TEXT    PRIMARY KEY,
    content_json        TEXT    NOT NULL,
    time                TEXT    NOT NULL,
    publisher           TEXT    NOT NULL,
    confirm_text        TEXT    NOT NULL,
    show_every_time     INTEGER NOT NULL DEFAULT 0,
    show_goto_button    INTEGER NOT NULL DEFAULT 0,
    goto_url            TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    enabled             INTEGER NOT NULL DEFAULT 1
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
    device_json    TEXT    NOT NULL DEFAULT '{}',
    status         TEXT    NOT NULL DEFAULT 'pending',
    processed_at   TEXT,
    user_id        TEXT,
    device_kind    TEXT,
    device_id      TEXT
);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status_created_at ON feedback (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_created ON feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_device_created ON feedback (device_kind, device_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback_images (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback_id  TEXT    NOT NULL,
    image_path   TEXT    NOT NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feedback_images_feedback_id ON feedback_images (feedback_id);

CREATE TABLE IF NOT EXISTS fault_reports (
    id                TEXT    PRIMARY KEY,
    user_id           TEXT,
    scene             TEXT    NOT NULL,
    platform          TEXT    NOT NULL DEFAULT 'android',
    arch              TEXT    NOT NULL DEFAULT '',
    app_version       TEXT    NOT NULL DEFAULT '',
    app_version_code  INTEGER NOT NULL DEFAULT 0,
    os_version        TEXT    NOT NULL DEFAULT '',
    sdk_int           INTEGER NOT NULL DEFAULT 0,
    brand             TEXT    NOT NULL DEFAULT '',
    model             TEXT    NOT NULL DEFAULT '',
    network_type      TEXT    NOT NULL DEFAULT '',
    log_count         INTEGER NOT NULL DEFAULT 0,
    status            TEXT    NOT NULL DEFAULT 'pending',
    created_at        INTEGER NOT NULL,
    processed_at      INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_fault_reports_status_created ON fault_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fault_reports_user_created ON fault_reports (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS fault_report_logs (
    client_log_id       TEXT    PRIMARY KEY,
    report_id           TEXT    NOT NULL,
    occurred_at         INTEGER NOT NULL,
    scene               TEXT    NOT NULL,
    failure_type        TEXT    NOT NULL,
    method_name         TEXT    NOT NULL DEFAULT '',
    request_method      TEXT    NOT NULL DEFAULT '',
    request_url         TEXT    NOT NULL DEFAULT '',
    request_params_json TEXT    NOT NULL DEFAULT '{}',
    nonce_id            TEXT    NOT NULL DEFAULT '',
    response_code       INTEGER,
    response_body       TEXT    NOT NULL DEFAULT '',
    resolved_url        TEXT    NOT NULL DEFAULT '',
    error_type          TEXT    NOT NULL DEFAULT '',
    error_message       TEXT    NOT NULL DEFAULT '',
    stack_trace         TEXT    NOT NULL DEFAULT '',
    song_source         TEXT    NOT NULL DEFAULT '',
    song_id             TEXT    NOT NULL DEFAULT '',
    quality             TEXT    NOT NULL DEFAULT '',
    FOREIGN KEY (report_id) REFERENCES fault_reports(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fault_report_logs_report_time ON fault_report_logs (report_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fault_report_logs_scene_time ON fault_report_logs (scene, occurred_at DESC);

CREATE TABLE IF NOT EXISTS share_records (
    uuid                  TEXT    PRIMARY KEY,
    type                  TEXT    NOT NULL,
    source                TEXT    NOT NULL,
    source_id             TEXT    NOT NULL,
    subject_key           TEXT    NOT NULL DEFAULT '',
    title                 TEXT    NOT NULL,
    description           TEXT    NOT NULL DEFAULT '',
    cover_url             TEXT    NOT NULL DEFAULT '',
    raw_json              TEXT    NOT NULL,
    sharer_user_id        TEXT    NOT NULL,
    sharer_snapshot_json  TEXT    NOT NULL DEFAULT '{}',
    created_at            INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL,
    access_count          INTEGER NOT NULL DEFAULT 0,
    valid                 INTEGER NOT NULL DEFAULT 1,
    invalidated_at        INTEGER
);
CREATE INDEX IF NOT EXISTS idx_share_records_user_created ON share_records (sharer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_records_valid_created ON share_records (valid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_records_type_source ON share_records (type, source, source_id);

CREATE TABLE IF NOT EXISTS users (
    id              TEXT    PRIMARY KEY,
    email           TEXT    NOT NULL UNIQUE,
    phone           TEXT    UNIQUE,
    username        TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,
    avatar          TEXT    NOT NULL DEFAULT '',
    avatar_key      TEXT    NOT NULL DEFAULT 'default',
    vip_enabled     INTEGER NOT NULL DEFAULT 0,
    vip_expires_at  INTEGER,
    sync_version    INTEGER NOT NULL DEFAULT 0,
    sync_log_floor  INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    last_login_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

CREATE TABLE IF NOT EXISTS announcement_reads (
    id                    TEXT PRIMARY KEY,
    announcement_id       TEXT NOT NULL,
    reader_key            TEXT NOT NULL,
    user_id               TEXT,
    user_snapshot_json    TEXT NOT NULL DEFAULT '{}',
    platform              TEXT NOT NULL CHECK (platform IN ('android', 'desktop')),
    device_id             TEXT NOT NULL,
    device_snapshot_json  TEXT NOT NULL DEFAULT '{}',
    client_ip             TEXT NOT NULL DEFAULT '',
    user_agent            TEXT NOT NULL DEFAULT '',
    created_at            INTEGER NOT NULL,
    read_at               INTEGER NOT NULL,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (announcement_id, reader_key)
);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_read_at
ON announcement_reads (announcement_id, read_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id
ON announcement_reads (user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_device_id
ON announcement_reads (platform, device_id);

CREATE TABLE IF NOT EXISTS direct_messages (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT,
    android_device_id   TEXT,
    desktop_device_id   TEXT,
    content             TEXT NOT NULL,
    created_by_admin    TEXT NOT NULL,
    created_at          INTEGER NOT NULL,
    read_at             INTEGER,
    read_platform       TEXT,
    read_device_id      TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (android_device_id) REFERENCES device_info(id) ON DELETE CASCADE,
    FOREIGN KEY (desktop_device_id) REFERENCES desktop_device_info(id) ON DELETE CASCADE,
    CHECK (
      (user_id IS NOT NULL) +
      (android_device_id IS NOT NULL) +
      (desktop_device_id IS NOT NULL) = 1
    ),
    CHECK (read_platform IS NULL OR read_platform IN ('android', 'desktop'))
);
CREATE INDEX IF NOT EXISTS idx_direct_messages_user_unread
ON direct_messages(user_id, read_at, created_at, id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_android_unread
ON direct_messages(android_device_id, read_at, created_at, id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_desktop_unread
ON direct_messages(desktop_device_id, read_at, created_at, id);

CREATE TABLE IF NOT EXISTS listening_fragments (
    user_id             TEXT    NOT NULL,
    device_id           TEXT    NOT NULL,
    event_id            TEXT    NOT NULL,
    play_session_id     TEXT    NOT NULL,
    platform            TEXT    NOT NULL,
    source              TEXT    NOT NULL,
    song_id             TEXT    NOT NULL,
    title               TEXT    NOT NULL DEFAULT '',
    artist              TEXT    NOT NULL DEFAULT '',
    album               TEXT    NOT NULL DEFAULT '',
    track_duration_ms   INTEGER,
    start_ms            INTEGER NOT NULL,
    end_ms              INTEGER NOT NULL,
    active_duration_ms  INTEGER NOT NULL,
    terminal_reason     TEXT,
    payload_json        TEXT    NOT NULL,
    received_at         INTEGER NOT NULL,
    PRIMARY KEY (user_id, device_id, event_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_listening_fragments_user_interval
ON listening_fragments (user_id, start_ms, end_ms);
CREATE INDEX IF NOT EXISTS idx_listening_fragments_track_interval
ON listening_fragments (user_id, source, song_id, start_ms, end_ms);
CREATE INDEX IF NOT EXISTS idx_listening_fragments_session
ON listening_fragments (user_id, device_id, play_session_id);

CREATE TABLE IF NOT EXISTS listening_play_sessions (
    user_id             TEXT    NOT NULL,
    device_id           TEXT    NOT NULL,
    play_session_id     TEXT    NOT NULL,
    source              TEXT    NOT NULL,
    song_id             TEXT    NOT NULL,
    track_duration_ms   INTEGER,
    accumulated_ms      INTEGER NOT NULL DEFAULT 0,
    qualified_counted   INTEGER NOT NULL DEFAULT 0,
    completed_counted   INTEGER NOT NULL DEFAULT 0,
    natural_end_seen    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, device_id, play_session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_listening_intervals (
    user_id             TEXT    NOT NULL,
    start_ms            INTEGER NOT NULL,
    end_ms              INTEGER NOT NULL,
    PRIMARY KEY (user_id, start_ms, end_ms),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (end_ms > start_ms)
);
CREATE INDEX IF NOT EXISTS idx_user_listening_intervals_range
ON user_listening_intervals (user_id, start_ms, end_ms);

CREATE TABLE IF NOT EXISTS user_track_listening_intervals (
    user_id             TEXT    NOT NULL,
    source              TEXT    NOT NULL,
    song_id             TEXT    NOT NULL,
    start_ms            INTEGER NOT NULL,
    end_ms              INTEGER NOT NULL,
    PRIMARY KEY (user_id, source, song_id, start_ms, end_ms),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (end_ms > start_ms)
);
CREATE INDEX IF NOT EXISTS idx_user_track_listening_intervals_range
ON user_track_listening_intervals (user_id, source, song_id, start_ms, end_ms);

CREATE TABLE IF NOT EXISTS user_listening_stats (
    user_id             TEXT    PRIMARY KEY,
    total_ms            INTEGER NOT NULL DEFAULT 0,
    updated_at          INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_track_stats (
    user_id             TEXT    NOT NULL,
    source              TEXT    NOT NULL,
    song_id             TEXT    NOT NULL,
    title               TEXT    NOT NULL DEFAULT '',
    artist              TEXT    NOT NULL DEFAULT '',
    album               TEXT    NOT NULL DEFAULT '',
    duration_ms         INTEGER,
    listened_ms         INTEGER NOT NULL DEFAULT 0,
    play_count          INTEGER NOT NULL DEFAULT 0,
    completed_count     INTEGER NOT NULL DEFAULT 0,
    first_listened_at   INTEGER NOT NULL,
    last_listened_at    INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    PRIMARY KEY (user_id, source, song_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_track_stats_last_listened
ON user_track_stats (user_id, last_listened_at DESC);

CREATE TABLE IF NOT EXISTS listening_level_config (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    version             INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS listening_level_rules (
    level               INTEGER PRIMARY KEY,
    min_minutes         INTEGER NOT NULL,
    max_minutes         INTEGER,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    CHECK (min_minutes >= 0),
    CHECK (max_minutes IS NULL OR max_minutes >= min_minutes)
);

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

CREATE TABLE IF NOT EXISTS verification_code_records (
    id              TEXT    PRIMARY KEY,
    channel         TEXT    NOT NULL,
    target          TEXT    NOT NULL,
    purpose         TEXT    NOT NULL,
    code            TEXT    NOT NULL,
    user_id         TEXT,
    device_id       TEXT    NOT NULL DEFAULT '',
    client_ip       TEXT    NOT NULL DEFAULT '',
    user_agent      TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'sent',
    error_message   TEXT    NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL,
    expires_at      INTEGER NOT NULL,
    verified_at     INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_verification_code_target_created ON verification_code_records (target, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_code_channel_purpose ON verification_code_records (channel, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_code_status ON verification_code_records (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_code_created ON verification_code_records (created_at DESC);

CREATE TABLE IF NOT EXISTS site_visit_records (
    id              TEXT    PRIMARY KEY,
    domain          TEXT    NOT NULL DEFAULT '',
    visit_day       TEXT    NOT NULL,
    visitor_hash    TEXT    NOT NULL,
    ip_address      TEXT    NOT NULL DEFAULT '',
    path            TEXT    NOT NULL DEFAULT '/',
    referrer        TEXT    NOT NULL DEFAULT '',
    user_agent      TEXT    NOT NULL DEFAULT '',
    language        TEXT    NOT NULL DEFAULT '',
    timezone        TEXT    NOT NULL DEFAULT '',
    screen_width    INTEGER NOT NULL DEFAULT 0,
    screen_height   INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_site_visit_day_domain_visitor
ON site_visit_records (visit_day, domain, visitor_hash);
CREATE INDEX IF NOT EXISTS idx_site_visit_domain_day ON site_visit_records (domain, visit_day);
CREATE INDEX IF NOT EXISTS idx_site_visit_day
ON site_visit_records (visit_day);
CREATE INDEX IF NOT EXISTS idx_site_visit_created
ON site_visit_records (created_at);

CREATE TABLE IF NOT EXISTS download_records (
    id              TEXT    PRIMARY KEY,
    domain          TEXT    NOT NULL DEFAULT '',
    download_day    TEXT    NOT NULL,
    platform        TEXT    NOT NULL CHECK (platform IN ('android', 'desktop')),
    version         TEXT    NOT NULL DEFAULT '',
    file_record_id  TEXT,
    ip_address      TEXT    NOT NULL DEFAULT '',
    referrer        TEXT    NOT NULL DEFAULT '',
    user_agent      TEXT    NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_download_day_platform
ON download_records (download_day, platform);
CREATE INDEX IF NOT EXISTS idx_download_created
ON download_records (created_at);

CREATE INDEX IF NOT EXISTS idx_download_domain_day ON download_records (domain, download_day);

CREATE TABLE IF NOT EXISTS site_page_view_records (
    id TEXT PRIMARY KEY,
    visit_day TEXT NOT NULL,
    domain TEXT NOT NULL DEFAULT '',
    visitor_hash TEXT NOT NULL,
    path TEXT NOT NULL,
    referrer TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_pv_domain_day ON site_page_view_records (domain, visit_day);
CREATE INDEX IF NOT EXISTS idx_site_pv_day_path ON site_page_view_records (visit_day, path);
CREATE INDEX IF NOT EXISTS idx_site_pv_created ON site_page_view_records (created_at);

CREATE TABLE IF NOT EXISTS device_daily_activity (
    activity_day    TEXT    NOT NULL,
    device_type     TEXT    NOT NULL CHECK (device_type IN ('android', 'desktop')),
    device_id       TEXT    NOT NULL,
    app_version     TEXT    NOT NULL DEFAULT '',
    first_seen_at   INTEGER NOT NULL,
    last_seen_at    INTEGER NOT NULL,
    PRIMARY KEY (activity_day, device_type, device_id)
);
CREATE INDEX IF NOT EXISTS idx_device_daily_day_type
ON device_daily_activity (activity_day, device_type);
CREATE INDEX IF NOT EXISTS idx_device_daily_last_seen
ON device_daily_activity (last_seen_at);

CREATE TABLE IF NOT EXISTS runtime_configs (
    key         TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL DEFAULT '',
    value_json  TEXT    NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS listen_together_room_records (
    id                          TEXT        PRIMARY KEY,
    room_id                     TEXT        NOT NULL,
    room_name                   TEXT        NOT NULL,
    lifecycle_status            TEXT        NOT NULL CHECK (lifecycle_status IN ('active', 'closed')),
    initial_host_user_id        TEXT        NOT NULL,
    initial_host_snapshot_json  TEXT        NOT NULL,
    final_host_user_id          TEXT        NOT NULL,
    final_host_snapshot_json    TEXT        NOT NULL,
    max_people                  INTEGER     NOT NULL,
    member_operation            INTEGER     NOT NULL,
    peak_people                 INTEGER     NOT NULL DEFAULT 1,
    total_join_count            INTEGER     NOT NULL DEFAULT 1,
    unique_people               INTEGER     NOT NULL DEFAULT 1,
    final_people                INTEGER     NOT NULL DEFAULT 0,
    last_song_snapshot_json     TEXT,
    final_playback_status       TEXT        NOT NULL DEFAULT 'paused',
    final_position              REAL        NOT NULL DEFAULT 0,
    created_at                  INTEGER     NOT NULL,
    updated_at                  INTEGER     NOT NULL,
    ended_at                    INTEGER,
    end_reason                  TEXT,
    ended_by_admin              TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_listen_room_active_room_id
ON listen_together_room_records(room_id) WHERE lifecycle_status = 'active';
CREATE INDEX IF NOT EXISTS idx_listen_room_history_ended
ON listen_together_room_records(lifecycle_status, ended_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS listen_together_room_members (
    id                  TEXT        PRIMARY KEY,
    room_record_id      TEXT        NOT NULL,
    user_id             TEXT        NOT NULL,
    user_snapshot_json  TEXT        NOT NULL,
    role                TEXT        NOT NULL CHECK (role IN ('host', 'member')),
    joined_at           INTEGER     NOT NULL,
    last_seen_at        INTEGER     NOT NULL,
    left_at             INTEGER,
    leave_reason        TEXT,
    FOREIGN KEY (room_record_id) REFERENCES listen_together_room_records(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_listen_room_members_record
ON listen_together_room_members(room_record_id, joined_at ASC);
CREATE INDEX IF NOT EXISTS idx_listen_room_members_open
ON listen_together_room_members(room_record_id, user_id, left_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_listen_room_member_open
ON listen_together_room_members(room_record_id, user_id) WHERE left_at IS NULL;
` + PLAYLIST_COVER_SQL + SONG_DOWNLOAD_SQL + SIDEBAR_MENU_SQL;

export function initSchema(db: DatabaseSync) {
  runPreSchemaMigrations(db);
  // 历史表保留给离线迁移与审计，不在启动时删除用户数据。
  db.exec(CREATE_SQL);
  db.exec(APP_SHARE_TRACKING_SQL);
  db.exec(`
    INSERT OR IGNORE INTO listening_level_config(id, version, updated_at) VALUES (1, 1, 0);
    INSERT OR IGNORE INTO listening_level_rules(level, min_minutes, max_minutes, created_at, updated_at)
    VALUES (1, 0, NULL, 0, 0);
  `);
  runPostSchemaMigrations(db);
}

let singleton: DbClient | null = null;
const transactionContext = new AsyncLocalStorage<DbClient>();
function scopedClient(client: DbClient): DbClient {
  return {
    dialect: client.dialect,
    query: (sql, params) => (transactionContext.getStore() ?? client).query(sql, params),
    queryOne: (sql, params) => (transactionContext.getStore() ?? client).queryOne(sql, params),
    execute: (sql, params) => (transactionContext.getStore() ?? client).execute(sql, params),
    transaction: async (action) => {
      const current = transactionContext.getStore();
      if (current) return action(current);
      return client.transaction(async (tx: DbTransaction) => {
        const scoped: DbClient = { ...tx, dialect: tx.dialect, query: tx.query.bind(tx), queryOne: tx.queryOne.bind(tx), execute: tx.execute.bind(tx), transaction: async (nested) => nested(tx), close: async () => { throw new Error("事务中不能关闭数据库"); } };
        return transactionContext.run(scoped, () => action(tx));
      });
    },
    close: () => client.close(),
  };
}
export async function initializeDatabase(options: { readOnlyStartup?: boolean } = {}): Promise<DbClient> {
  if (singleton) return singleton;
  const config = readDatabaseConfig();
  let client: DbClient;
  if (config.type === "SQLITE") {
    fs.mkdirSync(path.dirname(config.path), { recursive: true });
    const raw = new DatabaseSync(config.path);
    try {
      raw.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
      const hasInstallation = raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_installation'").get();
      const installation = hasInstallation ? raw.prepare("SELECT transfer_status FROM app_installation WHERE id=1").get() as { transfer_status: string } | undefined : undefined;
      const incompleteTransfer = Boolean(hasInstallation) && (!installation || installation.transfer_status !== "ready");
      if (!options.readOnlyStartup && !incompleteTransfer) initSchema(raw);
      client = new SqliteClient(raw);
      if (!incompleteTransfer) await initializeSqliteSchemaMetadata(client);
    } catch (error) { raw.close(); throw error; }
  } else {
    client = await createDatabase(config);
    try { await prepareDatabaseSchema(client); } catch (error) { await client.close(); throw error; }
  }
  singleton = scopedClient(client);
  return singleton;
}
export function getAppDb(): DbClient {
  if (!singleton) throw new Error("数据库尚未初始化，请先 await initializeDatabase()");
  return singleton;
}
