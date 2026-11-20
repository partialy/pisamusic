import type { DatabaseSync } from "node:sqlite";

/** V11：将同步水位、HLC 时钟偏移、实体已知版本及本地操作日志迁入独立表，与业务写入同事务提交。 */
export function migrateSyncState(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE version = 11").get()) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_account_state (
        account_id TEXT PRIMARY KEY,
        seeded INTEGER NOT NULL DEFAULT 0,
        last_version INTEGER NOT NULL DEFAULT 0,
        last_sync_at TEXT NOT NULL DEFAULT '',
        last_error TEXT NOT NULL DEFAULT '',
        hlc_pt INTEGER NOT NULL DEFAULT 0,
        hlc_lc INTEGER NOT NULL DEFAULT 0,
        clock_offset_ms INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS sync_entity_versions (
        account_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_key TEXT NOT NULL,
        server_version INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (account_id, item_type, item_key)
      );
      CREATE TABLE IF NOT EXISTS sync_op_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        op_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_key TEXT NOT NULL,
        action TEXT NOT NULL,
        base_version INTEGER NOT NULL DEFAULT 0,
        client_updated_at TEXT NOT NULL,
        status TEXT NOT NULL,
        server_version INTEGER,
        detail TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_op_history_account
        ON sync_op_history(account_id, created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_sync_op_history_op_id
        ON sync_op_history(op_id);
    `);

    const columns = db.prepare("PRAGMA table_info(sync_outbox)").all() as { name: string }[];
    if (!columns.some((col) => col.name === "base_version")) {
      db.exec("ALTER TABLE sync_outbox ADD COLUMN base_version INTEGER NOT NULL DEFAULT 0");
    }

    const legacyRows = db
      .prepare("SELECT key, value_json FROM settings WHERE key LIKE 'sync-state:%'")
      .all() as { key: string; value_json: string }[];
    const insertState = db.prepare(`
      INSERT OR IGNORE INTO sync_account_state (
        account_id, seeded, last_version, last_sync_at, last_error
      ) VALUES (?, ?, ?, ?, ?)
    `);
    for (const row of legacyRows) {
      const accountId = row.key.slice("sync-state:".length).trim();
      if (!accountId) continue;
      try {
        const parsed = JSON.parse(row.value_json) as {
          seededAccountId?: string;
          lastVersion?: number;
          lastSyncAt?: string;
          lastError?: string;
        };
        insertState.run(
          accountId,
          parsed.seededAccountId === accountId ? 1 : 0,
          typeof parsed.lastVersion === "number" && Number.isSafeInteger(parsed.lastVersion) && parsed.lastVersion >= 0
            ? parsed.lastVersion
            : 0,
          typeof parsed.lastSyncAt === "string" ? parsed.lastSyncAt : "",
          typeof parsed.lastError === "string" ? parsed.lastError : "",
        );
      } catch {
        // 忽略损坏的历史配置 JSON
      }
    }

    db.prepare("INSERT INTO schema_migrations VALUES (11, 'sync state, entity versions, and op history', ?)").run(
      new Date().toISOString(),
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
