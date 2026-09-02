import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createConfigManager } from "./configManager";

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runtime_configs (
      key         TEXT    PRIMARY KEY,
      name        TEXT    NOT NULL DEFAULT '',
      value_json  TEXT    NOT NULL,
      updated_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dynamic_configs (
      id          TEXT    PRIMARY KEY,
      type        TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
  `);
  return db;
}

test("configManager: initialize populates missing defaults", () => {
  const db = createTestDb();
  const manager = createConfigManager(db);

  assert.strictEqual(manager.isInitialized(), false);
  manager.initialize();
  assert.strictEqual(manager.isInitialized(), true);

  // 默认值能够正确读取
  assert.strictEqual(manager.get("security.releaseDownloadTtlSeconds", 0), 300);
  assert.strictEqual(manager.get("security.downloadRateLimitMaxRequests", 0), 5);
  assert.strictEqual(manager.get("security.websiteDownloadBlockEmptyUserAgent", true), false);

  // 确认写入了 SQLite 且包含了中文 name
  const count = db.prepare("SELECT COUNT(*) as c FROM runtime_configs").get() as { c: number };
  assert.ok(count.c >= 35);
  const row = db.prepare("SELECT name FROM runtime_configs WHERE key = 'security.releaseDownloadTtlSeconds'").get() as { name: string };
  assert.strictEqual(row.name, "安装包/更新下载链接有效期");
});

test("configManager: setMany atomic update and subscription notification", () => {
  const db = createTestDb();
  const manager = createConfigManager(db);
  manager.initialize();

  let notifiedKeys: readonly string[] = [];
  const unsubscribe = manager.subscribe((keys) => {
    notifiedKeys = keys;
  });

  manager.setMany([
    { key: "security.releaseDownloadTtlSeconds", value: 600 },
    { key: "security.downloadRateLimitMaxRequests", value: 10 },
  ]);

  assert.strictEqual(manager.get("security.releaseDownloadTtlSeconds", 0), 600);
  assert.strictEqual(manager.get("security.downloadRateLimitMaxRequests", 0), 10);
  assert.deepStrictEqual(notifiedKeys, [
    "security.releaseDownloadTtlSeconds",
    "security.downloadRateLimitMaxRequests",
  ]);

  // DB 也已更新
  const row = db.prepare("SELECT value_json FROM runtime_configs WHERE key = 'security.releaseDownloadTtlSeconds'").get() as { value_json: string };
  assert.strictEqual(JSON.parse(row.value_json), 600);

  unsubscribe();
});

test("configManager: invalid batch fails atomically without altering memory or DB", () => {
  const db = createTestDb();
  const manager = createConfigManager(db);
  manager.initialize();

  assert.strictEqual(manager.get("security.releaseDownloadTtlSeconds", 0), 300);

  assert.throws(() => {
    manager.setMany([
      { key: "security.releaseDownloadTtlSeconds", value: 600 },
      { key: "invalid_key", value: 123 },
    ]);
  });

  // 内存与数据库均未被污染
  assert.strictEqual(manager.get("security.releaseDownloadTtlSeconds", 0), 300);
  const row = db.prepare("SELECT value_json FROM runtime_configs WHERE key = 'security.releaseDownloadTtlSeconds'").get() as { value_json: string };
  assert.strictEqual(JSON.parse(row.value_json), 300);
});
