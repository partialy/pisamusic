import path from "node:path";
import { DatabaseError } from "./types";
export type DatabaseConfig = { type: "SQLITE"; path: string } | {
  type: "MYSQL"; host: string; port: number; user: string; password: string;
  database: string; connectionLimit: number; connectTimeout: number;
};
function integer(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new DatabaseError("DB_CONFIG", "数据库连接池配置必须为范围内的正整数");
  return n;
}
export function readDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const type = (env.DB_TYPE ?? "SQLITE").trim().toUpperCase();
  if (type === "SQLITE") return { type, path: path.resolve(env.PISA_APP_DB_PATH?.trim() || path.join(process.cwd(), "data/pm.db")) };
  if (type !== "MYSQL") throw new DatabaseError("DB_CONFIG", "DB_TYPE 仅允许 SQLITE 或 MYSQL");
  let url: URL;
  try { url = new URL(env.MYSQL_URL || ""); } catch { throw new DatabaseError("DB_CONFIG", "MYSQL_URL 必须是有效的 mysql:// 连接地址"); }
  if (url.protocol !== "mysql:" || !url.hostname || !url.username || !/^\/[a-zA-Z0-9_$-]+$/.test(url.pathname) || url.search || url.hash) {
    throw new DatabaseError("DB_CONFIG", "MYSQL_URL 必须指定主机、账号和数据库，且不允许查询参数或片段");
  }
  try {
    return { type, host: url.hostname, port: integer(url.port, 3306, 65535), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
      database: url.pathname.slice(1), connectionLimit: integer(env.MYSQL_POOL_SIZE, 10, 100), connectTimeout: integer(env.MYSQL_CONNECT_TIMEOUT_MS, 10000, 120000) };
  } catch { throw new DatabaseError("DB_CONFIG", "MySQL 连接参数或连接池配置无效"); }
}
export function getRedactedDatabaseConfig(config: DatabaseConfig): Record<string, string | number> {
  return config.type === "SQLITE" ? { type: config.type, path: config.path } : {
    type: config.type, host: config.host, port: config.port, database: config.database,
    user: "***", password: "***", connectionLimit: config.connectionLimit,
  };
}
