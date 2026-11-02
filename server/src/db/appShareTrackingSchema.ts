export const APP_SHARE_TRACKING_SQL = `
CREATE TABLE IF NOT EXISTS app_share_records (
 id TEXT PRIMARY KEY, code TEXT COLLATE BINARY NOT NULL UNIQUE,
 device_kind TEXT NOT NULL, device_id TEXT NOT NULL, user_id TEXT,
 identity_key TEXT NOT NULL, user_snapshot_json TEXT NOT NULL,
 device_snapshot_json TEXT NOT NULL, created_at INTEGER NOT NULL,
 last_requested_at INTEGER NOT NULL, last_visit_at INTEGER, last_download_at INTEGER,
 visit_count INTEGER NOT NULL DEFAULT 0, download_count INTEGER NOT NULL DEFAULT 0,
 android_download_count INTEGER NOT NULL DEFAULT 0, desktop_download_count INTEGER NOT NULL DEFAULT 0,
 valid INTEGER NOT NULL DEFAULT 1, invalidated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_app_share_identity ON app_share_records(device_kind,device_id,identity_key) WHERE valid=1;
CREATE INDEX IF NOT EXISTS idx_app_share_created ON app_share_records(created_at DESC,id);
CREATE INDEX IF NOT EXISTS idx_app_share_user ON app_share_records(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_app_share_device ON app_share_records(device_id,created_at);
CREATE INDEX IF NOT EXISTS idx_app_share_valid ON app_share_records(valid,created_at);
CREATE INDEX IF NOT EXISTS idx_app_share_visit ON app_share_records(last_visit_at);
CREATE INDEX IF NOT EXISTS idx_app_share_download ON app_share_records(last_download_at);
CREATE TABLE IF NOT EXISTS app_share_visits (
 event_id TEXT PRIMARY KEY, share_record_id TEXT NOT NULL, code TEXT NOT NULL,
 visit_day TEXT NOT NULL, visitor_hash TEXT NOT NULL, opened_at INTEGER NOT NULL,
 navigation_sequence INTEGER NOT NULL DEFAULT 0, received_at INTEGER NOT NULL,
 referrer_path TEXT NOT NULL, user_agent TEXT NOT NULL, browser_device_type TEXT NOT NULL,
 is_unique_for_share_day INTEGER NOT NULL, is_unique_global_day INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_app_share_visit_uv ON app_share_visits(share_record_id,visit_day,visitor_hash);
CREATE INDEX IF NOT EXISTS idx_app_share_visit_global_uv ON app_share_visits(visit_day,visitor_hash);
CREATE INDEX IF NOT EXISTS idx_app_share_visit_detail ON app_share_visits(share_record_id,received_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_share_visit_attribution ON app_share_visits(visitor_hash,opened_at DESC,navigation_sequence DESC);
CREATE INDEX IF NOT EXISTS idx_app_share_visit_cleanup ON app_share_visits(received_at);
CREATE TABLE IF NOT EXISTS app_share_downloads (
 id TEXT PRIMARY KEY, share_record_id TEXT NOT NULL, download_record_id TEXT,
 visitor_hash TEXT, download_day TEXT NOT NULL, platform TEXT NOT NULL,
 version TEXT NOT NULL, file_record_id TEXT, attribution_source TEXT NOT NULL,
 triggered_at INTEGER NOT NULL, safe_referrer_path TEXT NOT NULL, safe_user_agent TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_app_share_download_detail ON app_share_downloads(share_record_id,triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_share_download_day ON app_share_downloads(download_day,platform);
CREATE INDEX IF NOT EXISTS idx_app_share_download_cleanup ON app_share_downloads(triggered_at);
CREATE TABLE IF NOT EXISTS app_share_daily_stats (
 day TEXT NOT NULL, scope TEXT NOT NULL, share_record_key TEXT NOT NULL,
 platform_bucket TEXT NOT NULL, visit_pv INTEGER NOT NULL DEFAULT 0,
 visit_uv INTEGER NOT NULL DEFAULT 0, download_triggers INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(day,scope,share_record_key,platform_bucket)
);
CREATE INDEX IF NOT EXISTS idx_app_share_daily_record ON app_share_daily_stats(share_record_key,day);
`;
