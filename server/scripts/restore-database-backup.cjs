/** 离线恢复到 env 中另一种数据库：停止目标服务后执行，绝不切换 DB_TYPE。 */
require("dotenv/config");
const { restoreTargetBackup } = require("../dist/operations/migrationEngine");
const id = process.argv[2];
if (!/^[a-f0-9-]{36}$/.test(id || "") || process.argv[3] !== "--confirm-target-offline") {
  console.error("用法：node scripts/restore-database-backup.cjs <备份ID> --confirm-target-offline\n当前 DB_TYPE 指定源库，恢复到 env 中配置的另一种数据库；先停止目标服务。");
  process.exitCode = 2;
} else {
  restoreTargetBackup(id, true).then(() => console.log("目标库已恢复并完成校验；请核对后启动目标服务。"), error => {
    const { safeError } = require("../dist/operations/mysqlTarget");
    console.error(safeError(error)); process.exitCode = 1;
  });
}
