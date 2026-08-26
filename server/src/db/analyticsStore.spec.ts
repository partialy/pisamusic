import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { before, describe } from "node:test";
import type { DatabaseSync } from "node:sqlite";

const testDbPath = path.resolve(process.cwd(), "data/analytics-store-test.db");

function cleanupTestDb() {
  for (const file of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
    }
  }
}

describe("analyticsStore", () => {
  let db: DatabaseSync;

  before(async () => {
    cleanupTestDb();
    process.env.PISA_APP_DB_PATH = testDbPath;
    process.env.ANALYTICS_HASH_SALT = "test-salt-123456";
    const appDb = await import("./appDb.js");
    db = appDb.getAppDb();
  });

  const siteVisit = (visitorId: string, occurredAt: number) => ({
    visitorId,
    ipAddress: "1.2.3.4",
    path: "/",
    referrer: "https://example.com",
    userAgent: "Mozilla/5.0 Test",
    language: "zh-CN",
    timezone: "Asia/Shanghai",
    screenWidth: 1920,
    screenHeight: 1080,
    occurredAt,
  });

  test("同一访客同一上海自然日只记录一次", async () => {
    const store = await import("./analyticsStore.js");
    const first = store.recordSiteVisit(siteVisit("visitor-a", Date.parse("2026-08-26T01:00:00+08:00")));
    const duplicate = store.recordSiteVisit(siteVisit("visitor-a", Date.parse("2026-08-26T23:59:00+08:00")));
    assert.equal(first.accepted, true);
    assert.equal(duplicate.accepted, false);
    assert.equal(first.visitDay, "2026-08-26");
  });

  test("同一访客跨自然日和不同访客正常计数", async () => {
    const store = await import("./analyticsStore.js");
    assert.equal(store.recordSiteVisit(siteVisit("visitor-a", Date.parse("2026-08-27T00:01:00+08:00"))).accepted, true);
    assert.equal(store.recordSiteVisit(siteVisit("visitor-b", Date.parse("2026-08-27T08:00:00+08:00"))).accepted, true);
  });

  test("数据库中只保存 64 位十六进制 hash，不保存 visitorId 原文", async () => {
    const rows = db.prepare("SELECT visitor_hash FROM site_visit_records").all() as { visitor_hash: string }[];
    assert.ok(rows.length >= 3);
    for (const row of rows) {
      assert.match(row.visitor_hash, /^[0-9a-f]{64}$/);
      assert.notEqual(row.visitor_hash, "visitor-a");
      assert.notEqual(row.visitor_hash, "visitor-b");
    }
  });

  test("设备日活同一设备同日 upsert 且刷新最后活跃时间", async () => {
    const store = await import("./analyticsStore.js");
    const morning = Date.parse("2026-08-26T09:00:00+08:00");
    const evening = Date.parse("2026-08-26T20:00:00+08:00");

    store.recordDeviceDailyActivity({
      deviceType: "android",
      deviceId: "device-a",
      appVersion: "1.0.0",
      occurredAt: morning,
    });
    store.recordDeviceDailyActivity({
      deviceType: "android",
      deviceId: "device-a",
      appVersion: "1.0.1",
      occurredAt: evening,
    });

    const row = db.prepare("SELECT * FROM device_daily_activity WHERE device_id = ?").get("device-a") as Record<string, unknown>;
    assert.equal(row.app_version, "1.0.1");
    assert.equal(row.last_seen_at, evening);
  });

  test("官网下载按平台保存每次有效重定向", async () => {
    const store = await import("./analyticsStore.js");
    const noon = Date.parse("2026-08-26T12:00:00+08:00");

    store.recordDownload({
      platform: "android",
      version: "1.2.3",
      fileRecordId: "file-123",
      ipAddress: "1.1.1.1",
      referrer: "https://pisamusic.partialy.cn",
      userAgent: "TestAgent",
      occurredAt: noon,
    });
    store.recordDownload({
      platform: "android",
      version: "1.2.3",
      fileRecordId: "file-123",
      ipAddress: "1.1.1.1",
      referrer: "https://pisamusic.partialy.cn",
      userAgent: "TestAgent",
      occurredAt: noon + 1000,
    });

    const count = db.prepare("SELECT COUNT(*) AS total FROM download_records").get() as { total: number };
    assert.equal(count.total, 2);
  });
});
