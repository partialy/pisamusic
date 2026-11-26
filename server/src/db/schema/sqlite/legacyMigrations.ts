import type { DatabaseSync } from "node:sqlite";
import { legacyHtmlToPlainText } from "../../plainTextContent";

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
  db.prepare(`UPDATE device_info SET fingerprint = id WHERE fingerprint IS NULL OR fingerprint = ''`).run();
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_device_info_fingerprint ON device_info(fingerprint)`);
}

function migrateContentPages(db: DatabaseSync) {
  const cols = getColumnNames(db, "content_pages");
  if (!cols.has("version")) {
    db.exec("ALTER TABLE content_pages ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
  }
  const rows = db.prepare(
    "SELECT code, content FROM content_pages WHERE code IN ('agreement', 'privacy')",
  ).all() as { code: string; content: string }[];
  const update = db.prepare("UPDATE content_pages SET content = ? WHERE code = ?");
  for (const row of rows) {
    const content = legacyHtmlToPlainText(row.content);
    if (content !== row.content) update.run(content, row.code);
  }
}

function migrateUpdateHistory(db: DatabaseSync) {
  const cols = getColumnNames(db, "update_history");
  if (!cols.has("platform")) {
    db.exec(`ALTER TABLE update_history ADD COLUMN platform TEXT NOT NULL DEFAULT 'android'`);
  }
  if (!cols.has("release_file_id")) {
    db.exec(`ALTER TABLE update_history ADD COLUMN release_file_id TEXT`);
  }
  if (!cols.has("deleted_at")) {
    db.exec(`ALTER TABLE update_history ADD COLUMN deleted_at INTEGER`);
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
  add("email_service_url", "TEXT NOT NULL DEFAULT 'https://gateway.partialy.cn/auth-service/api/send/email'");
  add("email_provider", "TEXT NOT NULL DEFAULT 'aliyun'");
  add(
    "email_providers_json",
    `TEXT NOT NULL DEFAULT '[{"code":"aliyun","name":"阿里云"},{"code":"resend","name":"Resend"}]'`,
  );
  db.prepare(
    `UPDATE app_settings
     SET email_service_url = 'https://gateway.partialy.cn/auth-service/api/send/email'
     WHERE email_service_url = 'https://gateway.partialy.cn/email-service/api/send'`,
  ).run();
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

function migrateAnnouncements(db: DatabaseSync) {
  const cols = getColumnNames(db, "announcements");
  if (cols.has("content") || !cols.has("content_json")) {
    const count = db.prepare("SELECT COUNT(*) AS n FROM announcements").get() as { n: number };
    if (count.n > 0) throw new Error("检测到旧公告结构且含数据，请先通过迁移工具无损升级；原表已保留");
    db.exec("ALTER TABLE announcements RENAME TO announcements_legacy_preserved");
    db.exec(`
      CREATE TABLE announcements (
        id                  TEXT    PRIMARY KEY,
        content_json        TEXT    NOT NULL,
        time                TEXT    NOT NULL,
        publisher           TEXT    NOT NULL,
        confirm_text        TEXT    NOT NULL,
        show_every_time     INTEGER NOT NULL DEFAULT 0,
        show_goto_button    INTEGER NOT NULL DEFAULT 0,
        goto_url            TEXT,
        sort_order          INTEGER NOT NULL DEFAULT 0,
        enabled             INTEGER NOT NULL DEFAULT 1,
        announcement_version INTEGER NOT NULL DEFAULT 1,
        delivery_json       TEXT
      );
    `);
    return;
  }
  if (!cols.has("enabled")) {
    db.exec(`ALTER TABLE announcements ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`);
  }
  if (!cols.has("announcement_version")) {
    db.exec("ALTER TABLE announcements ADD COLUMN announcement_version INTEGER NOT NULL DEFAULT 1");
  }
  if (!cols.has("delivery_json")) {
    db.exec("ALTER TABLE announcements ADD COLUMN delivery_json TEXT");
  }
}

function migrateUsers(db: DatabaseSync) {
  if (!getColumnNames(db, "users").has("sync_log_floor"))
    db.exec("ALTER TABLE users ADD COLUMN sync_log_floor INTEGER NOT NULL DEFAULT 0");
  const cols = getColumnNames(db, "users");
  if (!cols.has("phone")) {
    db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone ON users(phone) WHERE phone IS NOT NULL AND phone <> ''`);
  if (!cols.has("avatar_key")) {
    db.exec(`ALTER TABLE users ADD COLUMN avatar_key TEXT NOT NULL DEFAULT 'default'`);
  }
  if (!cols.has("vip_enabled")) {
    db.exec(`ALTER TABLE users ADD COLUMN vip_enabled INTEGER NOT NULL DEFAULT 0`);
  }
  if (!cols.has("vip_expires_at")) {
    db.exec(`ALTER TABLE users ADD COLUMN vip_expires_at INTEGER`);
  }
  if (!cols.has("vip_level")) {
    db.exec(`ALTER TABLE users ADD COLUMN vip_level INTEGER NOT NULL DEFAULT 1`);
  }
}

function migrateSongDownloadQuotaV10(db: DatabaseSync) {
  const quotaCols = getColumnNames(db, "song_download_quota_states");
  if (quotaCols.size > 0 && !quotaCols.has("extra_balance")) {
    db.exec(`ALTER TABLE song_download_quota_states ADD COLUMN extra_balance INTEGER NOT NULL DEFAULT 0`);
  }
  const batchCols = getColumnNames(db, "song_download_batches");
  if (batchCols.size > 0) {
    if (!batchCols.has("regular_charged_count")) {
      db.exec(`ALTER TABLE song_download_batches ADD COLUMN regular_charged_count INTEGER NOT NULL DEFAULT 0`);
    }
    if (!batchCols.has("extra_charged_count")) {
      db.exec(`ALTER TABLE song_download_batches ADD COLUMN extra_charged_count INTEGER NOT NULL DEFAULT 0`);
    }
  }
  const redeemCols = getColumnNames(db, "redemption_codes");
  if (redeemCols.size > 0 && !redeemCols.has("batch_name")) {
    db.exec(`ALTER TABLE redemption_codes ADD COLUMN batch_name TEXT NOT NULL DEFAULT ''`);
  }
}

/** 旧表必须先补列，CREATE_SQL 中的新索引才能安全执行；空库交由基线建表。 */
function prepareFeedbackColumns(db: DatabaseSync) {
  const cols = getColumnNames(db, "feedback");
  if (cols.size === 0) return;
  if (!cols.has("status")) {
    db.exec(`ALTER TABLE feedback ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`);
  }
  if (!cols.has("processed_at")) {
    db.exec(`ALTER TABLE feedback ADD COLUMN processed_at TEXT`);
  }
  if (!cols.has("user_id")) {
    db.exec(`ALTER TABLE feedback ADD COLUMN user_id TEXT`);
  }
  if (!cols.has("device_kind")) {
    db.exec(`ALTER TABLE feedback ADD COLUMN device_kind TEXT`);
  }
  if (!cols.has("device_id")) {
    db.exec(`ALTER TABLE feedback ADD COLUMN device_id TEXT`);
  }
}

function migrateFeedback(db: DatabaseSync) {
  prepareFeedbackColumns(db);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_feedback_status_created_at ON feedback (status, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_feedback_user_created ON feedback (user_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_feedback_device_created ON feedback (device_kind, device_id, created_at DESC)`);

  // 回填历史匿名反馈中已附带的 Android serverDeviceId，确保设备可查看历史记录
  const rows = db
    .prepare("SELECT id, device_json FROM feedback WHERE device_id IS NULL AND device_json IS NOT NULL")
    .all() as Array<{ id: string; device_json: string }>;
  const updateStmt = db.prepare("UPDATE feedback SET device_kind = ?, device_id = ? WHERE id = ?");
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.device_json) as Record<string, unknown> | null;
      const serverDeviceId = typeof parsed?.serverDeviceId === "string" ? parsed.serverDeviceId.trim() : "";
      if (serverDeviceId && serverDeviceId.length <= 191) {
        updateStmt.run("android", serverDeviceId, row.id);
      }
    } catch {
      /* ignore malformed device_json */
    }
  }
}

function migrateFaultReports(db: DatabaseSync) {
  const cols = getColumnNames(db, "fault_reports");
  if (!cols.has("platform")) {
    db.exec(`ALTER TABLE fault_reports ADD COLUMN platform TEXT NOT NULL DEFAULT 'android'`);
  }
  if (!cols.has("arch")) {
    db.exec(`ALTER TABLE fault_reports ADD COLUMN arch TEXT NOT NULL DEFAULT ''`);
  }
}

function migrateShareRecords(db: DatabaseSync) {
  const cols = getColumnNames(db, "share_records");
  if (!cols.has("subject_key")) {
    db.exec(`ALTER TABLE share_records ADD COLUMN subject_key TEXT NOT NULL DEFAULT ''`);
  }
  const now = Date.now();
  db.prepare(
    `UPDATE share_records
     SET subject_key = source || ':' || source_id
     WHERE subject_key IS NULL OR subject_key = ''`,
  ).run();
  db.prepare(
    `UPDATE share_records
     SET valid = 0,
         invalidated_at = COALESCE(invalidated_at, ?),
         updated_at = ?
     WHERE valid = 1
       AND uuid NOT IN (
         SELECT MIN(uuid)
         FROM share_records
         WHERE valid = 1
         GROUP BY sharer_user_id, type, subject_key
       )`,
  ).run(now, now);
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_share_records_active_subject
     ON share_records (sharer_user_id, type, subject_key)
     WHERE valid = 1`,
  );
}

function migrateFileRecords(db: DatabaseSync) {
  const cols = getColumnNames(db, "file_records");
  if (!cols.has("owner_type")) {
    db.exec(`ALTER TABLE file_records ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'system'`);
  }
  if (!cols.has("owner_user_id")) {
    db.exec(`ALTER TABLE file_records ADD COLUMN owner_user_id TEXT`);
  }
  if (!cols.has("owner_snapshot_json")) {
    db.exec(`ALTER TABLE file_records ADD COLUMN owner_snapshot_json TEXT NOT NULL DEFAULT '{}'`);
  }
  db.exec(`
    UPDATE file_records
    SET owner_type = 'system'
    WHERE owner_type IS NULL OR TRIM(owner_type) = '';

    UPDATE file_records
    SET owner_snapshot_json = '{"displayName":"system"}'
    WHERE owner_type = 'system'
      AND (
        owner_snapshot_json IS NULL
        OR TRIM(owner_snapshot_json) = ''
        OR owner_snapshot_json = '{}'
      );

    CREATE INDEX IF NOT EXISTS idx_file_records_owner
    ON file_records (owner_type, owner_user_id, created_at DESC);
  `);
}

function migrateListening(db: DatabaseSync) {
  const cols = getColumnNames(db, "listening_play_sessions");
  if (!cols.has("track_duration_ms")) {
    db.exec("ALTER TABLE listening_play_sessions ADD COLUMN track_duration_ms INTEGER");
  }
}

function repairFileRecords(db: DatabaseSync) {
  db.exec(`
    UPDATE file_records
    SET download_url = '/api/config/release-files/' || id || '/download'
    WHERE asset_type = 'installer';

    UPDATE file_records
    SET download_url = ''
    WHERE asset_type <> 'installer';

    UPDATE update_history
    SET download_url = (
      SELECT f.download_url
      FROM file_records f
      WHERE f.id = update_history.release_file_id
        AND f.status = 'uploaded'
      LIMIT 1
    )
    WHERE release_file_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM file_records f
        WHERE f.id = update_history.release_file_id
          AND f.status = 'uploaded'
      );

    UPDATE release_info
    SET download_url = (
      SELECT f.download_url
      FROM update_history h
      JOIN file_records f ON f.id = h.release_file_id
      WHERE h.platform = release_info.platform
        AND f.status = 'uploaded'
      ORDER BY h.created_at DESC
      LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1
      FROM update_history h
      JOIN file_records f ON f.id = h.release_file_id
      WHERE h.platform = release_info.platform
        AND f.status = 'uploaded'
    );

    UPDATE current_update
    SET download_url = (
      SELECT f.download_url
      FROM update_history h
      JOIN file_records f ON f.id = h.release_file_id
      WHERE h.platform = 'android'
        AND f.status = 'uploaded'
      ORDER BY h.created_at DESC
      LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1
      FROM update_history h
      JOIN file_records f ON f.id = h.release_file_id
      WHERE h.platform = 'android'
        AND f.status = 'uploaded'
    );
  `);
}

function migrateRuntimeConfigs(db: DatabaseSync) {
  const cols = getColumnNames(db, "runtime_configs");
  if (!cols.has("name")) {
    db.exec("ALTER TABLE runtime_configs ADD COLUMN name TEXT NOT NULL DEFAULT ''");
  }
}

function migrateListenTogether(db: DatabaseSync) {
  const cols = getColumnNames(db, "listen_together_room_records");
  if (cols.size > 0 && !cols.has("lifecycle_status")) {
    throw new Error("检测到旧一起听表结构，请先通过迁移工具无损升级；原表已保留");
  }
}

function migrateWebsiteDomains(db: DatabaseSync) {
  db.exec("SAVEPOINT website_domain_v3");
  try {
    for (const table of ["site_visit_records", "download_records"]) {
      const columns = getColumnNames(db, table);
      if (columns.size && !columns.has("domain"))
        db.exec(`ALTER TABLE ${table} ADD COLUMN domain TEXT NOT NULL DEFAULT ''`);
    }
    if (getColumnNames(db, "site_visit_records").size) {
      db.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_site_visit_day_domain_visitor ON site_visit_records (visit_day,domain,visitor_hash)",
      );
      db.exec("DROP INDEX IF EXISTS ux_site_visit_day_visitor");
    }
    db.exec("RELEASE website_domain_v3");
  } catch (error) {
    db.exec("ROLLBACK TO website_domain_v3; RELEASE website_domain_v3");
    throw error;
  }
}

export function runPreSchemaMigrations(db: DatabaseSync): void {
  migrateListenTogether(db);
  migrateWebsiteDomains(db);
  prepareFeedbackColumns(db);
}

export function runPostSchemaMigrations(db: DatabaseSync): void {
  migrateContentPages(db);
  migrateDeviceInfo(db);
  migrateAppSettings(db);
  migrateUpdateHistory(db);
  migrateDynamicConfigs(db);
  migrateAnnouncements(db);
  migrateUsers(db);
  migrateFeedback(db);
  migrateFaultReports(db);
  migrateShareRecords(db);
  migrateFileRecords(db);
  migrateListening(db);
  migrateRuntimeConfigs(db);
  migrateSongDownloadQuotaV10(db);
  repairFileRecords(db);
}
