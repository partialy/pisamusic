import { DatabaseError, type DbClient } from "../core/types";
import { MYSQL_TABLES } from "./mysql/tables";
export async function upgradeSqliteSync(client: DbClient): Promise<void> {
  const columns = await client.query<{
    name: string;
  }>("PRAGMA table_info(users)");
  if (columns.length && !columns.some(c => c.name === "sync_log_floor"))
    await client.execute("ALTER TABLE users ADD COLUMN sync_log_floor INTEGER NOT NULL DEFAULT 0");
}
/** DDL 先记账；中断后仅续迁同一任务，字段冲突阻断启动。 */
export async function upgradeMysqlSync(client: DbClient, fingerprint: string, validateTable: (client: DbClient, name: string, ddl: string) => Promise<void>): Promise<void> {
  const task = "upgrade-v4-sync-retention";
  const previous = await client.queryOne<{
    status: string;
  }>("SELECT status FROM schema_migrations WHERE version=3");
  if (previous?.status !== "applied")
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "同步升级要求已完成 v3 Schema");
  const ledger = await client.queryOne<{
    status: string;
    task_id: string;
    fingerprint: string;
  }>("SELECT status,task_id,fingerprint FROM schema_migrations WHERE version=4");
  if (ledger && (ledger.task_id !== task || ledger.fingerprint !== fingerprint || !["failed", "applying"].includes(ledger.status)))
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "v4 账本不属于可续迁的同步任务");
  if (!ledger)
    await client.execute("INSERT INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at) VALUES(4,?,?,?,?,?)", [fingerprint, "applying", task, '["users.sync_log_floor"]', Date.now()]);
  else
    await client.execute("UPDATE schema_migrations SET status='applying',error_code=NULL WHERE version=4");
  try {
    const column = await client.queryOne<{
      type: string;
      nullable: string;
      defaultValue: string | null;
    }>("SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='sync_log_floor'");
    if (!column)
      await client.execute("ALTER TABLE users ADD COLUMN sync_log_floor BIGINT NOT NULL DEFAULT 0");
    else if (!/^bigint(?:\(\d+\))?$/.test(column.type.toLowerCase()) || column.nullable !== "NO" || String(column.defaultValue) !== "0")
      throw new DatabaseError("DB_SCHEMA_CONFLICT", "users.sync_log_floor 与 v4 定义冲突");
    await validateTable(client, "users", MYSQL_TABLES.find(table => table.name === "users")!.createSql);
    await client.execute("UPDATE schema_migrations SET status='applied',completed_at=?,error_code=NULL WHERE version=4", [Date.now()]);
  }
  catch (error) {
    await client.execute("UPDATE schema_migrations SET status='failed',error_code='DDL_FAILED' WHERE version=4").catch(() => undefined);
    throw error;
  }
}
