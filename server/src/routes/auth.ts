import { Router } from "express";
import type { Response } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import {
  createUser,
  isValidAccountAvatarKey,
  readUserByEmail,
  readUserByPhone,
  readUserById,
  readUserByIdentifier,
  readUserByUsername,
  toPublicUser,
  touchUserLogin,
  updateUserPassword,
  updateUserProfile,
  userExistsForRegister,
  type PublicUser,
  type UserRecord,
} from "../db/userStore";
import { getUserAuth, getUserJwtSecret, requireUserJwt, type UserAuthedRequest } from "../middleware/requireUserJwt";
import { sendContactCode, sendEmailCode, verifyContactCode, verifyEmailCode, type ContactChannel, type ContactCodePurpose, type EmailCodePurpose } from "../services/emailCodeService";
import { createAccountAvatarUploadToken, deleteAccountAvatarObject, isAccountAvatarObjectKey } from "../services/qiniuReleaseFiles";
import { fail, ok } from "../types/response";

export const authRouter = Router();

const JWT_EXPIRES_SECONDS = 7 * 24 * 60 * 60;
const JWT_EXPIRES_IN = "7d";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^1\d{10}$/;
const USERNAME_RE = /^[A-Za-z0-9_\-\u4e00-\u9fa5]{2,32}$/;

type AuthTokenResponse = {
  token: string;
  expiresAt: number;
  user: PublicUser;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePhone(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/[\s-]/g, "") : "";
}

function normalizeText(value: unknown, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length <= max ? text : text.slice(0, max);
}

function normalizePurpose(value: unknown): ContactCodePurpose | null {
  return value === "register" || value === "login" || value === "profile_email" || value === "profile_phone" || value === "reset_password" ? value : null;
}

function validateEmail(email: string): string | null {
  if (!email) return "邮箱不能为空";
  if (email.length > 254 || !EMAIL_RE.test(email)) return "邮箱格式不正确";
  return null;
}

function validatePhone(phone: string): string | null {
  if (!phone) return "手机号不能为空";
  if (!PHONE_RE.test(phone)) return "手机号格式不正确";
  return null;
}

type Contact = { channel: ContactChannel; value: string; email: string | null; phone: string | null };

function readContact(body: Record<string, unknown>): Contact | { error: string } {
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  if (email && phone) return { error: "邮箱和手机号只能填写一个" };
  if (email) {
    const error = validateEmail(email);
    return error ? { error } : { channel: "email", value: email, email, phone: null };
  }
  if (phone) {
    const error = validatePhone(phone);
    return error ? { error } : { channel: "phone", value: phone, email: null, phone };
  }
  return { error: "请输入邮箱或手机号" };
}

function storageEmail(contact: Contact): string {
  return contact.email ?? `${contact.phone}@phone.invalid`;
}

function autoUsername(contact: Contact): string {
  const raw = contact.email ? contact.email.split("@")[0] : `用户${contact.phone?.slice(-4) ?? ""}`;
  const cleaned = raw.replace(/[^A-Za-z0-9_\-\u4e00-\u9fa5]/g, "").slice(0, 24) || "用户";
  const base = cleaned.length >= 2 ? cleaned : `${cleaned}用户`;
  let candidate = base;
  for (let index = 0; readUserByUsername(candidate); index += 1) {
    const suffix = index === 0 ? randomUUID().replace(/-/g, "").slice(0, 6) : String(index);
    candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`;
  }
  return candidate;
}

function validateUsername(username: string): string | null {
  if (!username) return "用户名不能为空";
  if (!USERNAME_RE.test(username)) return "用户名需为 2-32 位中文、字母、数字、下划线或短横线";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return "密码不能为空";
  if (password.length < 6) return "密码至少 6 位";
  if (password.length > 128) return "密码过长";
  return null;
}

function issueToken(user: UserRecord | PublicUser): AuthTokenResponse {
  const publicUser = "passwordHash" in user ? toPublicUser(user) : user;
  const token = jwt.sign({ sub: publicUser.id }, getUserJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
  return {
    token,
    expiresAt: Date.now() + JWT_EXPIRES_SECONDS * 1000,
    user: publicUser,
  };
}

function loginResult(user: UserRecord): AuthTokenResponse {
  touchUserLogin(user.id);
  const updated = readUserByIdentifier(user.email) ?? user;
  return issueToken(updated);
}

function handleError(res: Response, error: unknown, fallback: string): void {
  const message = error instanceof Error ? error.message : fallback;
  res.status(400).json(fail(message, 400));
}

import type { Request } from "express";
import type { SendContactCodeMeta } from "../services/emailCodeService";

function extractSendMeta(req: Request, fallbackUserId?: string | null): SendContactCodeMeta {
  const deviceId = (req.header("x-pm-device-id") || "").trim();
  const clientIp = (req.ip || req.header("x-forwarded-for") || req.socket.remoteAddress || "").split(",")[0].trim();
  const userAgent = (req.header("user-agent") || "").trim();
  return {
    deviceId,
    clientIp,
    userAgent,
    userId: fallbackUserId ?? null,
  };
}

authRouter.post("/email-code", async (req, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const email = normalizeEmail(req.body.email);
    const purpose = normalizePurpose(req.body.purpose);
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json(fail(emailError, 400));
    if (!purpose || purpose === "profile_email" || purpose === "profile_phone") return res.status(400).json(fail("验证码用途不正确", 400));

    const matchedUser = readUserByEmail(email);
    if (purpose === "register" && matchedUser) {
      return res.status(400).json(fail("该邮箱已注册", 400));
    }
    if (purpose === "reset_password" && !matchedUser) {
      return res.status(404).json(fail("该邮箱尚未注册", 404));
    }

    const meta = extractSendMeta(req, matchedUser?.id);
    return res.json(ok(await sendEmailCode(email, purpose as EmailCodePurpose, meta), "验证码已发送"));
  } catch (error) {
    handleError(res, error, "验证码发送失败");
  }
});

authRouter.post("/phone-code", async (req, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const phone = normalizePhone(req.body.phone);
    const purpose = normalizePurpose(req.body.purpose);
    const phoneError = validatePhone(phone);
    if (phoneError) return res.status(400).json(fail(phoneError, 400));
    if (!purpose || purpose === "profile_email" || purpose === "profile_phone") return res.status(400).json(fail("验证码用途不正确", 400));
    const matchedUser = readUserByPhone(phone);
    if (purpose === "register" && matchedUser) return res.status(400).json(fail("该手机号已注册", 400));
    if (purpose === "reset_password" && !matchedUser) {
      return res.status(404).json(fail("该手机号尚未注册", 404));
    }
    const meta = extractSendMeta(req, matchedUser?.id);
    return res.json(ok(await sendContactCode("phone", phone, purpose, meta), "验证码已发送"));
  } catch (error) {
    handleError(res, error, "验证码发送失败");
  }
});

authRouter.post("/register", (req, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const contact = readContact(req.body);
    if ("error" in contact) return res.status(400).json(fail(contact.error, 400));
    const username = normalizeText(req.body.username, 32);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const code = normalizeText(req.body.code, 16);

    const usernameError = validateUsername(username);
    const passwordError = validatePassword(password);
    if (usernameError) return res.status(400).json(fail(usernameError, 400));
    if (passwordError) return res.status(400).json(fail(passwordError, 400));
    if (!code) return res.status(400).json(fail("验证码不能为空", 400));

    const exists = userExistsForRegister(contact.email ?? null, contact.phone ?? null, username);
    if (exists.emailExists) return res.status(400).json(fail("该邮箱已注册", 400));
    if (exists.phoneExists) return res.status(400).json(fail("该手机号已注册", 400));
    if (exists.usernameExists) return res.status(400).json(fail("该用户名已被使用", 400));
    if (!verifyContactCode(contact.channel, contact.value, "register", code)) return res.status(400).json(fail("验证码错误或已过期", 400));

    const user = createUser({
      email: storageEmail(contact),
      phone: contact.phone,
      username,
      passwordHash: bcrypt.hashSync(password, 10),
    });
    return res.json(ok(issueToken(user), "注册成功"));
  } catch (error) {
    handleError(res, error, "注册失败");
  }
});

authRouter.post("/login/password", (req, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const rawIdentifier = normalizeText(req.body.identifier, 254);
    const normalizedPhone = normalizePhone(rawIdentifier);
    const identifier = rawIdentifier.includes("@")
      ? rawIdentifier.toLowerCase()
      : PHONE_RE.test(normalizedPhone) ? normalizedPhone : rawIdentifier;
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!identifier || !password) return res.status(400).json(fail("请输入用户名/邮箱和密码", 400));
    const user = readUserByIdentifier(identifier);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json(fail("账号或密码错误", 401));
    }
    return res.json(ok(loginResult(user), "登录成功"));
  } catch (error) {
    handleError(res, error, "登录失败");
  }
});

authRouter.post("/login/code", (req, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const contact = readContact(req.body);
    const code = normalizeText(req.body.code, 16);
    if ("error" in contact) return res.status(400).json(fail(contact.error, 400));
    if (!code) return res.status(400).json(fail("验证码不能为空", 400));
    const user = contact.channel === "email" ? readUserByEmail(contact.value) : readUserByPhone(contact.value);
    if (!verifyContactCode(contact.channel, contact.value, "login", code)) return res.status(400).json(fail("验证码错误或已过期", 400));
    if (user) return res.json(ok(loginResult(user), "登录成功"));
    const created = createUser({
      email: storageEmail(contact),
      phone: contact.phone,
      username: autoUsername(contact),
      passwordHash: bcrypt.hashSync(randomUUID(), 10),
    });
    return res.json(ok(loginResult(created), "注册并登录成功"));
  } catch (error) {
    handleError(res, error, "登录失败");
  }
});

authRouter.post("/password/change", requireUserJwt, (req: UserAuthedRequest, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const auth = getUserAuth(req);
    const current = readUserById(auth.userId);
    if (!current) return res.status(404).json(fail("用户不存在", 404));
    const currentPassword = typeof req.body.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body.newPassword === "string" ? req.body.newPassword : "";
    if (!currentPassword) return res.status(400).json(fail("当前密码不能为空", 400));
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json(fail(passwordError, 400));
    if (currentPassword === newPassword) return res.status(400).json(fail("新密码不能与当前密码相同", 400));
    if (!bcrypt.compareSync(currentPassword, current.passwordHash)) {
      return res.status(400).json(fail("当前密码错误", 400));
    }
    updateUserPassword(current.id, bcrypt.hashSync(newPassword, 10));
    return res.json(ok({ updated: true }, "密码已修改"));
  } catch (error) {
    handleError(res, error, "密码修改失败");
  }
});

authRouter.post("/password/reset", (req, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const contact = readContact(req.body);
    const code = normalizeText(req.body.code, 16);
    const newPassword = typeof req.body.newPassword === "string" ? req.body.newPassword : "";
    const passwordError = validatePassword(newPassword);
    if ("error" in contact) return res.status(400).json(fail(contact.error, 400));
    if (passwordError) return res.status(400).json(fail(passwordError, 400));
    if (!code) return res.status(400).json(fail("验证码不能为空", 400));
    const user = contact.channel === "email" ? readUserByEmail(contact.value) : readUserByPhone(contact.value);
    if (!user) return res.status(404).json(fail("该账号尚未注册", 404));
    if (!verifyContactCode(contact.channel, contact.value, "reset_password", code)) {
      return res.status(400).json(fail("验证码错误或已过期", 400));
    }
    updateUserPassword(user.id, bcrypt.hashSync(newPassword, 10));
    return res.json(ok({ updated: true }, "密码已重置"));
  } catch (error) {
    handleError(res, error, "密码重置失败");
  }
});

authRouter.post("/refresh", requireUserJwt, (req: UserAuthedRequest, res) => {
  const auth = getUserAuth(req);
  return res.json(ok(issueToken(auth.user), "登录已刷新"));
});

authRouter.get("/me", requireUserJwt, (req: UserAuthedRequest, res) => {
  return res.json(ok(getUserAuth(req).user));
});

authRouter.post("/avatar/upload-token", requireUserJwt, (req: UserAuthedRequest, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const auth = getUserAuth(req);
    const fileName = normalizeText(req.body.fileName, 255);
    const fileSize = Number(req.body.fileSize);
    const mimeType = normalizeText(req.body.mimeType, 64);
    return res.json(ok(createAccountAvatarUploadToken({
      userId: auth.userId,
      fileName,
      fileSize,
      mimeType,
    })));
  } catch (error) {
    handleError(res, error, "头像上传凭证获取失败");
  }
});

authRouter.post("/profile/email-code", requireUserJwt, async (req: UserAuthedRequest, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const auth = getUserAuth(req);
    const email = normalizeEmail(req.body.email);
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json(fail(emailError, 400));
    if (email === auth.user.email) return res.status(400).json(fail("新邮箱不能与当前邮箱相同", 400));
    if (readUserByEmail(email)) return res.status(400).json(fail("该邮箱已被注册", 400));
    const meta = extractSendMeta(req, auth.userId);
    return res.json(ok(await sendEmailCode(email, "profile_email", meta), "验证码已发送"));
  } catch (error) {
    handleError(res, error, "验证码发送失败");
  }
});

authRouter.post("/profile/phone-code", requireUserJwt, async (req: UserAuthedRequest, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const auth = getUserAuth(req);
    const phone = normalizePhone(req.body.phone);
    const phoneError = validatePhone(phone);
    if (phoneError) return res.status(400).json(fail(phoneError, 400));
    if (phone === auth.user.phone) return res.status(400).json(fail("新手机号不能与当前手机号相同", 400));
    if (readUserByPhone(phone)) return res.status(400).json(fail("该手机号已被注册", 400));
    const meta = extractSendMeta(req, auth.userId);
    return res.json(ok(await sendContactCode("phone", phone, "profile_phone", meta), "验证码已发送"));
  } catch (error) {
    handleError(res, error, "验证码发送失败");
  }
});

authRouter.patch("/profile", requireUserJwt, async (req: UserAuthedRequest, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const auth = getUserAuth(req);
    const current = readUserById(auth.userId);
    if (!current) return res.status(404).json(fail("用户不存在", 404));

    const patch: { username?: string; email?: string; phone?: string; avatarKey?: string } = {};
    if ("username" in req.body) {
      const username = normalizeText(req.body.username, 32);
      const usernameError = validateUsername(username);
      if (usernameError) return res.status(400).json(fail(usernameError, 400));
      const existing = readUserByUsername(username);
      if (existing && existing.id !== current.id) return res.status(400).json(fail("该用户名已被使用", 400));
      patch.username = username;
    }

    if ("avatarKey" in req.body) {
      const avatarKey = normalizeText(req.body.avatarKey, 512).replace(/\\/g, "/");
      if (!isValidAccountAvatarKey(current.id, avatarKey)) {
        return res.status(400).json(fail("头像不存在或不属于当前账号", 400));
      }
      patch.avatarKey = avatarKey;
    }

    if ("email" in req.body) {
      const email = normalizeEmail(req.body.email);
      const code = normalizeText(req.body.code, 16);
      const emailError = validateEmail(email);
      if (emailError) return res.status(400).json(fail(emailError, 400));
      if (email !== current.email) {
        if (!code) return res.status(400).json(fail("修改邮箱需要验证码", 400));
        const existing = readUserByEmail(email);
        if (existing && existing.id !== current.id) return res.status(400).json(fail("该邮箱已被注册", 400));
        if (!verifyEmailCode(email, "profile_email", code)) {
          return res.status(400).json(fail("验证码错误或已过期", 400));
        }
        patch.email = email;
      }
    }

    if ("phone" in req.body) {
      const phone = normalizePhone(req.body.phone);
      const code = normalizeText(req.body.code, 16);
      const phoneError = validatePhone(phone);
      if (phoneError) return res.status(400).json(fail(phoneError, 400));
      if (phone !== current.phone) {
        if (!code) return res.status(400).json(fail("修改手机号需要验证码", 400));
        const existing = readUserByPhone(phone);
        if (existing && existing.id !== current.id) return res.status(400).json(fail("该手机号已被注册", 400));
        if (!verifyContactCode("phone", phone, "profile_phone", code)) {
          return res.status(400).json(fail("验证码错误或已过期", 400));
        }
        patch.phone = phone;
      }
    }

    if (!("username" in patch) && !("email" in patch) && !("phone" in patch) && !("avatarKey" in patch)) {
      return res.json(ok(issueToken(current), "资料未变化"));
    }

    if ("avatarKey" in patch && patch.avatarKey !== current.avatarKey && isAccountAvatarObjectKey(current.id, current.avatarKey)) {
      await deleteAccountAvatarObject(current.avatarKey);
    }
    const updated = updateUserProfile(current.id, patch);
    return res.json(ok(issueToken(updated), "资料已更新"));
  } catch (error) {
    handleError(res, error, "资料更新失败");
  }
});
