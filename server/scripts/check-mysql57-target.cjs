/**
 * 只读连接诊断：从 server/.env 或当前进程读取 MYSQL_URL，不接受命令行密码。
 * 用法：pnpm build && node scripts/check-mysql57-target.cjs
 * 不创建、删除、更新任何数据库对象，亦不会切换正式 DB_TYPE。
 */
require("dotenv/config");
const { readDatabaseConfig } = require("../dist/db/core/config");
const { openTarget, targetTables } = require("../dist/operations/mysqlTarget");
const { preflight } = require("../dist/operations/migrationEngine");

async function main() {
  if (!process.env.MYSQL_URL) {
    console.error("未配置 MYSQL_URL；请在 server/.env 中填写连接地址（切勿提交密码）。");
    process.exitCode = 2;
    return;
  }
  const config = readDatabaseConfig({ ...process.env, DB_TYPE: "MYSQL" });
  const db = await openTarget();
  try {
    const info = await db.queryOne("SELECT VERSION() AS version, DATABASE() AS database_name");
    const tableNames = await targetTables(db);
    const checks = {
      connected: true,
      version: info?.version,
      database: info?.database_name,
      host: config.host,
      port: config.port,
      tableCount: tableNames.length,
      isEmpty: tableNames.length === 0,
      tables: tableNames.slice(0, 25),
    };
    console.log("MySQL 5.7 目标库连接：");
    console.log(JSON.stringify(checks, null, 2));
    if (process.env.DB_TYPE?.toUpperCase() !== "MYSQL") {
      const result = await preflight({ sourceType: "server" });
      console.log("SQLite → MySQL 迁移预检查：");
      console.log(JSON.stringify({
        passed: result.passed,
        sourceTables: result.tables.length,
        sourceRows: result.totalRows,
        checks: result.checks,
      }, null, 2));
    } else {
      console.log("已检测到正式 DB_TYPE=MYSQL，跳过 SQLite 来源预检查；只执行只读连接检查。");
    }
    if (tableNames.length !== 0) {
      console.log("提示：目标库不是空库；本脚本不会更改或清理数据。");
    }
  } finally {
    await db.close();
  }
}

main().catch(error => {
  // mysql2 错误字符串可能包含连接细节。仅输出驱动错误码，禁止打印 URL/密码。
  const code = String(error?.code || "CHECK_FAILED");
  console.error("目标库连接/预检查失败，错误码：" + (/^[A-Z0-9_]+$/.test(code) ? code : "CHECK_FAILED"));
  process.exitCode = 1;
});
