const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

async function main() {
  const id = randomUUID();
  const sourceFile = path.resolve("data/operations", `snapshot-smoke-${id}.db`);
  fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
  const db = new DatabaseSync(sourceFile);
  let snapshot;
  try {
    db.exec("PRAGMA journal_mode=WAL; CREATE TABLE smoke_backup(id INTEGER PRIMARY KEY, value TEXT NOT NULL);");
    db.prepare("INSERT INTO smoke_backup(value) VALUES (?)").run("包含 WAL 的已提交数据");
    process.env.PISA_APP_DB_PATH = sourceFile;
    const { createSnapshot, inspectSqlite, sourcePath, hashFile } = require("../dist/operations/sqliteSnapshots");
    snapshot = await createSnapshot({ sourceType: "server" });
    const target = sourcePath({ sourceType: "snapshot", sourceId: snapshot.id });
    const table = inspectSqlite(target).find(item => item.name === "smoke_backup");
    assert.equal(table?.count, 1);
    assert.equal(await hashFile(target), snapshot.sha256);
    const standalone = new DatabaseSync(target, { readOnly: true });
    try {
      assert.equal(standalone.prepare("SELECT value FROM smoke_backup WHERE id=1").get().value, "包含 WAL 的已提交数据");
    } finally { standalone.close(); }
    console.log("SQLite WAL 完整单文件备份烟测通过");
  } finally {
    db.close();
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(sourceFile + suffix, { force: true });
    if (snapshot) {
      const targetDir = path.resolve("data/operations/snapshots");
      fs.rmSync(path.join(targetDir, snapshot.id + ".db"), { force: true });
      fs.rmSync(path.join(targetDir, snapshot.id + ".json"), { force: true });
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
