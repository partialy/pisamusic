import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { before, describe } from "node:test";
import type { DatabaseSync } from "node:sqlite";

const testDbPath = path.resolve(process.cwd(), "data/dashboard-store-test.db");

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

describe("dashboardStore", () => {
  let db: DatabaseSync;
  const now = Date.parse("2026-08-26T12:00:00+08:00");
  const yesterday = Date.parse("2026-08-25T12:00:00+08:00");
  const tenDaysAgo = Date.parse("2026-08-16T12:00:00+08:00");

  before(async () => {
    cleanupTestDb();
    process.env.PISA_APP_DB_PATH = testDbPath;
    process.env.ANALYTICS_HASH_SALT = "dashboard-test-salt";
    const appDb = await import("./appDb.js");
    db = appDb.getAppDb();

    // 1. Seed users
    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, created_at, updated_at, last_login_at)
      VALUES
        ('u1', 'u1@test.com', 'user1', 'hash', ?, ?, ?),
        ('u2', 'u2@test.com', 'user2', 'hash', ?, ?, ?),
        ('u3', 'u3@test.com', 'user3', 'hash', ?, ?, ?)
    `).run(
      tenDaysAgo, tenDaysAgo, tenDaysAgo,
      yesterday, yesterday, yesterday,
      now, now, now,
    );

    // 2. Seed devices
    db.prepare(`
      INSERT INTO device_info (id, fingerprint, device_name, brand, model, os_version, sdk_version, app_version, app_version_code, first_seen_at, last_active_at)
      VALUES
        ('d1', 'fp1', 'Phone 1', 'Xiaomi', 'Mi 11', '12', 31, '1.2.0', 12, ?, ?),
        ('d2', 'fp2', 'Phone 2', 'Huawei', 'Mate 40', '10', 29, '1.2.0', 12, ?, ?)
    `).run(
      tenDaysAgo, now,
      now, now,
    );

    db.prepare(`
      INSERT INTO desktop_device_info (id, fingerprint, device_name, hostname, os_name, os_version, platform, arch, app_version, first_seen_at, last_active_at)
      VALUES
        ('pc1', 'pcfp1', 'PC 1', 'host1', 'Windows', '10.0', 'win32', 'x64', '2.0.0', ?, ?)
    `).run(
      now, now,
    );

    // 3. Seed daily activity
    const analyticsStore = await import("./analyticsStore.js");
    analyticsStore.recordDeviceDailyActivity({
      deviceType: "android",
      deviceId: "d1",
      appVersion: "1.2.0",
      occurredAt: yesterday,
    });
    analyticsStore.recordDeviceDailyActivity({
      deviceType: "android",
      deviceId: "d2",
      appVersion: "1.2.0",
      occurredAt: now,
    });
    analyticsStore.recordDeviceDailyActivity({
      deviceType: "desktop",
      deviceId: "pc1",
      appVersion: "2.0.0",
      occurredAt: now,
    });

    // 4. Seed visits (2 visits across 7d)
    analyticsStore.recordSiteVisit({
      visitorId: "11111111-1111-4111-8111-111111111111",
      ipAddress: "198.51.100.1",
      path: "/",
      referrer: "https://google.com",
      userAgent: "SecretAgent/1.0",
      language: "zh-CN",
      timezone: "Asia/Shanghai",
      screenWidth: 1920,
      screenHeight: 1080,
      occurredAt: yesterday,
    });
    analyticsStore.recordSiteVisit({
      visitorId: "22222222-2222-4222-8222-222222222222",
      ipAddress: "198.51.100.2",
      path: "/",
      referrer: "https://bing.com",
      userAgent: "SecretAgent/2.0",
      language: "zh-CN",
      timezone: "Asia/Shanghai",
      screenWidth: 1920,
      screenHeight: 1080,
      occurredAt: now,
    });

    // 5. Seed downloads (1 download in 7d -> 50% conversion)
    analyticsStore.recordDownload({
      platform: "android",
      version: "1.2.0",
      fileRecordId: "fr-1",
      ipAddress: "198.51.100.3",
      referrer: "https://pisamusic.partialy.cn",
      userAgent: "SecretAgent/3.0",
      occurredAt: now,
    });
  });

  test("仪表盘返回固定天数并对缺失日期补零", async () => {
    const { readAdminDashboard } = await import("./dashboardStore.js");
    const result = readAdminDashboard(7, now);
    assert.equal(result.daily.length, 7);
    assert.equal(result.daily[0]?.date, "2026-08-20");
    assert.equal(result.daily[6]?.date, "2026-08-26");
    assert.ok(result.daily.some((point) => point.siteVisits === 0));
  });

  test("汇总区正确拆分平台并计算转化率", async () => {
    const { readAdminDashboard } = await import("./dashboardStore.js");
    const result = readAdminDashboard(30, now);
    assert.equal(result.summary.totalDevices, result.summary.androidDevices + result.summary.desktopDevices);
    assert.equal(result.summary.siteVisits7d, 2);
    assert.equal(result.summary.downloads7d, 1);
    assert.equal(result.summary.downloadConversion7d, 50);
    assert.deepEqual(
      result.distributions.devicePlatforms.map((item) => item.name),
      ["Android", "PC"],
    );
  });

  test("仪表盘响应中不包含任何 IP、visitor_hash 或 User-Agent", async () => {
    const { readAdminDashboard } = await import("./dashboardStore.js");
    const result = readAdminDashboard(30, now);
    const jsonStr = JSON.stringify(result);

    assert.equal(jsonStr.includes("198.51.100"), false);
    assert.equal(jsonStr.includes("SecretAgent"), false);
    assert.equal(jsonStr.includes("11111111-1111"), false);
    assert.equal(jsonStr.includes("visitor_hash"), false);
  });
});
