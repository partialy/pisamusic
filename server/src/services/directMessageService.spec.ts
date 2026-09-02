import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { before } from "node:test";

const dbPath = path.resolve(process.cwd(), "data/direct-message-store-test.db");

function cleanupTestDb() {
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
}

before(() => {
  cleanupTestDb();
  process.env.PISA_APP_DB_PATH = dbPath;
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

test("device message token only verifies against its current matching device", async () => {
  await seedRecipients();
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
