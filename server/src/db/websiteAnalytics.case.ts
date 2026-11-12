import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { request } from "node:http";
import test from "node:test";
import express from "express";
import { normalizeWebsiteDomain, getWebsiteDomain, sanitizeWebsiteReferrer } from "../utils/websiteDomain";
import type { Request } from "express";

process.env.DB_TYPE = "SQLITE";
process.env.PISA_APP_DB_PATH = path.resolve(__dirname, `../../data/website-analytics-${randomUUID()}.db`);
process.env.ANALYTICS_HASH_SALT = "website-domain-test-salt";

test("Host 规范化与隐私清理不信任转发头", () => {
  assert.equal(normalizeWebsiteDomain("A.Example.Com.:443"), "a.example.com");
  assert.equal(normalizeWebsiteDomain("[::1]:3000"), "[::1]");
  for (const host of ["a.com,b.com", "a.com/path", "a.com@b.com", "a.com:99999", "a..com", "-bad.com", "bad\n.com"]) assert.equal(normalizeWebsiteDomain(host), "");
  assert.equal(getWebsiteDomain({ headers: { host: "a.com", "x-forwarded-host": "evil.com" } } as unknown as Request), "a.com");
  assert.equal(sanitizeWebsiteReferrer("https://user:pass@example.com/path?q=secret#code"), "https://example.com/path");
  assert.equal(sanitizeWebsiteReferrer("https://example.com/app-share/ABC123?code=secret"), "https://example.com/app-share/");
});

test("域名UV、PV幂等、事务回滚、下载归因、筛选与聚合", async () => {
  const { initializeDatabase } = await import("./appDb.js");
  const { recordPageView, recordDownload, hashVisitorId, maybeCleanupAnalytics } = await import("./analyticsStore.js");
  const { listAdminWebsiteRecords } = await import("./websiteRecordStore.js");
  const { readWebsiteStats } = await import("./websiteStatsStore.js");
  const { trackWebsiteDownload } = await import("../services/appShareTrackingService.js");
  const { analyticsRouter } = await import("../routes/analytics.js");
  const { adminWebsiteRecordsRouter } = await import("../routes/adminWebsiteRecords.js");
  const db = await initializeDatabase();
  const now = Date.now();
  const event = { eventId: randomUUID(), visitorId: randomUUID(), domain: "a.example.com", path: "/listen/", referrer: "", ipAddress: "127.0.0.1", userAgent: "Browser", language: "zh-CN", timezone: "Asia/Shanghai", screenWidth: 1920, screenHeight: 1080, occurredAt: now };
  try {
    const first = await recordPageView(event);
    assert.equal(first.pvAccepted, true);
    assert.equal(first.uvAccepted, true);
    assert.deepEqual(await recordPageView(event), { ...first, pvAccepted: false, uvAccepted: false });
    assert.equal((await recordPageView({ ...event, eventId: randomUUID() })).uvAccepted, false);
    assert.equal((await recordPageView({ ...event, eventId: randomUUID(), domain: "b.example.com" })).uvAccepted, true);
    // 午夜后重试已存在事件不能在新一天凭空生成UV。
    await recordPageView({ ...event, occurredAt: now + 86400000 });
    assert.equal(Number((await db.queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM site_visit_records"))!.n), 2);
    await db.execute("CREATE TRIGGER fail_website_uv BEFORE INSERT ON site_visit_records BEGIN SELECT RAISE(ABORT, 'uv fail'); END");
    const failedId = randomUUID();
    await assert.rejects(recordPageView({ ...event, eventId: failedId, visitorId: randomUUID() }));
    assert.equal(await db.queryOne("SELECT id FROM site_page_view_records WHERE id=?", [failedId]), null);
    await db.execute("DROP TRIGGER fail_website_uv");
    const download = { platform: "android" as const, version: "1", fileRecordId: null, ipAddress: "", userAgent: "Browser", referrer: "", occurredAt: now };
    const tracking = await import("./appShareTrackingStore.js");
    const share = await tracking.getOrCreateTrackingRecord({ deviceKind: "android", deviceId: "domain-test-device", userId: null, userName: "游客", deviceName: "测试" });
    const downloadReq = { headers: { host: "A.Example.Com:443" }, query: { code: share.code }, header: () => "" } as unknown as Request;
    await trackWebsiteDownload(downloadReq, download);
    assert.equal((await tracking.readTrackingCode(share.code))!.android_download_count, 1);
    assert.equal(Number((await db.queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM app_share_downloads a JOIN download_records d ON d.id=a.download_record_id WHERE d.domain='a.example.com'"))!.n), 1);
    await db.execute("CREATE TRIGGER fail_website_attribution BEFORE INSERT ON app_share_downloads BEGIN SELECT RAISE(ABORT, 'attribution fail'); END");
    await assert.rejects(trackWebsiteDownload(downloadReq, download));
    assert.equal(Number((await db.queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM download_records"))!.n), 1);
    await db.execute("DROP TRIGGER fail_website_attribution");
    await recordDownload({ ...download, domain: "b.example.com", platform: "desktop" });
    const all = await readWebsiteStats(7, undefined, now);
    assert.equal(all.summary.uv, 2);
    assert.equal(all.summary.pv, 3);
    assert.equal(all.summary.downloads, 2);
    assert.equal(all.summary.androidDownloads, 1);
    assert.equal(all.summary.desktopDownloads, 1);
    assert.equal(all.trend.length, 7);
    assert.equal(all.trend.slice(0, -1).every(p => p.pv === 0), true);
    assert.deepEqual(all.topPages, [{ path: "/listen/", pv: 3 }]);
    assert.equal((await readWebsiteStats(7, "a.example.com", now)).summary.pv, 2);
    assert.equal((await readWebsiteStats(7, "", now)).summary.uv, 0);
    const list = await listAdminWebsiteRecords("download", { domain: "a.example.com", startDay: all.startDay, endDay: all.endDay });
    assert.equal(list.total, 1);
    assert.equal(list.items[0]!.domain, "a.example.com");
    assert.equal((await listAdminWebsiteRecords("visit", { domain: "b.example.com", endDay: "2000-01-01" })).total, 0);
    assert.equal(JSON.stringify(all).includes(hashVisitorId(event.visitorId)), false);

    const app = express();
    app.use(express.json());
    app.use("/api/analytics", analyticsRouter);
    app.use("/api/admin/website-records", adminWebsiteRecordsRouter);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    try {
      const address = server.address() as { port: number };
      const base = `http://127.0.0.1:${address.port}`;
      const send = () => new Promise<{ data: { pvAccepted: boolean } }>((resolve, reject) => {
        const req = request(`${base}/api/analytics/page-view`, { method: "POST", headers: { "Content-Type": "application/json", Host: "c.example.com", "X-Forwarded-Host": "wrong.example.com", "User-Agent": "Mozilla/5.0 (Linux; Android 10; CUBOT X30)" } }, res => {
          let result = "";
          res.on("data", chunk => { result += chunk; });
          res.on("end", () => { try { resolve(JSON.parse(result)); } catch (error) { reject(error); } });
        });
        req.on("error", reject);
        req.end(JSON.stringify({ ...event, eventId: httpId, path: "/app-share/ABC123?code=secret#secret", referrer: "https://example.com/path?token=secret" }));
      });
      const httpId = randomUUID();
      assert.equal((await send()).data.pvAccepted, true);
      assert.equal((await send()).data.pvAccepted, false);
      const row = await db.queryOne<{ domain: string; path: string; referrer: string }>("SELECT domain,path,referrer FROM site_page_view_records WHERE id=?", [httpId]);
      assert.deepEqual({ ...row }, { domain: "c.example.com", path: "/app-share/", referrer: "https://example.com/path" });
      assert.equal((await fetch(`${base}/api/admin/website-records/stats?days=8`)).status, 400);
      assert.equal((await fetch(`${base}/api/admin/website-records?type=visit&startDay=2026-02-30`)).status, 400);
      const response = await (await fetch(`${base}/api/admin/website-records/stats?days=7&domain=c.example.com`)).json();
      assert.equal(response.data.summary.pv, 1);
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    await db.execute("UPDATE site_page_view_records SET created_at=?", [now - 181 * 86400000]);
    await maybeCleanupAnalytics(now + 86400000);
    assert.equal(Number((await db.queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM site_page_view_records"))!.n), 0);
  } finally { await db.close(); }
});
