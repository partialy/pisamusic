/** 歌曲下载批次、明细与配额状态表（SQLite）。 */
export const SONG_DOWNLOAD_SQL = `
CREATE TABLE IF NOT EXISTS song_download_quota_states (
    subject_type        TEXT        NOT NULL,
    subject_key         TEXT        NOT NULL,
    override_enabled    INTEGER     NOT NULL DEFAULT 0,
    daily_limit         INTEGER     DEFAULT NULL,
    weekly_limit        INTEGER     DEFAULT NULL,
    monthly_limit       INTEGER     DEFAULT NULL,
    total_limit         INTEGER     DEFAULT NULL,
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
    id                  TEXT        PRIMARY KEY,
    client_batch_id     TEXT        NOT NULL,
    subject_type        TEXT        NOT NULL,
    subject_key         TEXT        NOT NULL,
    user_id             TEXT        DEFAULT NULL,
    device_kind         TEXT        NOT NULL,
    device_id           TEXT        NOT NULL,
    platform            TEXT        NOT NULL,
    item_count          INTEGER     NOT NULL,
    client_ip           TEXT        NOT NULL DEFAULT '',
    created_at          INTEGER     NOT NULL
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
`;
