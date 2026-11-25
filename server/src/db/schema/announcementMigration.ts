import { DatabaseError, type DbClient } from "../core/types";
import { MYSQL_TABLES } from "./mysql/tables";

const TASK_ID = "upgrade-v9-announcements";
const columns = [
  { name: "announcement_version", sqlite: "INTEGER NOT NULL DEFAULT 1", mysql: "BIGINT NOT NULL DEFAULT 1" },
  { name: "delivery_json", sqlite: "TEXT", mysql: "LONGTEXT NULL" },
] as const;

export async function upgradeSqliteAnnouncements(client: DbClient): Promise<void> {
  const existing = await client.query<{ name: string }>("PRAGMA table_info(announcements)");
  if (!existing.length) return;
  for (const column of columns) {
    if (!existing.some(({ name }) => name === column.name)) {
      await client.execute("ALTER TABLE announcements ADD COLUMN " + column.name + " " + column.sqlite);
    }
  }
}

export async function upgradeMysqlAnnouncements(
  client: DbClient,
  fingerprint: string,
  validate: (client: DbClient, name: string, ddl: string) => Promise<void>,
): Promise<void> {
  const previous = await client.queryOne<{ status: string }>("SELECT status FROM schema_migrations WHERE version=8");
  if (previous?.status !== "applied") throw new DatabaseError("DB_SCHEMA_NOT_READY", "公告升级要求已完成 Schema v8");
  const ledger = await client.queryOne<{ status: string; task_id: string; fingerprint: string }>(
    "SELECT status,task_id,fingerprint FROM schema_migrations WHERE version=9",
  );
  if (ledger && (ledger.task_id !== TASK_ID || ledger.fingerprint !== fingerprint ||
    !["failed", "applying"].includes(ledger.status))) {
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "v9 账本不属于可续迁的公告任务");
  }
  if (ledger) {
    await client.execute("UPDATE schema_migrations SET status='applying',error_code=NULL WHERE version=9");
  } else {
    await client.execute(
      "INSERT INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at) VALUES(9,?,?,?,?,?)",
      [fingerprint, "applying", TASK_ID, JSON.stringify(columns.map(({ name }) => "announcements." + name)), Date.now()],
    );
  }
  try {
    const existing = await client.query<{ name: string }>(
      "SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='announcements'",
    );
    const missing = columns.filter((column) => !existing.some(({ name }) => name === column.name));
    if (missing.length) {
      await client.execute("ALTER TABLE announcements " + missing.map((column) => "ADD COLUMN " + column.name + " " + column.mysql).join(", "));
    }
    const announcementTable = MYSQL_TABLES.find((table) => table.name === "announcements")!;
    await validate(client, announcementTable.name, announcementTable.createSql);
    await client.execute(
      "UPDATE schema_migrations SET status='applied',completed_at=?,error_code=NULL WHERE version=9",
      [Date.now()],
    );
  } catch (error) {
    await client.execute("UPDATE schema_migrations SET status='failed',error_code='DDL_FAILED' WHERE version=9").catch(() => undefined);
    throw error;
  }
}
