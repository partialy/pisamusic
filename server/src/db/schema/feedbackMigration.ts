import { DatabaseError, type DbClient } from "../core/types";
import { MYSQL_TABLES } from "./mysql/tables";

const TASK_ID = "upgrade-v7-feedback-identity";

const FEEDBACK_COLUMNS = [
  { name: "user_id", mysqlType: "VARCHAR(191)", sqliteSql: "ALTER TABLE feedback ADD COLUMN user_id TEXT", mysqlSql: "ALTER TABLE `feedback` ADD COLUMN `user_id` VARCHAR(191) NULL" },
  { name: "device_kind", mysqlType: "VARCHAR(16)", sqliteSql: "ALTER TABLE feedback ADD COLUMN device_kind TEXT", mysqlSql: "ALTER TABLE `feedback` ADD COLUMN `device_kind` VARCHAR(16) NULL" },
  { name: "device_id", mysqlType: "VARCHAR(191)", sqliteSql: "ALTER TABLE feedback ADD COLUMN device_id TEXT", mysqlSql: "ALTER TABLE `feedback` ADD COLUMN `device_id` VARCHAR(191) NULL" },
] as const;

const FEEDBACK_INDEXES = [
  {
    name: "idx_feedback_user_created",
    sqliteSql: "CREATE INDEX IF NOT EXISTS idx_feedback_user_created ON feedback (user_id, created_at DESC)",
    mysqlSql: "ALTER TABLE `feedback` ADD KEY `idx_feedback_user_created` (`user_id`, `created_at`)",
  },
  {
    name: "idx_feedback_device_created",
    sqliteSql: "CREATE INDEX IF NOT EXISTS idx_feedback_device_created ON feedback (device_kind, device_id, created_at DESC)",
    mysqlSql: "ALTER TABLE `feedback` ADD KEY `idx_feedback_device_created` (`device_kind`, `device_id`, `created_at`)",
  },
] as const;

async function backfillFeedbackDeviceIdentity(client: DbClient): Promise<void> {
  const rows = await client.query<{ id: string; device_json: string }>(
    "SELECT id, device_json FROM feedback WHERE device_id IS NULL AND device_json IS NOT NULL",
  );
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.device_json) as Record<string, unknown> | null;
      const serverDeviceId = typeof parsed?.serverDeviceId === "string" ? parsed.serverDeviceId.trim() : "";
      if (serverDeviceId && serverDeviceId.length <= 191) {
        await client.execute("UPDATE feedback SET device_kind = ?, device_id = ? WHERE id = ?", [
          "android",
          serverDeviceId,
          row.id,
        ]);
      }
    } catch {
      /* ignore malformed device_json */
    }
  }
}

/** SQLite：补齐 feedback 归属字段与索引并回填历史 serverDeviceId。 */
export async function upgradeSqliteFeedback(client: DbClient): Promise<void> {
  const columns = await client.query<{ name: string }>("PRAGMA table_info(feedback)");
  if (!columns.length) return;
  const existing = new Set(columns.map((c) => c.name));
  for (const col of FEEDBACK_COLUMNS) {
    if (!existing.has(col.name)) {
      await client.execute(col.sqliteSql);
    }
  }
  for (const idx of FEEDBACK_INDEXES) {
    await client.execute(idx.sqliteSql);
  }
  await backfillFeedbackDeviceIdentity(client);
}

/** MySQL v6 -> v7：为 feedback 表补充 user_id / device_kind / device_id 与查询索引。 */
export async function upgradeMysqlFeedback(
  client: DbClient,
  fingerprint: string,
  validateTable: (client: DbClient, name: string, ddl: string) => Promise<void>,
): Promise<void> {
  const previous = await client.queryOne<{ status: string }>(
    "SELECT status FROM schema_migrations WHERE version=6",
  );
  if (previous?.status !== "applied") {
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "反馈归属升级要求已完成 v6 Schema");
  }
  const ledger = await client.queryOne<{
    status: string;
    task_id: string;
    fingerprint: string;
    created_objects_json: string;
  }>("SELECT status,task_id,fingerprint,created_objects_json FROM schema_migrations WHERE version=7");
  if (
    ledger &&
    (ledger.task_id !== TASK_ID ||
      ledger.fingerprint !== fingerprint ||
      !["failed", "applying"].includes(ledger.status))
  ) {
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "v7 账本不属于可续迁的反馈归属任务");
  }
  const steps: string[] = ledger ? JSON.parse(ledger.created_objects_json) : [];
  const allowed = [
    ...FEEDBACK_COLUMNS.map((c) => `feedback.${c.name}`),
    ...FEEDBACK_INDEXES.map((i) => `feedback.${i.name}`),
    "feedback.backfill",
  ];
  if (!Array.isArray(steps) || steps.some((s) => !allowed.includes(s))) {
    throw new DatabaseError("DB_SCHEMA_CONFLICT", "v7 账本对象无效");
  }
  if (!ledger) {
    await client.execute(
      "INSERT INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at) VALUES(7,?,?,?,?,?)",
      [fingerprint, "applying", TASK_ID, "[]", Date.now()],
    );
  } else {
    await client.execute("UPDATE schema_migrations SET status='applying',error_code=NULL WHERE version=7");
  }
  const record = async (step: string) => {
    if (!steps.includes(step)) {
      steps.push(step);
      await client.execute("UPDATE schema_migrations SET created_objects_json=? WHERE version=7", [
        JSON.stringify(steps),
      ]);
    }
  };

  try {
    for (const col of FEEDBACK_COLUMNS) {
      await record(`feedback.${col.name}`);
      const existing = await client.queryOne<{ type: string; nullable: string }>(
        "SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='feedback' AND COLUMN_NAME=?",
        [col.name],
      );
      if (!existing) {
        await client.execute(col.mysqlSql);
      } else if (existing.type.toLowerCase() !== col.mysqlType.toLowerCase() || existing.nullable !== "YES") {
        throw new DatabaseError("DB_SCHEMA_CONFLICT", `feedback.${col.name} 与 v7 定义冲突`);
      }
    }
    for (const idx of FEEDBACK_INDEXES) {
      await record(`feedback.${idx.name}`);
      const existing = await client.queryOne(
        "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='feedback' AND INDEX_NAME=?",
        [idx.name],
      );
      if (!existing) {
        await client.execute(idx.mysqlSql);
      }
    }
    await validateTable(client, "feedback", MYSQL_TABLES.find((t) => t.name === "feedback")!.createSql);
    await record("feedback.backfill");
    await backfillFeedbackDeviceIdentity(client);
    await client.execute(
      "UPDATE schema_migrations SET status='applied',completed_at=?,error_code=NULL WHERE version=7",
      [Date.now()],
    );
  } catch (error) {
    await client
      .execute("UPDATE schema_migrations SET status='failed',error_code='DDL_FAILED' WHERE version=7")
      .catch(() => undefined);
    throw error;
  }
}
