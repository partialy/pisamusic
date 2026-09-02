import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

const dbPath = path.resolve(process.cwd(), "data/direct-message-store-test.db");
let messageServer: Server | null = null;
let messageServerUrl = "";

function cleanupTestDb() {
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
}

before(() => {
  cleanupTestDb();
  process.env.PISA_APP_DB_PATH = dbPath;
  process.env.USER_JWT_SECRET = "direct-message-user-test-secret";
  process.env.DEVICE_MESSAGE_JWT_SECRET = "direct-message-token-test-secret";
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!messageServer) return resolve();
    messageServer.close((error) => error ? reject(error) : resolve());
  });
});

async function store() {
  return import("../db/directMessageStore.js");
}

async function db() {
  const { getAppDb } = await import("../db/appDb.js");
  return getAppDb();
}

async function seedRecipients() {
  const appDb = await db();
  const now = 1_000;
  appDb.exec("DELETE FROM direct_messages; DELETE FROM users; DELETE FROM device_info; DELETE FROM desktop_device_info;");
  appDb.prepare(
    `INSERT INTO users (id, email, username, password_hash, avatar, avatar_key, sync_version, created_at, updated_at)
     VALUES (?, ?, ?, 'hash', '', 'default', 0, ?, ?)`,
  ).run("u1", "u1@example.com", "u1", now, now);
  appDb.prepare(
    `INSERT INTO users (id, email, username, password_hash, avatar, avatar_key, sync_version, created_at, updated_at)
     VALUES (?, ?, ?, 'hash', '', 'default', 0, ?, ?)`,
  ).run("u2", "u2@example.com", "u2", now, now);
  appDb.prepare(
    `INSERT INTO device_info (
      id, fingerprint, device_name, brand, model, os_version, sdk_version, app_version, app_version_code, first_seen_at, last_active_at
    ) VALUES (?, ?, 'Android', 'Test', 'A1', '15', 35, '1.0.0', 1, ?, ?)`,
  ).run("d1", "fingerprint-d1", now, now);
  appDb.prepare(
    `INSERT INTO device_info (
      id, fingerprint, device_name, brand, model, os_version, sdk_version, app_version, app_version_code, first_seen_at, last_active_at
    ) VALUES (?, ?, 'Android', 'Test', 'A2', '15', 35, '1.0.0', 1, ?, ?)`,
  ).run("d2", "fingerprint-d2", now, now);
  appDb.prepare(
    `INSERT INTO desktop_device_info (
      id, fingerprint, device_name, hostname, os_name, os_version, platform, arch, app_version, first_seen_at, last_active_at
    ) VALUES (?, ?, 'Desktop', 'test-host', 'Windows', '11', 'win32', 'x64', '1.0.0', ?, ?)`,
  ).run("pc1", "fingerprint-pc1", now, now);
}

async function requestMessages(pathname: string, init: RequestInit = {}): Promise<{ status: number; body: { data: unknown; success: boolean; code: number } }> {
  if (!messageServer) {
    const { messagesRouter } = await import("../routes/messages.js");
    const app = express();
    app.use(express.json());
    app.use("/api/messages", messagesRouter);
    messageServer = createServer(app);
    await new Promise<void>((resolve) => messageServer!.listen(0, "127.0.0.1", resolve));
    const address = messageServer.address();
    if (!address || typeof address === "string") throw new Error("测试 HTTP 服务启动失败");
    messageServerUrl = `http://127.0.0.1:${address.port}`;
  }
  const response = await fetch(`${messageServerUrl}${pathname}`, init);
  return { status: response.status, body: await response.json() as { data: unknown; success: boolean; code: number } };
}

async function identityHeaders(userId?: string, device?: { kind: "android" | "desktop"; id: string; fingerprint: string }): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (userId) headers.authorization = `Bearer ${jwt.sign({ sub: userId }, process.env.USER_JWT_SECRET!)}`;
  if (device) {
    const tokens = await import("../middleware/deviceMessageToken.js");
    headers["x-pm-device-token"] = tokens.issueDeviceMessageToken({
      kind: device.kind,
      deviceId: device.id,
      fingerprint: device.fingerprint,
    });
  }
  return headers;
}

test("device message token only verifies against its current matching device", async () => {
  await seedRecipients();
  const originalDeviceSecret = process.env.DEVICE_MESSAGE_JWT_SECRET;
  const originalUserSecret = process.env.USER_JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "test";
    process.env.DEVICE_MESSAGE_JWT_SECRET = "direct-message-token-test-secret";
    const tokens = await import("../middleware/deviceMessageToken.js");
    const token = tokens.issueDeviceMessageToken({
      kind: "android",
      deviceId: "d1",
      fingerprint: "fingerprint-d1",
    });
    assert.deepEqual(tokens.verifyDeviceMessageToken(token), {
      kind: "android",
      deviceId: "d1",
      fingerprint: "fingerprint-d1",
    });

    process.env.DEVICE_MESSAGE_JWT_SECRET = "different-direct-message-token-test-secret";
    assert.equal(tokens.verifyDeviceMessageToken(token), null);
    process.env.DEVICE_MESSAGE_JWT_SECRET = "direct-message-token-test-secret";

    const appDb = await db();
    appDb.prepare("DELETE FROM device_info WHERE id = ?").run("d1");
    assert.equal(tokens.verifyDeviceMessageToken(token), null);

    process.env.NODE_ENV = "production";
    delete process.env.DEVICE_MESSAGE_JWT_SECRET;
    delete process.env.USER_JWT_SECRET;
    assert.throws(() => tokens.getDeviceMessageJwtSecret(), /必须配置 DEVICE_MESSAGE_JWT_SECRET/);
  } finally {
    if (originalDeviceSecret === undefined) delete process.env.DEVICE_MESSAGE_JWT_SECRET;
    else process.env.DEVICE_MESSAGE_JWT_SECRET = originalDeviceSecret;
    if (originalUserSecret === undefined) delete process.env.USER_JWT_SECRET;
    else process.env.USER_JWT_SECRET = originalUserSecret;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test("one message has exactly one recipient", async () => {
  await seedRecipients();
  const appDb = await db();
  assert.throws(
    () => appDb.prepare(
      `INSERT INTO direct_messages (id, user_id, android_device_id, content, created_by_admin, created_at)
       VALUES ('invalid', 'u1', 'd1', 'text', 'admin', 1)`,
    ).run(),
  );
});

test("unread messages merge user and current device in stable ascending order", async () => {
  await seedRecipients();
  const messages = await store();
  messages.insertDirectMessage({ id: "m-old-user", target: { kind: "user", id: "u1" }, content: "old", createdByAdmin: "admin", createdAt: 10 });
  messages.insertDirectMessage({ id: "m-device", target: { kind: "android_device", id: "d1" }, content: "device", createdByAdmin: "admin", createdAt: 20 });
  messages.insertDirectMessage({ id: "m-new-user", target: { kind: "user", id: "u1" }, content: "new", createdByAdmin: "admin", createdAt: 30 });
  const page = messages.listUnreadDirectMessages({ userId: "u1", device: { kind: "android", id: "d1" } }, 50);
  assert.deepEqual(page.items.map((item) => item.id), ["m-old-user", "m-device", "m-new-user"]);
  assert.equal(page.hasMore, false);
});

test("another user or device cannot read or acknowledge the message", async () => {
  await seedRecipients();
  const messages = await store();
  messages.insertDirectMessage({ id: "m1", target: { kind: "user", id: "u1" }, content: "private", createdByAdmin: "admin", createdAt: 10 });
  const otherIdentity = { userId: "u2", device: { kind: "android" as const, id: "d2" } };
  assert.equal(messages.readDirectMessageForIdentity(otherIdentity, "m1"), null);
  assert.equal(messages.markDirectMessageRead(otherIdentity, "m1", 99), null);
});

test("read receipt is idempotent and keeps the first read time", async () => {
  await seedRecipients();
  const messages = await store();
  messages.insertDirectMessage({ id: "m1", target: { kind: "android_device", id: "d1" }, content: "private", createdByAdmin: "admin", createdAt: 10 });
  const identity = { userId: null, device: { kind: "android" as const, id: "d1" } };
  const first = messages.markDirectMessageRead(identity, "m1", 100)!;
  const second = messages.markDirectMessageRead(identity, "m1", 200)!;
  assert.equal(second.readAt, first.readAt);
  assert.equal(first.readAt, 100);
});

test("deleting recipient cascades its direct messages", async () => {
  await seedRecipients();
  const messages = await store();
  const appDb = await db();
  messages.insertDirectMessage({ id: "m1", target: { kind: "user", id: "u1" }, content: "private", createdByAdmin: "admin", createdAt: 10 });
  appDb.prepare("DELETE FROM users WHERE id = ?").run("u1");
  const row = appDb.prepare("SELECT COUNT(*) AS count FROM direct_messages WHERE id = 'm1'").get() as { count: number };
  assert.equal(row.count, 0);
});

test("service validates content and concrete recipients", async () => {
  await seedRecipients();
  const service = await import("./directMessageService.js");
  assert.throws(
    () => service.createDirectMessage({ targetKind: "user", targetId: "u1", content: "   ", createdByAdmin: "admin" }),
    service.DirectMessageValidationError,
  );
  assert.throws(
    () => service.createDirectMessage({ targetKind: "user", targetId: "u1", content: "x".repeat(2_001), createdByAdmin: "admin" }),
    service.DirectMessageValidationError,
  );
  assert.throws(
    () => service.createDirectMessage({ targetKind: "android_device", targetId: "missing", content: "hello", createdByAdmin: "admin" }),
    service.DirectMessageTargetNotFoundError,
  );
});

test("message route composes identities, normalizes limit, and hides unauthorized receipts", async () => {
  await seedRecipients();
  const messages = await store();
  messages.insertDirectMessage({ id: "u-old", target: { kind: "user", id: "u1" }, content: "user old", createdByAdmin: "admin", createdAt: 10 });
  messages.insertDirectMessage({ id: "d-current", target: { kind: "android_device", id: "d1" }, content: "device", createdByAdmin: "admin", createdAt: 20 });
  messages.insertDirectMessage({ id: "u-new", target: { kind: "user", id: "u1" }, content: "user new", createdByAdmin: "admin", createdAt: 30 });
  messages.insertDirectMessage({ id: "d-other", target: { kind: "android_device", id: "d2" }, content: "other device", createdByAdmin: "admin", createdAt: 40 });

  const userHeaders = await identityHeaders("u1");
  const deviceHeaders = await identityHeaders(undefined, { kind: "android", id: "d1", fingerprint: "fingerprint-d1" });
  const combinedHeaders = { ...userHeaders, ...deviceHeaders };

  const noIdentity = await requestMessages("/api/messages/unread");
  assert.equal(noIdentity.status, 401);

  const userOnly = await requestMessages("/api/messages/unread?limit=1", { headers: userHeaders });
  assert.equal(userOnly.status, 200);
  assert.deepEqual((userOnly.body.data as { items: Array<{ id: string }>; hasMore: boolean }).items.map((item) => item.id), ["u-old"]);
  assert.equal((userOnly.body.data as { hasMore: boolean }).hasMore, true);

  const negativeLimit = await requestMessages("/api/messages/unread?limit=-1", { headers: userHeaders });
  assert.equal(negativeLimit.status, 200);
  assert.deepEqual((negativeLimit.body.data as { items: Array<{ id: string }> }).items.map((item) => item.id), ["u-old"]);
  assert.equal((negativeLimit.body.data as { hasMore: boolean }).hasMore, true);

  const deviceOnly = await requestMessages("/api/messages/unread?limit=0", { headers: deviceHeaders });
  assert.equal(deviceOnly.status, 200);
  assert.deepEqual((deviceOnly.body.data as { items: Array<{ id: string }> }).items.map((item) => item.id), ["d-current"]);

  const combined = await requestMessages("/api/messages/unread?limit=99", { headers: combinedHeaders });
  assert.equal(combined.status, 200);
  assert.deepEqual((combined.body.data as { items: Array<{ id: string }> }).items.map((item) => item.id), ["u-old", "d-current", "u-new"]);

  const otherHeaders = await identityHeaders("u2", { kind: "android", id: "d2", fingerprint: "fingerprint-d2" });
  const unauthorizedRead = await requestMessages("/api/messages/u-old/read", { method: "POST", headers: otherHeaders });
  assert.equal(unauthorizedRead.status, 404);

  const firstRead = await requestMessages("/api/messages/u-old/read", { method: "POST", headers: combinedHeaders });
  assert.equal(firstRead.status, 200);
  const secondRead = await requestMessages("/api/messages/u-old/read", { method: "POST", headers: combinedHeaders });
  assert.equal(secondRead.status, 200);
  assert.equal(
    (secondRead.body.data as { readAt: number }).readAt,
    (firstRead.body.data as { readAt: number }).readAt,
  );
});
