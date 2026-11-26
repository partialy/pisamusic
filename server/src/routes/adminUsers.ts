import { Router } from "express";
import { ACCOUNT_AVATAR_KEYS } from "../db/userStore";
import {
  batchAssignUserVip,
  deleteAdminUser,
  listAdminUserLibraryItems,
  listAdminUserSyncLogs,
  listAdminUsers,
  normalizeAdminAvatarKey,
  readAdminUserDetail,
  resolveAdminUsersByIdentifiers,
  updateAdminUser,
  type AdminUserLibraryKind,
  type AdminUserLibraryStatus,
  type AdminUserUpdateInput,
} from "../db/adminUserStore";
import { fail, ok } from "../types/response";

export const adminUsersRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_\-\u4e00-\u9fa5]{2,32}$/;
const USER_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const LIBRARY_KINDS: readonly AdminUserLibraryKind[] = ["favoriteSongs", "favoritePlaylists", "userPlaylists", "playlistTracks", "listeningHistory"];
const LIBRARY_STATUSES: readonly AdminUserLibraryStatus[] = ["active", "deleted", "all"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length <= max ? text : text.slice(0, max);
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeUserId(value: unknown): { ok: true; value: string } | { ok: false; msg: string } {
  const id = normalizeText(value, 128);
  if (!id) return { ok: false, msg: "用户 ID 不能为空" };
  if (!USER_ID_RE.test(id)) return { ok: false, msg: "用户 ID 不合法" };
  return { ok: true, value: id };
}

function validateEmail(email: string): string | null {
  if (!email) return "邮箱不能为空";
  if (email.length > 254 || !EMAIL_RE.test(email)) return "邮箱格式不正确";
  return null;
}

function validateUsername(username: string): string | null {
  if (!username) return "用户名不能为空";
  if (!USERNAME_RE.test(username)) return "用户名需为 2-32 位中文、字母、数字、下划线或短横线";
  return null;
}

function normalizeUpdatePayload(body: unknown): { ok: true; value: AdminUserUpdateInput } | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const patch: AdminUserUpdateInput = {};
  if ("username" in body) {
    const username = normalizeText(body.username, 32);
    const usernameError = validateUsername(username);
    if (usernameError) return { ok: false, msg: usernameError };
    patch.username = username;
  }
  if ("email" in body) {
    const email = normalizeEmail(body.email);
    const emailError = validateEmail(email);
    if (emailError) return { ok: false, msg: emailError };
    patch.email = email;
  }
  if ("avatarKey" in body) {
    const avatarKey = normalizeText(body.avatarKey, 64);
    const normalizedAvatarKey = normalizeAdminAvatarKey(avatarKey);
    if (!normalizedAvatarKey) {
      return { ok: false, msg: `头像不存在，可选值：${ACCOUNT_AVATAR_KEYS.join(", ")}` };
    }
    patch.avatarKey = normalizedAvatarKey;
  }
  const hasVipEnabled = "vipEnabled" in body;
  const hasVipExpiresAt = "vipExpiresAt" in body;
  const hasVipLevel = "vipLevel" in body;
  if (hasVipLevel) {
    const level = Number(body.vipLevel);
    if (!Number.isInteger(level) || level < 1 || level > 1000) {
      return { ok: false, msg: "VIP 等级必须是 1~1000 的整数" };
    }
    patch.vipLevel = level;
  }
  if (hasVipEnabled || hasVipExpiresAt) {
    if (!hasVipEnabled || typeof body.vipEnabled !== "boolean") {
      return { ok: false, msg: "修改 VIP 权益时必须提供布尔类型的 VIP 开关" };
    }
    patch.vipEnabled = body.vipEnabled;
    if (body.vipEnabled) {
      const expiresAt = body.vipExpiresAt;
      if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt) || !Number.isInteger(expiresAt) || expiresAt <= Date.now()) {
        return { ok: false, msg: "启用 VIP 时必须设置晚于当前时间的到期时间" };
      }
      patch.vipExpiresAt = expiresAt;
    } else {
      patch.vipExpiresAt = null;
    }
  }
  if (!("username" in patch) && !("email" in patch) && !("avatarKey" in patch) && !("vipEnabled" in patch) && !("vipLevel" in patch)) {
    return { ok: false, msg: "没有可更新的用户字段" };
  }
  return { ok: true, value: patch };
}

function parseIdentifiersInput(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[\s,;，；\r\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeLibraryKind(value: unknown): AdminUserLibraryKind | null {
  return typeof value === "string" && LIBRARY_KINDS.includes(value as AdminUserLibraryKind)
    ? (value as AdminUserLibraryKind)
    : null;
}

function normalizeLibraryStatus(value: unknown): AdminUserLibraryStatus | null {
  if (value === undefined || value === "") return "active";
  return typeof value === "string" && LIBRARY_STATUSES.includes(value as AdminUserLibraryStatus)
    ? (value as AdminUserLibraryStatus)
    : null;
}

adminUsersRouter.get("/", async (req, res) => {
  try {
    return res.json(ok((await listAdminUsers(req.query.keyword, req.query.offset, req.query.limit))));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取用户列表失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUsersRouter.post("/vip/resolve", async (req, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const identifiers = parseIdentifiersInput(req.body.identifiers ?? req.body.rawText);
    if (!identifiers.length) return res.status(400).json(fail("请输入至少一个邮箱或用户 ID", 400));
    if (identifiers.length > 500) return res.status(400).json(fail("单次最多查询 500 个标识", 400));
    return res.json(ok(await resolveAdminUsersByIdentifiers(identifiers)));
  } catch (e) {
    const message = e instanceof Error ? e.message : "批量查询用户失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUsersRouter.post("/vip/batch", async (req, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const userIds = Array.isArray(req.body.userIds)
      ? req.body.userIds.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
      : [];
    if (!userIds.length || userIds.length > 500) {
      return res.status(400).json(fail("userIds 必须包含 1 到 500 个用户 ID", 400));
    }
    const action = req.body.action === "revoke" ? "revoke" : "grant";
    if (action === "revoke") {
      return res.json(ok(await batchAssignUserVip({ userIds, action: "revoke" }), "已批量取消 VIP"));
    }

    const vipLevel = Number(req.body.vipLevel ?? 1);
    if (!Number.isInteger(vipLevel) || vipLevel < 1 || vipLevel > 1000) {
      return res.status(400).json(fail("VIP 等级必须是 1~1000 的整数", 400));
    }
    const mode = req.body.mode === "expires_at" ? "expires_at" : "duration_days";
    if (mode === "duration_days") {
      const durationDays = Number(req.body.durationDays);
      if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 36500) {
        return res.status(400).json(fail("赠送天数必须是 1~36500 的整数", 400));
      }
      return res.json(
        ok(
          await batchAssignUserVip({ userIds, action: "grant", vipLevel, durationDays }),
          "已批量赋予 VIP",
        ),
      );
    }

    const expiresAt = Number(req.body.expiresAt);
    if (!Number.isFinite(expiresAt) || !Number.isInteger(expiresAt) || expiresAt <= Date.now()) {
      return res.status(400).json(fail("指定到期时间必须晚于当前时间", 400));
    }
    return res.json(
      ok(
        await batchAssignUserVip({ userIds, action: "grant", vipLevel, expiresAt }),
        "已批量赋予 VIP",
      ),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "批量更新 VIP 失败";
    return res.status(400).json(fail(message, 400));
  }
});

adminUsersRouter.get("/:id", async (req, res) => {
  try {
    const id = normalizeUserId(req.params.id);
    if (!id.ok) return res.status(400).json(fail(id.msg, 400));
    const detail = (await readAdminUserDetail(id.value));
    if (!detail) return res.status(404).json(fail("用户不存在", 404));
    return res.json(ok(detail));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取用户详情失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUsersRouter.get("/:id/library", async (req, res) => {
  try {
    const id = normalizeUserId(req.params.id);
    if (!id.ok) return res.status(400).json(fail(id.msg, 400));
    const kind = normalizeLibraryKind(req.query.kind);
    if (!kind) return res.status(400).json(fail("数据类型不正确", 400));
    const status = normalizeLibraryStatus(req.query.status);
    if (!status) return res.status(400).json(fail("数据状态筛选不正确", 400));
    const playlistId = normalizeText(req.query.playlistId, 128) || undefined;
    const page = (await listAdminUserLibraryItems(id.value, kind, req.query.offset, req.query.limit ?? 30, { status, playlistId }));
    if (!page) return res.status(404).json(fail("用户不存在", 404));
    return res.json(ok(page));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取用户同步数据失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUsersRouter.get("/:id/sync-logs", async (req, res) => {
  try {
    const id = normalizeUserId(req.params.id);
    if (!id.ok) return res.status(400).json(fail(id.msg, 400));
    const page = await listAdminUserSyncLogs(id.value, {
      offset: req.query.offset,
      limit: req.query.limit ?? 30,
      itemType: req.query.itemType,
      action: req.query.action,
      deviceId: req.query.deviceId,
      keyword: req.query.keyword,
    });
    if (!page) return res.status(404).json(fail("用户不存在", 404));
    return res.json(ok(page));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取用户同步日志失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUsersRouter.put("/:id", async (req, res) => {
  try {
    const id = normalizeUserId(req.params.id);
    if (!id.ok) return res.status(400).json(fail(id.msg, 400));
    const payload = normalizeUpdatePayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    const updated = (await updateAdminUser(id.value, payload.value));
    if (!updated) return res.status(404).json(fail("用户不存在", 404));
    return res.json(ok(updated, "用户资料已保存"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存用户资料失败";
    const status = message === "该邮箱已被注册"
      || message === "该用户名已被使用"
      || message === "启用 VIP 时必须设置晚于当前时间的到期时间"
      ? 400
      : 500;
    return res.status(status).json(fail(message, status));
  }
});

adminUsersRouter.delete("/:id", async (req, res) => {
  try {
    const id = normalizeUserId(req.params.id);
    if (!id.ok) return res.status(400).json(fail(id.msg, 400));
    const deleted = (await deleteAdminUser(id.value));
    if (!deleted) return res.status(404).json(fail("用户不存在", 404));
    return res.json(ok(null, "用户已删除"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除用户失败";
    return res.status(500).json(fail(message, 500));
  }
});
