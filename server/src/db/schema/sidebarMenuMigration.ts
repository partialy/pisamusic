import { DatabaseError, type DbClient } from "../core/types";
import { sidebarMenuTables } from "./mysql/sidebarMenus";

const TASK_ID = "upgrade-v8-sidebar-menus";

/** MySQL v7 -> v8：增量创建侧栏菜单配置与图标上传会话表并登记账本，支持幂等续迁。 */
export async function upgradeMysqlSidebarMenus(
  client: DbClient,
  fingerprint: string,
  validate: (client: DbClient, name: string, ddl: string) => Promise<void>,
): Promise<void> {
  const previous = await client.queryOne<{ status: string }>(
    "SELECT status FROM schema_migrations WHERE version=7",
  );
  if (previous?.status !== "applied") {
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "侧栏菜单表升级要求已完成 v7 Schema");
  }
  const ledger = await client.queryOne<{
    status: string;
    task_id: string;
    fingerprint: string;
    created_objects_json: string;
  }>("SELECT status,task_id,fingerprint,created_objects_json FROM schema_migrations WHERE version=8");
  if (
    ledger &&
    (ledger.task_id !== TASK_ID ||
      ledger.fingerprint !== fingerprint ||
      !["failed", "applying"].includes(ledger.status))
  ) {
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "v8 账本不属于可续迁的侧栏菜单任务");
  }
  const created: string[] = ledger ? JSON.parse(ledger.created_objects_json) : [];
  const allowed = sidebarMenuTables.map((t) => t.name);
  if (!Array.isArray(created) || created.some((n) => !allowed.includes(n))) {
    throw new DatabaseError("DB_SCHEMA_CONFLICT", "v8 账本对象无效");
  }
  if (!ledger) {
    await client.execute(
      "INSERT INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at) VALUES(8,?,?,?,?,?)",
      [fingerprint, "applying", TASK_ID, "[]", Date.now()],
    );
  } else {
    await client.execute("UPDATE schema_migrations SET status='applying',error_code=NULL WHERE version=8");
  }
  const record = async (name: string) => {
    if (!created.includes(name)) {
      created.push(name);
      await client.execute("UPDATE schema_migrations SET created_objects_json=? WHERE version=8", [
        JSON.stringify(created),
      ]);
    }
  };
  try {
    for (const table of sidebarMenuTables) {
      const exists = await client.queryOne(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
        [table.name],
      );
      if (exists && !created.includes(table.name)) {
        throw new DatabaseError("DB_SCHEMA_CONFLICT", `侧栏菜单表 ${table.name} 未登记在本任务`);
      }
      await record(table.name);
      if (!exists) await client.execute(table.createSql);
      await validate(client, table.name, table.createSql);
    }
    await client.execute(
      "UPDATE schema_migrations SET status='applied',completed_at=?,error_code=NULL WHERE version=8",
      [Date.now()],
    );
  } catch (error) {
    await client
      .execute("UPDATE schema_migrations SET status='failed',error_code='DDL_FAILED' WHERE version=8")
      .catch(() => undefined);
    throw error;
  }
}
