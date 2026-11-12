import { DatabaseError, type DbClient } from "../core/types";
import { MYSQL_TABLES } from "./mysql/tables";

const taskId = "upgrade-v3-website-analytics";
const tables = ["site_visit_records", "download_records"];

/** 在执行基线中的新索引前补齐旧 SQLite 字段，整个增量升级可回滚。 */
export async function upgradeSqliteWebsiteAnalytics(client: DbClient): Promise<void> {
  await client.transaction(async tx => {
    for (const table of tables) {
      const columns = await tx.query<{ name: string }>(`PRAGMA table_info(${table})`);
      if (columns.length && !columns.some(column => column.name === "domain")) {
        await tx.execute(`ALTER TABLE ${table} ADD COLUMN domain TEXT NOT NULL DEFAULT ''`);
      }
      if (table === "site_visit_records" && columns.length) {
        await tx.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_site_visit_day_domain_visitor ON site_visit_records (visit_day,domain,visitor_hash)");
        await tx.execute("DROP INDEX IF EXISTS ux_site_visit_day_visitor");
      }
    }
  });
}

/** MySQL DDL 隐式提交：先记步骤意图，失败阻断本次启动，重启仅续迁本任务。 */
export async function upgradeMysqlWebsiteAnalytics(
  client: DbClient,
  fingerprint: string,
  validateTable: (client: DbClient, name: string, ddl: string) => Promise<void>,
): Promise<void> {
  const previous = await client.queryOne<{ status: string }>("SELECT status FROM schema_migrations WHERE version=2");
  if (previous?.status !== "applied") throw new DatabaseError("DB_SCHEMA_NOT_READY", "域名统计升级要求已完成 v2 Schema");
  const existing = await client.queryOne<{ status: string; task_id: string; fingerprint: string }>("SELECT status,task_id,fingerprint FROM schema_migrations WHERE version=3");
  if (existing && (existing.task_id !== taskId || existing.fingerprint !== fingerprint || !["failed", "applying"].includes(existing.status))) {
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "v3 账本不属于可续迁的域名统计任务");
  }
  if (!existing) await client.execute("INSERT INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at) VALUES(3,?,?,?,?,?)", [fingerprint, "applying", taskId, "[]", Date.now()]);
  else await client.execute("UPDATE schema_migrations SET status='applying',error_code=NULL WHERE version=3");
  const steps: string[] = [];
  const record = async (step: string) => {
    steps.push(step);
    await client.execute("UPDATE schema_migrations SET created_objects_json=? WHERE version=3", [JSON.stringify(steps)]);
  };
  try {
    for (const name of tables) {
      await record(`${name}.domain`);
      const column = await client.queryOne<{ type: string; nullable: string; defaultValue: string | null }>("SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='domain'", [name]);
      if (!column) await client.execute(`ALTER TABLE \`${name}\` ADD COLUMN \`domain\` VARCHAR(253) NOT NULL DEFAULT ''`);
      else if (column.type.toLowerCase() !== "varchar(253)" || column.nullable !== "NO" || column.defaultValue !== "") throw new DatabaseError("DB_SCHEMA_CONFLICT", `表 ${name}.domain 与 v3 定义冲突`);
    }
    const definitions = MYSQL_TABLES.filter(table => [...tables, "site_page_view_records"].includes(table.name));
    const pageView = definitions.find(table => table.name === "site_page_view_records")!;
    await record(pageView.name);
    const pageViewExists = await client.queryOne("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", [pageView.name]);
    if (!pageViewExists) await client.execute(pageView.createSql);
    await validateTable(client, pageView.name, pageView.createSql);
    for (const table of definitions.filter(table => tables.includes(table.name))) {
      const indexes = [...table.createSql.matchAll(/(UNIQUE KEY|KEY) `([^`]+)` (\([^)]+\))/g)].filter(match => match[2]!.includes("domain"));
      for (const match of indexes) {
        await record(`${table.name}.${match[2]}`);
        const index = await client.queryOne("SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?", [table.name, match[2]!]);
        if (!index) await client.execute(`ALTER TABLE \`${table.name}\` ADD ${match[1]} \`${match[2]}\` ${match[3]}`);
      }
      // 新唯一约束必须先通过结构校验，再移除旧约束，始终保留去重保护。
      await validateTable(client, table.name, table.createSql);
    }
    await record("drop-legacy-uv-index");
    const legacy = await client.queryOne("SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='site_visit_records' AND INDEX_NAME='ux_site_visit_day_visitor'");
    if (legacy) await client.execute("ALTER TABLE site_visit_records DROP INDEX ux_site_visit_day_visitor");
    for (const table of definitions) await validateTable(client, table.name, table.createSql);
    await client.execute("UPDATE schema_migrations SET status='applied',completed_at=?,error_code=NULL WHERE version=3", [Date.now()]);
  } catch (error) {
    await client.execute("UPDATE schema_migrations SET status='failed',error_code='DDL_FAILED' WHERE version=3").catch(() => undefined);
    throw error;
  }
}
