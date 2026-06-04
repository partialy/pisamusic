import { Router } from "express";
import { ACCOUNT_AVATAR_KEYS } from "../db/userStore";
import {
  deleteAdminUser,
  listAdminUserLibraryItems,
  listAdminUsers,
  normalizeAdminAvatarKey,
  readAdminUserDetail,
  updateAdminUser,
  type AdminUserLibraryKind,
  type AdminUserUpdateInput,
} from "../db/adminUserStore";
import { fail, ok } from "../types/response";

export const adminUsersRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_\-\u4e00-\u9fa5]{2,32}$/;
const USER_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const LIBRARY_KINDS: readonly AdminUserLibraryKind[] = ["favoriteSongs", "favoritePlaylists", "userPlaylists"];

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
  if (!("username" in patch) && !("email" in patch) && !("avatarKey" in patch)) {
    return { ok: false, msg: "没有可更新的用户字段" };
  }
  return { ok: true, value: patch };
}

function normalizeLibraryKind(value: unknown): AdminUserLibraryKind | null {
  return typeof value === "string" && LIBRARY_KINDS.includes(value as AdminUserLibraryKind)
    ? (value as AdminUserLibraryKind)
    : null;
}

adminUsersRouter.get("/", (req, res) => {
  try {
    return res.json(ok(listAdminUsers(req.query.keyword, req.query.offset, req.query.limit)));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取用户列表失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUsersRouter.get("/:id", (req, res) => {
  try {
    const id = normalizeUserId(req.params.id);
    if (!id.ok) return res.status(400).json(fail(id.msg, 400));
    const detail = readAdminUserDetail(id.value);
    if (!detail) return res.status(404).json(fail("用户不存在", 404));
    return res.json(ok(detail));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取用户详情失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUsersRouter.get("/:id/library", (req, res) => {
  try {
    const id = normalizeUserId(req.params.id);
    if (!id.ok) return res.status(400).json(fail(id.msg, 400));
    const kind = normalizeLibraryKind(req.query.kind);
    if (!kind) return res.status(400).json(fail("数据类型不正确", 400));
    const page = listAdminUserLibraryItems(id.value, kind, req.query.offset, req.query.limit ?? 30);
    if (!page) return res.status(404).json(fail("用户不存在", 404));
    return res.json(ok(page));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取用户同步数据失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUsersRouter.put("/:id", (req, res) => {
  try {
    const id = normalizeUserId(req.params.id);
    if (!id.ok) return res.status(400).json(fail(id.msg, 400));
    const payload = normalizeUpdatePayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    const updated = updateAdminUser(id.value, payload.value);
    if (!updated) return res.status(404).json(fail("用户不存在", 404));
    return res.json(ok(updated, "用户资料已保存"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存用户资料失败";
    const status = message === "该邮箱已被注册" || message === "该用户名已被使用" ? 400 : 500;
    return res.status(status).json(fail(message, status));
  }
});

adminUsersRouter.delete("/:id", (req, res) => {
  try {
    const id = normalizeUserId(req.params.id);
    if (!id.ok) return res.status(400).json(fail(id.msg, 400));
    const deleted = deleteAdminUser(id.value);
    if (!deleted) return res.status(404).json(fail("用户不存在", 404));
    return res.json(ok(null, "用户已删除"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除用户失败";
    return res.status(500).json(fail(message, 500));
  }
});
