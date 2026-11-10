import { createHash } from "node:crypto";
import { createDatabase, readDatabaseConfig } from "../db/core/createDatabase";
import type { DbClient } from "../db/core/types";

export function targetConfig() { return readDatabaseConfig({ ...process.env, DB_TYPE: "MYSQL" }); }
export function targetFingerprint(): string {
  const config = targetConfig();
  if (config.type !== "MYSQL") throw new Error("MySQL 配置无效");
  return createHash("sha256").update(JSON.stringify([config.host,config.port,config.database])).digest("hex");
}
export async function openTarget(): Promise<DbClient> {
  const db = await createDatabase(targetConfig());
  try {
    const version = await db.queryOne<{version:string}>("SELECT VERSION() AS version");
    if (!/^5\.7\./.test(version?.version || "")) throw new Error("仅支持经过适配的 MySQL 5.7");
    const vars = await db.queryOne<{pageSize:number;largePrefix:string;fileFormat:string}>("SELECT @@innodb_page_size AS pageSize, @@innodb_large_prefix AS largePrefix, @@innodb_file_format AS fileFormat");
    if (Number(vars?.pageSize) < 16384 || !["1","ON"].includes(String(vars?.largePrefix)) || String(vars?.fileFormat).toLowerCase() !== "barracuda") throw new Error("MySQL 需启用 Barracuda、large_prefix 和至少 16KB 页");
    return db;
  } catch (error) { await db.close(); throw error; }
}
export async function targetTables(db: DbClient): Promise<string[]> {
  return (await db.query<{name:string}>("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")).map(row=>row.name);
}
export async function schemaFingerprint(db: DbClient): Promise<string> {
  const columns = await db.query("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,GENERATION_EXPRESSION,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION");
  const indexes = await db.query("SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX");
  return createHash("sha256").update(JSON.stringify([columns,indexes])).digest("hex");
}
export function safeError(error: unknown): string {
  const code = (error as {code?:string})?.code;
  if (code) return `数据库操作失败（${/^[A-Z0-9_]+$/.test(code) ? code : "DB_ERROR"}），未跳过任何数据`;
  // 自定义消息只由本模块/SQLite 检查生成，驱动的原始SQL错误不回传。
  const message = error instanceof Error ? error.message : "未知错误";
  return /^[\u4e00-\u9fff]/.test(message) ? message : "数据库操作失败，请检查版本、结构与约束";
}
