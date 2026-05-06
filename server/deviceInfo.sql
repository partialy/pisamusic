-- 设备信息记录表（每台设备一行，按 fingerprint = sha256(androidId + model) upsert）
CREATE TABLE IF NOT EXISTS device_info (
    id                  TEXT        PRIMARY KEY,    -- UUID，服务端生成，客户端持久化
    fingerprint         TEXT        NOT NULL UNIQUE,
    device_name         TEXT        NOT NULL,       -- 设备名称，如 "Pixel 7"
    brand               TEXT        NOT NULL,       -- 品牌，如 "google"、"Xiaomi"
    model               TEXT        NOT NULL,       -- 型号，如 "Pixel 7"
    os_version          TEXT        NOT NULL,       -- Android 版本号，如 "14"
    sdk_version         INTEGER     NOT NULL,       -- Android SDK_INT，如 34
    app_version         TEXT        NOT NULL,       -- app 版本名，如 "2.1.3"
    app_version_code    INTEGER     NOT NULL,       -- app versionCode，如 1
    locked              INTEGER     NOT NULL DEFAULT 0,  -- 是否封禁 0=正常 1=封禁
    lock_end_time       INTEGER     DEFAULT NULL,   -- 解封时间 Unix 毫秒戳，NULL=永久封禁或未封禁
    first_seen_at       INTEGER     NOT NULL,       -- 首次上报时间 Unix 毫秒戳
    last_active_at      INTEGER     NOT NULL,       -- 最近活跃时间 Unix 毫秒戳
    first_seen_ip       TEXT,                       -- 首次上报时客户端 IP
    last_seen_ip        TEXT,                       -- 最近一次上报 IP
    last_country_code   TEXT,                       -- 粗略国家码（客户端 SIM/Locale）
    last_timezone       TEXT,                       -- 如 Asia/Shanghai
    last_locale         TEXT,                       -- 如 zh_CN
    extra_info          TEXT        NOT NULL DEFAULT '{}'  -- JSON: 扩展字段
);

CREATE INDEX IF NOT EXISTS idx_device_info_last_active ON device_info (last_active_at);
CREATE INDEX IF NOT EXISTS idx_device_info_brand_model ON device_info (brand, model);

-- extra_info JSON 示例:
-- {
--   "manufacturer": "Google",
--   "certModel": "241297NP4C",
--   "screenWidth": 1080,
--   "screenHeight": 2400,
--   "screenDensity": 420,
--   "cpuAbi": "arm64-v8a",
--   "locale": "zh-CN",
--   "networkType": "wifi",
--   "installSource": "com.android.vending",
--   "isRooted": false
-- }
