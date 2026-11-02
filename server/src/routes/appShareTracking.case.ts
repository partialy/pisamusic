import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { once } from "node:events";
import test from "node:test";

process.env.PISA_APP_DB_PATH = path.resolve(__dirname, `../../data/app-share-http-${randomUUID()}.db`);
process.env.APP_SHARE_ATTRIBUTION_SECRET = "http-test-attribution-secret-only-32";

test("分享HTTP链路：严格身份、公开访问、双平台下载、管理失效与加密隔离", async () => {
  const { default: express } = await import("express");
  const { default: jwt } = await import("jsonwebtoken");
  const { getAppDb } = await import("../db/appDb.js");
  const { createUser } = await import("../db/userStore.js");
  const config = await import("../db/configStore.js");
  const { issueDeviceMessageToken } = await import("../middleware/deviceMessageToken.js");
  const { getUserJwtSecret } = await import("../middleware/requireUserJwt.js");
  const { requireAdminJwt, getAdminJwtSecret } = await import("../middleware/requireAdminJwt.js");
  const { setPlaintextPaths, encryptionMiddleware } = await import("../middleware/encryption.js");
  const { decrypt, randomFullKey } = await import("../crypto/aesGcm.js");
  const { configRouter } = await import("./config.js");
  const { appShareRouter } = await import("./appShare.js");
  const { adminAppShareRecordsRouter } = await import("./adminAppShareRecords.js");

  const db = getAppDb();
  const deviceId = randomUUID();
  const fingerprint = randomUUID();
  db.prepare(`INSERT INTO device_info
    (id,fingerprint,device_name,brand,model,os_version,sdk_version,app_version,app_version_code,first_seen_at,last_active_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(deviceId, fingerprint, "测试手机", "Test", "Test", "16", 36, "2.7.0", 526, Date.now(), Date.now());
  const deviceToken = issueDeviceMessageToken({ kind: "android", deviceId, fingerprint });
  const user = createUser({ email: "share-http@example.test", username: "分享联调", passwordHash: "fixture-unused" });
  const userToken = jwt.sign({ sub: user.id }, getUserJwtSecret(), { expiresIn: "1h" });
  const adminToken = jwt.sign({ sub: "test-admin" }, getAdminJwtSecret(), { expiresIn: "1h" });
  const current = config.readAppConfig();
  config.saveAppConfigSections({
    availability: { appAvailable: true, unavailableReason: "" },
    releases: {
      android: { ...current.releases.android, available: true, downloadUrl: "https://example.test/pisa.apk" },
      desktop: { ...current.releases.desktop, available: true, downloadUrl: "https://example.test/pisa.exe" },
    },
  });

  const app = express();
  app.use(express.json());
  setPlaintextPaths(["/api/config/app-share", "/api/config/download/*", "/api/app-share/public/*", "/api/app-share/visits"]);
  app.use(encryptionMiddleware());
  app.use("/api/config", configRouter);
  app.use("/api/app-share", appShareRouter);
  app.use("/api/admin/app-share-records", requireAdminJwt, adminAppShareRecordsRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const headers = { "user-agent": "Mozilla/5.0 AppShareIntegration", "content-type": "application/json" };
  const get = (url: string, extra: Record<string, string> = {}) => fetch(origin + url, { headers: { ...headers, ...extra }, redirect: "manual" });
  const count = (table: string) => Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
  try {
    const legacy = await get("/api/config/app-share");
    assert.equal((await legacy.json() as any).data.trackingEnabled, false);
    assert.equal(count("app_share_records"), 0);
    const legacyWithExpiredLogin = await get("/api/config/app-share", { authorization: "Bearer invalid" });
    assert.equal(legacyWithExpiredLogin.status, 200);
    assert.equal((await legacyWithExpiredLogin.json() as any).data.trackingEnabled, false);
    assert.equal(count("app_share_records"), 0);
    assert.equal((await get("/api/config/app-share", { "x-pm-device-token": "invalid" })).status, 401);
    assert.equal((await get("/api/config/app-share", { "x-pm-device-token": deviceToken, authorization: "Bearer invalid" })).status, 401);
    const guestResponse = await get("/api/config/app-share", { "x-pm-device-token": deviceToken });
    assert.equal(guestResponse.headers.get("cache-control"), "private, no-store");
    assert.match(guestResponse.headers.get("vary") ?? "", /Authorization/i);
    const guest = (await guestResponse.json() as any).data;
    assert.match(guest.shareCode, /^[a-zA-Z0-9]{6}$/);
    const authenticated = await get("/api/config/app-share", { "x-pm-device-token": deviceToken, authorization: `Bearer ${userToken}` });
    const accountShare = (await authenticated.json() as any).data;
    assert.notEqual(accountShare.shareCode, guest.shareCode);
    const publicDto = (await (await get(`/api/app-share/public/${accountShare.shareCode}`)).json() as any).data;
    assert.equal(publicDto.code, accountShare.shareCode);
    for (const key of ["userId", "deviceId", "fingerprint", "userName"]) assert.equal(publicDto[key], undefined);

    const visit = { eventId: randomUUID(), visitorId: randomUUID(), code: accountShare.shareCode, openedAt: Date.now(), sequence: 1 };
    const postVisit = (extra: Record<string, string> = {}) => fetch(origin + "/api/app-share/visits", { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(visit) });
    assert.equal((await postVisit({ purpose: "prefetch" })).status, 403);
    const accepted = await postVisit();
    assert.equal((await accepted.json() as any).data.accepted, true);
    const cookie = accepted.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.equal((await (await postVisit()).json() as any).data.accepted, false);
    assert.equal(count("app_share_visits"), 1);
    for (const platform of ["android", "desktop"]) {
      const response = await get(`/api/config/download/${platform}`, { cookie: cookie.split(";")[0] });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), `https://example.test/pisa.${platform === "android" ? "apk" : "exe"}`);
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    }
    await get("/api/config/download/android?code=invalid", { cookie: cookie.split(";")[0] });
    assert.equal(count("download_records"), 3);
    assert.equal(count("app_share_downloads"), 2);
    assert.equal((await get("/api/admin/app-share-records")).status, 401);
    assert.equal((await get("/api/admin/app-share-records", { authorization: `Bearer ${adminToken}` })).status, 401);
    const adminRequest = async (suffix = "", method = "GET") => {
      const response = await fetch(origin + "/api/admin/app-share-records" + suffix, { method, headers: { ...headers, authorization: `Bearer ${adminToken}`, "x-pm-random": randomFullKey() } });
      const envelope = await response.json() as { encData: string };
      return JSON.parse(decrypt(response.headers.get("x-pm-random")!, envelope.encData));
    };
    const listing = await adminRequest();
    const record = listing.data.items.find((item: any) => item.code === accountShare.shareCode);
    assert.equal(record.downloadCount, 2);
    assert.equal(record.visitCount, 1);
    assert.equal((await adminRequest(`/${record.id}/invalid`, "PATCH")).success, true);
    assert.equal((await get(`/api/app-share/public/${accountShare.shareCode}`)).status, 404);
    await get(`/api/config/download/android?code=${accountShare.shareCode}`, { cookie: cookie.split(";")[0] });
    assert.equal(count("app_share_downloads"), 2);
    const newShare = (await (await get("/api/config/app-share", { "x-pm-device-token": deviceToken, authorization: `Bearer ${userToken}` })).json() as any).data;
    assert.notEqual(newShare.shareCode, accountShare.shareCode);
    assert.equal((await adminRequest("/export")).data.csv.charCodeAt(0), 0xfeff);
    // 旧后台支持的站内相对安装包直链仍可触发下载，不要求迁移为七牛文件记录。
    const relativeConfig = config.readAppConfig();
    config.saveAppConfigSections({ releases: {
      ...relativeConfig.releases,
      android: { ...relativeConfig.releases.android, downloadUrl: "/uploads/releases/pisa.apk" },
    } });
    const relativeDownload = await get(`/api/config/download/android?code=${newShare.shareCode}`);
    assert.equal(relativeDownload.status, 302);
    assert.equal(relativeDownload.headers.get("location"), "/uploads/releases/pisa.apk");
    assert.equal(count("app_share_downloads"), 3);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
