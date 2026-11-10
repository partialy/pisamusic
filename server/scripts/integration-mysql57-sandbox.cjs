require("dotenv/config");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");
const mysql = require("mysql2/promise");
const { readDatabaseConfig } = require("../dist/db/core/config");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const root = process.cwd();
  const original = readDatabaseConfig({ ...process.env, DB_TYPE: "MYSQL" });
  assert.equal(original.type, "MYSQL");
  const file = path.resolve(process.env.PISA_APP_DB_PATH?.trim() || path.join(root, "data/pm.db"));
  assert(fs.existsSync(file), "SQLite 来源文件不存在");
  const id = randomBytes(4).toString("hex");
  const database = "pm_verify_" + id;
  const scratch = path.join(root, "data", "mysql57-verify-" + id);
  const sqliteCopy = path.join(scratch, "data", "pm.db");
  const quote = String.fromCharCode(96);
  let admin, source, created = false, lastStage = "";
  fs.mkdirSync(path.dirname(sqliteCopy), { recursive: true });
  try {
    source = new DatabaseSync(file, { readOnly: true });
    await backup(source, sqliteCopy, { rate: 100 });
    source.close(); source = undefined;
    console.log("源 SQLite 一致性备份完成（原库只读）");
    admin = await mysql.createConnection({
      host: original.host, port: original.port, user: original.user,
      password: original.password, connectTimeout: original.connectTimeout
    });
    const [existing] = await admin.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?", [database]);
    assert.equal(existing.length, 0, "测试库名冲突");
    await admin.query("CREATE DATABASE " + quote + database + quote + " CHARACTER SET utf8mb4 COLLATE utf8mb4_bin");
    created = true;
    process.chdir(scratch);
    process.env.DB_TYPE = "SQLITE";
    process.env.PISA_APP_DB_PATH = sqliteCopy;
    const url = new URL(process.env.MYSQL_URL);
    url.pathname = "/" + database;
    process.env.MYSQL_URL = url.toString();
    const { inspectSqlite } = require("../dist/operations/sqliteSnapshots");
    const { preflight, startMigration } = require("../dist/operations/migrationEngine");
    const { getTask } = require("../dist/operations/migrationTasks");
    const tables = inspectSqlite(sqliteCopy);
    console.log("隔离源表数=" + tables.length + " 总记录=" + tables.reduce((n, t) => n + t.count, 0));
    const pre = await preflight({ sourceType: "server" });
    console.log("预检查：" + pre.checks.map(c => (c.ok ? "OK " : "FAIL ") + c.name + ": " + c.detail).join(" | "));
    assert(pre.passed, "隔离迁移预检查未通过");
    const task = startMigration({ sourceType: "server" });
    let latest;
    const started = Date.now();
    while (Date.now() - started < 180000) {
      await sleep(200);
      latest = getTask(task.id);
      if (latest.status !== lastStage) {
        lastStage = latest.status;
        console.log("迁移阶段=" + latest.status + " 已导入=" + latest.processedRows + "/" + latest.totalRows);
      }
      if (["READY_TO_SWITCH", "FAILED", "INTERRUPTED", "CANCELLED"].includes(latest.status)) break;
    }
    assert(latest && latest.status === "READY_TO_SWITCH",
      "迁移未完成：" + (latest?.status ?? "") + " " + (latest?.error ?? "") + " 当前表：" + (latest?.currentTable ?? "未知"));
    assert(latest.tables.every(t => t.status === "VERIFIED"), "存在未验证数据表");
    console.log("全量迁移与校验成功！校验表=" + latest.tables.length + " 行=" + latest.processedRows);
    // In the isolated process, simulate DB_TYPE=MYSQL startup and validate
    // the migration receipt, schema fingerprint, and runtime config loading.
    process.env.DB_TYPE = "MYSQL";
    const { initializeDatabase } = require("../dist/db/appDb");
    const { validateDatabaseSwitch } = require("../dist/operations/startup");
    const { configManager } = require("../dist/config/configManager");
    const client = await initializeDatabase();
    try {
      await validateDatabaseSwitch(client);
      await configManager.initialize();
      const users = await client.queryOne("SELECT COUNT(*) AS n FROM users");
      const adminUsers = await client.queryOne("SELECT COUNT(*) AS n FROM admin_users");
      console.log("MySQL 正式启动校验通过：users=" + users.n + " admin_users=" + adminUsers.n + " configReady=" + configManager.isInitialized());
    } finally {
      await client.close();
    }
  } finally {
    try { source?.close(); } catch {}
    process.chdir(root);
    try {
      if (created && admin) await admin.query("DROP DATABASE " + quote + database + quote);
    } finally {
      await admin?.end();
      fs.rmSync(scratch, { recursive: true, force: true });
    }
    console.log("隔离资源已清理；pm-db 和源 SQLite 未修改");
  }
}
main().catch(error => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error("INTEGRATION_FAILED:", msg.replace(/mysql:\/\/[^\s]+/g, "[REDACTED_CONNECTION]"));
  process.exitCode = 1;
});
