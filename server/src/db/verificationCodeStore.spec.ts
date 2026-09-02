import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.PISA_APP_DB_PATH = path.join(mkdtempSync(path.join(os.tmpdir(), "pisamusic-vcode-")), "pm.db");

import { getAppDb } from "./appDb";
import {
  deleteVerificationCodeRecord,
  insertVerificationCodeRecord,
  listVerificationCodeRecords,
  markVerificationCodeVerified,
} from "./verificationCodeStore";

const NOW = 1_700_000_000_000;

test("verificationCodeStore: insert, query and mark verified", () => {
  const userId = "u_test_user_001";
  getAppDb().prepare(
    `INSERT INTO users (id, email, username, password_hash, avatar, avatar_key, sync_version, created_at, updated_at)
     VALUES (?, 'test@example.com', '测试用户', 'hash', '', 'default', 0, ?, ?)`,
  ).run(userId, NOW, NOW);

  const now = Date.now();

  // 1. 插入一条注册验证码
  const id1 = insertVerificationCodeRecord({
    channel: "email",
    target: "register@example.com",
    purpose: "register",
    code: "123456",
    deviceId: "dev_win_001",
    clientIp: "127.0.0.1",
    status: "sent",
    createdAt: now,
    expiresAt: now + 300_000,
  });

  // 2. 插入一条登录验证码（关联用户）
  const id2 = insertVerificationCodeRecord({
    channel: "phone",
    target: "13800138000",
    purpose: "login",
    code: "654321",
    userId,
    deviceId: "dev_android_001",
    clientIp: "192.168.1.1",
    status: "sent",
    createdAt: now + 1000,
    expiresAt: now + 301_000,
  });

  // 3. 查询全部
  const page1 = listVerificationCodeRecords({ limit: 10 });
  assert.equal(page1.total, 2);
  assert.equal(page1.items.length, 2);
  // 最近时间优先
  assert.equal(page1.items[0].id, id2);
  assert.equal(page1.items[0].user?.username, "测试用户");
  assert.equal(page1.items[1].id, id1);
  assert.equal(page1.items[1].user, null);

  // 4. 条件筛选：按 channel
  const phoneOnly = listVerificationCodeRecords({ channel: "phone" });
  assert.equal(phoneOnly.total, 1);
  assert.equal(phoneOnly.items[0].target, "13800138000");

  // 5. 条件筛选：按 purpose
  const registerOnly = listVerificationCodeRecords({ purpose: "register" });
  assert.equal(registerOnly.total, 1);
  assert.equal(registerOnly.items[0].code, "123456");

  // 6. 标记验证成功
  const verifiedSuccess = markVerificationCodeVerified("phone", "13800138000", "login", "654321");
  assert.equal(verifiedSuccess, true);

  const pageAfterVerify = listVerificationCodeRecords({ status: "verified" });
  assert.equal(pageAfterVerify.total, 1);
  assert.equal(pageAfterVerify.items[0].status, "verified");
  assert.ok(pageAfterVerify.items[0].verifiedAt! > 0);

  // 7. 删除记录
  const deleted = deleteVerificationCodeRecord(id1);
  assert.equal(deleted, true);

  const pageAfterDelete = listVerificationCodeRecords({});
  assert.equal(pageAfterDelete.total, 1);
});
