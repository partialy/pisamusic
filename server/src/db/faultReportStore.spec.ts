import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const dbPath = path.resolve(process.cwd(), "data/fault-report-store-test.db");
for (const suffix of ["", "-shm", "-wal"]) fs.rmSync(`${dbPath}${suffix}`, { force: true });
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.PISA_APP_DB_PATH = dbPath;

const reportId = "11111111-1111-4111-8111-111111111111";
const logOneId = "22222222-2222-4222-8222-222222222222";
const logTwoId = "33333333-3333-4333-8333-333333333333";

function input(id: string, logIds: string[]) {
  return {
    reportId: id,
    scene: "play_url" as const,
    environment: {
      appVersion: "1.2.3",
      appVersionCode: 123,
      osVersion: "15",
      sdkInt: 35,
      brand: "Test",
      model: "Device",
      networkType: "wifi",
    },
    logs: logIds.map((clientLogId, index) => ({
      clientLogId,
      occurredAt: 1_700_000_000_000 + index,
      scene: "play_url" as const,
      failureType: "empty_url",
      methodName: "PlayUrlGetter.getKgUrl",
      requestMethod: "GET",
      requestUrl: "https://example.com/url",
      requestParamsJson: "{\"quality\":\"320\"}",
      nonceId: `nonce-${index}`,
      responseCode: 200,
      responseBody: "{\"url\":\"\"}",
      resolvedUrl: "",
      errorType: "",
      errorMessage: "播放地址为空",
      stackTrace: "",
      songSource: "KG",
      songId: `song-${index}`,
      quality: "320",
    })),
  };
}

test("故障上报按客户端日志 UUID 去重并避免空批次", async () => {
  const store = await import("./faultReportStore.js");
  const first = store.createFaultReport(input(reportId, [logOneId]), null);
  assert.equal(first.acceptedCount, 1);
  assert.equal(first.duplicateCount, 0);
  assert.equal(first.reportId, reportId);

  const duplicate = store.createFaultReport(
    input("44444444-4444-4444-8444-444444444444", [logOneId]),
    null,
  );
  assert.equal(duplicate.acceptedCount, 0);
  assert.equal(duplicate.duplicateCount, 1);
  assert.equal(duplicate.reportId, null);

  const listed = store.listAdminFaultReports({});
  assert.equal(listed.total, 1);
});

test("部分重复时只保存新增日志", async () => {
  const store = await import("./faultReportStore.js");
  const result = store.createFaultReport(
    input("55555555-5555-4555-8555-555555555555", [logOneId, logTwoId]),
    null,
  );
  assert.equal(result.acceptedCount, 1);
  assert.equal(result.duplicateCount, 1);
  const detail = store.readAdminFaultReport(result.reportId!);
  assert.equal(detail?.logs.length, 1);
  assert.equal(detail?.logs[0]?.clientLogId, logTwoId);
});

test("有效用户可以绑定，状态可流转且删除级联明细", async () => {
  const store = await import("./faultReportStore.js");
  const { getAppDb } = await import("./appDb.js");
  const db = getAppDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, email, username, password_hash, avatar, avatar_key, sync_version, created_at, updated_at, last_login_at)
     VALUES (?, ?, ?, ?, '', 'default', 0, ?, ?, NULL)`,
  ).run("fault-user", "fault@example.com", "fault-user", "hash", now, now);
  const result = store.createFaultReport(
    input("66666666-6666-4666-8666-666666666666", ["77777777-7777-4777-8777-777777777777"]),
    "fault-user",
  );
  const processed = store.updateAdminFaultReportStatus(result.reportId!, "processed");
  assert.equal(processed?.userId, "fault-user");
  assert.equal(processed?.status, "processed");
  assert.ok(processed?.processedAt);
  assert.equal(store.deleteAdminFaultReport(result.reportId!), true);
  const child = db.prepare("SELECT 1 FROM fault_report_logs WHERE report_id = ?").get(result.reportId!);
  assert.equal(child, undefined);
});

test("校验日志数量、场景和字段长度", async () => {
  const store = await import("./faultReportStore.js");
  assert.throws(
    () => store.normalizeFaultReportCreateInput({ reportId, scene: "play_url", environment: {}, logs: [] }),
    /logs数量/,
  );
  const invalid = input("88888888-8888-4888-8888-888888888888", ["99999999-9999-4999-8999-999999999999"]);
  invalid.logs[0]!.responseBody = "x".repeat(4097);
  assert.throws(() => store.normalizeFaultReportCreateInput(invalid), /responseBody/);
});
