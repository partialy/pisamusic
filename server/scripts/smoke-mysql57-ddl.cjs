require("dotenv/config");
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { randomBytes } = require("node:crypto");
const { readDatabaseConfig } = require("../dist/db/core/config");
const { MYSQL_TABLES, MYSQL_ARCHIVE_TABLES } = require("../dist/db/schema/runner");

async function main() {
  const config = readDatabaseConfig({ ...process.env, DB_TYPE: "MYSQL" });
  if (config.type !== "MYSQL") throw new Error("MYSQL_URL 未配置");
  const dbname = "pm_ddl_" + randomBytes(4).toString("hex");
  const quote = String.fromCharCode(96);
  let conn, created = false;
  try {
    conn = await mysql.createConnection({
      host: config.host, port: config.port, user: config.user,
      password: config.password, connectTimeout: config.connectTimeout,
      multipleStatements: false
    });
    await conn.query("CREATE DATABASE " + quote + dbname + quote + " CHARACTER SET utf8mb4 COLLATE utf8mb4_bin");
    created = true;
    await conn.query("USE " + quote + dbname + quote);
    await conn.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION,ONLY_FULL_GROUP_BY'");
    let count = 0;
    for (const table of [...MYSQL_TABLES, ...MYSQL_ARCHIVE_TABLES]) {
      try {
        await conn.query(table.createSql);
        count++;
      } catch (error) {
        console.error("CREATE_TABLE_FAILED", table.name, error.code, error.message);
        throw error;
      }
    }
    let fkCount = 0;
    for (const table of MYSQL_TABLES) for (const ddl of table.foreignSql) {
      try {
        await conn.query(ddl);
        fkCount++;
      } catch (error) {
        console.error("FOREIGN_KEY_FAILED", table.name, error.code, error.message);
        throw error;
      }
    }
    console.log("MYSQL57_DDL_SUCCESS tables=" + count + " foreignKeys=" + fkCount);
  } finally {
    if (conn && created) await conn.query("DROP DATABASE " + quote + dbname + quote);
    await conn?.end();
    console.log("仅本次创建的隔离 DDL 库已清理");
  }
}
main().catch(e => { console.error("DDL_CHECK_FAILED", e.code || "UNKNOWN"); process.exitCode = 1; });
