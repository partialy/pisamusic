import { createHash } from "node:crypto";
import { DatabaseError, DbClient } from "../core/types";
import { MYSQL_TABLES } from "./mysql/tables";
import { MYSQL_ARCHIVE_TABLES } from "./mysql/archives";
export { MYSQL_TABLES } from "./mysql/tables";
export { MYSQL_ARCHIVE_TABLES } from "./mysql/archives";
export const SCHEMA_VERSION = 1;
export const schemaFingerprint = createHash("sha256").update(JSON.stringify({ tables: MYSQL_TABLES, archives: MYSQL_ARCHIVE_TABLES })).digest("hex");
const ledgerSql = `CREATE TABLE schema_migrations (
 version BIGINT NOT NULL PRIMARY KEY, fingerprint VARCHAR(64) NOT NULL,
 status VARCHAR(16) NOT NULL, task_id VARCHAR(191) NOT NULL,
 created_objects_json LONGTEXT NOT NULL, started_at BIGINT NOT NULL, completed_at BIGINT NULL,
 error_code VARCHAR(64) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC`;
interface MigrationRow { version: number; fingerprint: string; status: string }
export async function assertSchemaCurrent(client: DbClient): Promise<void> {
  if (client.dialect !== "mysql") return;
  const row = await client.queryOne<MigrationRow>("SELECT version, fingerprint, status FROM schema_migrations ORDER BY version DESC LIMIT 1");
  if (!row || Number(row.version) !== SCHEMA_VERSION || row.fingerprint !== schemaFingerprint || row.status !== "applied") {
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "MySQL Schema 未完成初始化或版本不匹配");
  }
}
/** 仅用于已确认的空目标库。DDL隐式提交，失败保留账本和已创建对象，绝不自动删库。 */
export async function initializeSchema(client: DbClient, taskId = "manual-initialization"): Promise<void> {
  if (client.dialect === "sqlite") { await initializeSqliteSchemaMetadata(client); return; }
  if (!/^[a-zA-Z0-9_-]{1,191}$/.test(taskId)) throw new DatabaseError("DB_SCHEMA_TASK", "Schema 任务标识无效");
  const version = await client.queryOne<{ version: string }>("SELECT VERSION() AS version");
  if (!version?.version.startsWith("5.7.")) throw new DatabaseError("DB_VERSION", "当前方案仅允许 MySQL 5.7");
  const tables = await client.query<{ name: string }>("SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE()");
  if (tables.length) throw new DatabaseError("DB_TARGET_NOT_EMPTY", "目标库必须为空；已有Schema也不能自动重新初始化");
  await client.execute(ledgerSql);
  const created = ["schema_migrations"];
  await client.execute("INSERT INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at) VALUES(?,?,?,?,?,?)", [SCHEMA_VERSION, schemaFingerprint, "applying", taskId, JSON.stringify(created), Date.now()]);
  const record = () => client.execute("UPDATE schema_migrations SET created_objects_json=? WHERE version=?", [JSON.stringify(created), SCHEMA_VERSION]);
  try {
    for (const table of [...MYSQL_TABLES, ...MYSQL_ARCHIVE_TABLES]) {
      // 先登记意图；崩溃后不能将未记账对象误认为其他任务资产。
      created.push(table.name); await record();
      await client.execute(table.createSql);
    }
    for (const table of MYSQL_TABLES) for (const ddl of table.foreignSql) await client.execute(ddl);
    await client.execute("UPDATE schema_migrations SET status=?,completed_at=? WHERE version=?", ["applied", Date.now(), SCHEMA_VERSION]);
  } catch {
    await client.execute("UPDATE schema_migrations SET status=?,error_code=? WHERE version=?", ["failed", "DDL_FAILED", SCHEMA_VERSION]).catch(() => undefined);
    throw new DatabaseError("DB_SCHEMA_FAILED", "MySQL Schema 初始化失败；保留任务账本，禁止自动清理或重试覆盖");
  }
}
export const initializeMysqlSchema = initializeSchema;
/** SQLite业务结构由现有appDb先行升级，此处仅维护版本账本。 */
export async function initializeSqliteSchemaMetadata(client: DbClient): Promise<void> {
  if (client.dialect !== "sqlite") throw new DatabaseError("DB_SCHEMA_MODE", "仅适用于 SQLite");
  await client.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, fingerprint TEXT NOT NULL, status TEXT NOT NULL, started_at INTEGER NOT NULL, completed_at INTEGER)");
  await client.transaction(async tx => {
    const latest = await tx.queryOne<MigrationRow>("SELECT version,fingerprint,status FROM schema_migrations ORDER BY version DESC LIMIT 1");
    if (latest && (Number(latest.version) !== SCHEMA_VERSION || latest.fingerprint !== schemaFingerprint || latest.status !== "applied")) {
      throw new DatabaseError("DB_SCHEMA_NOT_READY", "SQLite Schema 账本版本不匹配");
    }
    if (!latest) await tx.execute("INSERT INTO schema_migrations(version,fingerprint,status,started_at,completed_at) VALUES(?,?,?,?,?)", [SCHEMA_VERSION, schemaFingerprint, "applied", Date.now(), Date.now()]);
  });
}
