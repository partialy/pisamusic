import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { before, describe } from "node:test";
import type { DatabaseSync } from "node:sqlite";

const testDbPath = path.resolve(process.cwd(), "data/website-record-store-test.db");

function cleanupTestDb() {
  for (const file of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
    if (!fs.existsSync(file)) continue;
    try {
      fs.unlinkSync(file);
    } catch {
      // 测试数据库可能仍被 Node 持有，留给下次覆盖。
    }
  }
}

describe("websiteRecordStore", () => {
  let db: DatabaseSync;

  before(async () => {
    cleanupTestDb();
    process.env.PISA_APP_DB_PATH = testDbPath;
    const appDb = await import("./appDb.js");
    db = appDb.getAppDb();

    db.prepare(
      `INSERT INTO site_visit_records (
        id, visit_day, visitor_hash, ip_address, path, referrer,
        user_agent, language, timezone, screen_width, screen_height, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "visit-old",
      "2026-08-26",
      "hash-old",
      "198.51.100.1",
      "/old",
      "https://old.example.com",
      "OldAgent/1.0",
      "zh-CN",
      "Asia/Shanghai",
      1280,
      720,
      1000,
    );
    db.prepare(
      `INSERT INTO site_visit_records (
        id, visit_day, visitor_hash, ip_address, path, referrer,
        user_agent, language, timezone, screen_width, screen_height, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "visit-new",
      "2026-08-27",
      "hash-new",
      "198.51.100.2",
      "/download",
      "https://new.example.com",
      "NewAgent/2.0",
      "en-US",
      "UTC",
      1920,
      1080,
      2000,
    );
    db.prepare(
      `INSERT INTO download_records (
        id, download_day, platform, version, file_record_id,
        ip_address, referrer, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "download-one",
      "2026-08-27",
      "desktop",
      "1.0.3",
      "file-1",
      "198.51.100.3",
      "https://pisamusic.partialy.cn",
      "DownloadAgent/1.0",
      3000,
    );
  });

  test("按记录类型分别分页并返回摘要字段", async () => {
    const { listAdminWebsiteRecords } = await import("./websiteRecordStore.js");
    const visits = listAdminWebsiteRecords("visit", { offset: 0, limit: 1 });
    const downloads = listAdminWebsiteRecords("download", { offset: 0, limit: 20 });

    assert.equal(visits.total, 2);
    assert.equal(visits.items.length, 1);
    assert.equal(visits.items[0]?.id, "visit-new");
    assert.equal("userAgent" in (visits.items[0] ?? {}), false);
    assert.equal(downloads.total, 1);
    assert.equal(downloads.items[0]?.id, "download-one");
    assert.equal("visitorHash" in (downloads.items[0] ?? {}), false);
  });

  test("详情返回对应表的完整 camelCase 字段", async () => {
    const { readAdminWebsiteRecordDetail } = await import("./websiteRecordStore.js");
    const visit = readAdminWebsiteRecordDetail("visit", "visit-new");
    const download = readAdminWebsiteRecordDetail("download", "download-one");

    assert.ok(visit && "visitorHash" in visit);
    assert.equal(visit.visitorHash, "hash-new");
    assert.equal(visit.userAgent, "NewAgent/2.0");
    assert.ok(download && "platform" in download);
    assert.equal(download.platform, "desktop");
    assert.equal(download.userAgent, "DownloadAgent/1.0");
  });

  test("记录不存在时返回 null", async () => {
    const { readAdminWebsiteRecordDetail } = await import("./websiteRecordStore.js");
    assert.equal(readAdminWebsiteRecordDetail("visit", "missing"), null);
    assert.equal(readAdminWebsiteRecordDetail("download", "missing"), null);
  });
});
