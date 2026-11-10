import { DatabaseConfig, readDatabaseConfig } from "./config";
import { DbClient } from "./types";
import { MysqlClient } from "./mysqlClient";
import { openSqliteClient } from "./sqliteClient";
export { readDatabaseConfig, getRedactedDatabaseConfig } from "./config";
export async function createDatabase(config: DatabaseConfig = readDatabaseConfig()): Promise<DbClient> {
  if (config.type === "SQLITE") return openSqliteClient(config.path);
  const client = new MysqlClient(config);
  try {
    await client.queryOne("SELECT 1 AS connected");
    return client;
  } catch { await client.close().catch(() => undefined); throw new Error("MySQL 连接失败，请检查数据库配置与服务状态（未回退 SQLite）"); }
}
