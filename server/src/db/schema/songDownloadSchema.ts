/** 歌曲下载批次、明细、配额状态、VIP 等级、额外次数流水与兑换码表（SQLite）。 */
export const SONG_DOWNLOAD_SQL = `
CREATE TABLE IF NOT EXISTS song_download_quota_states (
    subject_type        TEXT        NOT NULL,
    subject_key         TEXT        NOT NULL,
    override_enabled    INTEGER     NOT NULL DEFAULT 0,
    daily_limit         INTEGER     DEFAULT NULL,
    weekly_limit        INTEGER     DEFAULT NULL,
    monthly_limit       INTEGER     DEFAULT NULL,
    total_limit         INTEGER     DEFAULT NULL,
    extra_balance       INTEGER     NOT NULL DEFAULT 0,
    day_key             TEXT        NOT NULL DEFAULT '',
    day_used            INTEGER     NOT NULL DEFAULT 0,
    week_key            TEXT        NOT NULL DEFAULT '',
    week_used           INTEGER     NOT NULL DEFAULT 0,
    month_key           TEXT        NOT NULL DEFAULT '',
    month_used          INTEGER     NOT NULL DEFAULT 0,
    total_used          INTEGER     NOT NULL DEFAULT 0,
    updated_at          INTEGER     NOT NULL,
    PRIMARY KEY (subject_type, subject_key)
);
CREATE INDEX IF NOT EXISTS idx_song_dl_quota_updated ON song_download_quota_states (updated_at);

CREATE TABLE IF NOT EXISTS song_download_batches (
    id                      TEXT        PRIMARY KEY,
    client_batch_id         TEXT        NOT NULL,
    subject_type            TEXT        NOT NULL,
    subject_key             TEXT        NOT NULL,
    user_id                 TEXT        DEFAULT NULL,
    device_kind             TEXT        NOT NULL,
    device_id               TEXT        NOT NULL,
    platform                TEXT        NOT NULL,
    item_count              INTEGER     NOT NULL,
    regular_charged_count   INTEGER     NOT NULL DEFAULT 0,
    extra_charged_count     INTEGER     NOT NULL DEFAULT 0,
    client_ip               TEXT        NOT NULL DEFAULT '',
    created_at              INTEGER     NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_song_dl_batch_client ON song_download_batches (subject_type, subject_key, client_batch_id);
CREATE INDEX IF NOT EXISTS idx_song_dl_batch_created ON song_download_batches (created_at, id);
CREATE INDEX IF NOT EXISTS idx_song_dl_batch_user ON song_download_batches (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_song_dl_batch_device ON song_download_batches (device_kind, device_id, created_at);

CREATE TABLE IF NOT EXISTS song_download_records (
    id                  TEXT        PRIMARY KEY,
    batch_id            TEXT        NOT NULL,
    subject_type        TEXT        NOT NULL,
    subject_key         TEXT        NOT NULL,
    user_id             TEXT        DEFAULT NULL,
    device_kind         TEXT        NOT NULL,
    device_id           TEXT        NOT NULL,
    platform            TEXT        NOT NULL,
    source              TEXT        NOT NULL,
    song_id             TEXT        NOT NULL,
    song_name           TEXT        NOT NULL DEFAULT '',
    singer              TEXT        NOT NULL DEFAULT '',
    album               TEXT        NOT NULL DEFAULT '',
    cover_url           TEXT        NOT NULL DEFAULT '',
    duration_ms         INTEGER     DEFAULT NULL,
    quality_key         TEXT        NOT NULL,
    download_day        TEXT        NOT NULL,
    download_week       TEXT        NOT NULL,
    download_month      TEXT        NOT NULL,
    created_at          INTEGER     NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES song_download_batches(id)
);
CREATE INDEX IF NOT EXISTS idx_song_dl_rec_batch ON song_download_records (batch_id);
CREATE INDEX IF NOT EXISTS idx_song_dl_rec_song ON song_download_records (source, song_id, created_at);
CREATE INDEX IF NOT EXISTS idx_song_dl_rec_user_day ON song_download_records (user_id, download_day, created_at);
CREATE INDEX IF NOT EXISTS idx_song_dl_rec_subject_day ON song_download_records (subject_type, subject_key, download_day);
CREATE INDEX IF NOT EXISTS idx_song_dl_rec_created ON song_download_records (created_at, id);

CREATE TABLE IF NOT EXISTS song_download_vip_tiers (
    level               INTEGER     PRIMARY KEY,
    name                TEXT        NOT NULL DEFAULT '',
    daily_limit         INTEGER     DEFAULT NULL,
    weekly_limit        INTEGER     DEFAULT NULL,
    monthly_limit       INTEGER     DEFAULT NULL,
    total_limit         INTEGER     DEFAULT NULL,
    updated_at          INTEGER     NOT NULL
);

CREATE TABLE IF NOT EXISTS song_download_extra_logs (
    id                  TEXT        PRIMARY KEY,
    subject_type        TEXT        NOT NULL,
    subject_key         TEXT        NOT NULL,
    delta               INTEGER     NOT NULL,
    balance_after       INTEGER     NOT NULL,
    source_type         TEXT        NOT NULL,
    ref_id              TEXT        NOT NULL DEFAULT '',
    remark              TEXT        NOT NULL DEFAULT '',
    created_at          INTEGER     NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_song_dl_extra_subject ON song_download_extra_logs (subject_type, subject_key, created_at, id);
CREATE INDEX IF NOT EXISTS idx_song_dl_extra_created ON song_download_extra_logs (created_at, id);

CREATE TABLE IF NOT EXISTS redemption_codes (
    id                  TEXT        PRIMARY KEY,
    code                TEXT        NOT NULL,
    batch_id            TEXT        NOT NULL DEFAULT '',
    batch_name          TEXT        NOT NULL DEFAULT '',
    reward_type         TEXT        NOT NULL,
    reward_amount       INTEGER     NOT NULL,
    vip_level           INTEGER     NOT NULL DEFAULT 1,
    max_uses            INTEGER     NOT NULL DEFAULT 1,
    used_count          INTEGER     NOT NULL DEFAULT 0,
    expires_at          INTEGER     DEFAULT NULL,
    enabled             INTEGER     NOT NULL DEFAULT 1,
    remark              TEXT        NOT NULL DEFAULT '',
    created_by          TEXT        NOT NULL DEFAULT '',
    created_at          INTEGER     NOT NULL,
    updated_at          INTEGER     NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_redemption_code ON redemption_codes (code);
CREATE INDEX IF NOT EXISTS idx_redemption_batch ON redemption_codes (batch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_redemption_created ON redemption_codes (created_at, id);

CREATE TABLE IF NOT EXISTS redemption_logs (
    id                  TEXT        PRIMARY KEY,
    code_id             TEXT        NOT NULL,
    code                TEXT        NOT NULL,
    user_id             TEXT        NOT NULL,
    reward_type         TEXT        NOT NULL,
    reward_amount       INTEGER     NOT NULL,
    vip_level           INTEGER     NOT NULL DEFAULT 1,
    created_at          INTEGER     NOT NULL,
    FOREIGN KEY (code_id) REFERENCES redemption_codes(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_redemption_log_code_user ON redemption_logs (code_id, user_id);
CREATE INDEX IF NOT EXISTS idx_redemption_log_user ON redemption_logs (user_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_redemption_log_created ON redemption_logs (created_at, id);
`;
