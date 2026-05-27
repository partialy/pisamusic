import { Router } from "express";
import type { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  ACCOUNT_AVATAR_KEYS,
  createUser,
  isAccountAvatarKey,
  readUserByEmail,
  readUserById,
  readUserByIdentifier,
  readUserByUsername,
  toPublicUser,
  touchUserLogin,
  updateUserProfile,
  userExistsForRegister,
  type PublicUser,
  type UserRecord,
} from "../db/userStore";
import { getUserAuth, getUserJwtSecret, requireUserJwt, type UserAuthedRequest } from "../middleware/requireUserJwt";
import { sendEmailCode, verifyEmailCode, type EmailCodePurpose } from "../services/emailCodeService";
import { fail, ok } from "../types/response";

export const authRouter = Router();

const JWT_EXPIRES_SECONDS = 7 * 24 * 60 * 60;
const JWT_EXPIRES_IN = "7d";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

function normalizeText(value: unknown, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length <= max ? text : text.slice(0, max);
}

function normalizePurpose(value: unknown): EmailCodePurpose | null {
  return value === "register" || value === "login" ? value : null;
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

authRouter.post("/email-code", async (req, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const email = normalizeEmail(req.body.email);
    const purpose = normalizePurpose(req.body.purpose);
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json(fail(emailError, 400));
    if (!purpose) return res.status(400).json(fail("验证码用途不正确", 400));

    if (purpose === "register" && readUserByEmail(email)) {
      return res.status(400).json(fail("该邮箱已注册", 400));
    }
    if (purpose === "login" && !readUserByEmail(email)) {
      return res.status(404).json(fail("该邮箱尚未注册", 404));
    }

    return res.json(ok(await sendEmailCode(email, purpose), "验证码已发送"));
  } catch (error) {
    handleError(res, error, "验证码发送失败");
  }
});

authRouter.post("/register", (req, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const email = normalizeEmail(req.body.email);
    const username = normalizeText(req.body.username, 32);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const code = normalizeText(req.body.code, 16);

    const emailError = validateEmail(email);
    const usernameError = validateUsername(username);
    const passwordError = validatePassword(password);
    if (emailError) return res.status(400).json(fail(emailError, 400));
    if (usernameError) return res.status(400).json(fail(usernameError, 400));
    if (passwordError) return res.status(400).json(fail(passwordError, 400));
    if (!code) return res.status(400).json(fail("验证码不能为空", 400));

    const exists = userExistsForRegister(email, username);
    if (exists.emailExists) return res.status(400).json(fail("该邮箱已注册", 400));
    if (exists.usernameExists) return res.status(400).json(fail("该用户名已被使用", 400));
    if (!verifyEmailCode(email, "register", code)) return res.status(400).json(fail("验证码错误或已过期", 400));

    const user = createUser({
      email,
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
    const identifier = normalizeText(req.body.identifier, 254);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!identifier || !password) return res.status(400).json(fail("请输入用户名/邮箱和密码", 400));
    const user = readUserByIdentifier(identifier.includes("@") ? identifier.toLowerCase() : identifier);
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
    const email = normalizeEmail(req.body.email);
    const code = normalizeText(req.body.code, 16);
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json(fail(emailError, 400));
    if (!code) return res.status(400).json(fail("验证码不能为空", 400));
    const user = readUserByEmail(email);
    if (!user) return res.status(404).json(fail("该邮箱尚未注册", 404));
    if (!verifyEmailCode(email, "login", code)) return res.status(400).json(fail("验证码错误或已过期", 400));
    return res.json(ok(loginResult(user), "登录成功"));
  } catch (error) {
    handleError(res, error, "登录失败");
  }
});

authRouter.post("/refresh", requireUserJwt, (req: UserAuthedRequest, res) => {
  const auth = getUserAuth(req);
  return res.json(ok(issueToken(auth.user), "登录已刷新"));
});

authRouter.get("/me", requireUserJwt, (req: UserAuthedRequest, res) => {
  return res.json(ok(getUserAuth(req).user));
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
    return res.json(ok(await sendEmailCode(email, "profile_email"), "验证码已发送"));
  } catch (error) {
    handleError(res, error, "验证码发送失败");
  }
});

authRouter.patch("/profile", requireUserJwt, (req: UserAuthedRequest, res) => {
  try {
    if (!isRecord(req.body)) return res.status(400).json(fail("请求体必须是对象", 400));
    const auth = getUserAuth(req);
    const current = readUserById(auth.userId);
    if (!current) return res.status(404).json(fail("用户不存在", 404));

    const patch: { username?: string; email?: string; avatarKey?: string } = {};
    if ("username" in req.body) {
      const username = normalizeText(req.body.username, 32);
      const usernameError = validateUsername(username);
      if (usernameError) return res.status(400).json(fail(usernameError, 400));
      const existing = readUserByUsername(username);
      if (existing && existing.id !== current.id) return res.status(400).json(fail("该用户名已被使用", 400));
      patch.username = username;
    }

    if ("avatarKey" in req.body) {
      const avatarKey = normalizeText(req.body.avatarKey, 64);
      if (!isAccountAvatarKey(avatarKey)) {
        return res.status(400).json(fail(`头像不存在，可选值：${ACCOUNT_AVATAR_KEYS.join(", ")}`, 400));
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

    if (!("username" in patch) && !("email" in patch) && !("avatarKey" in patch)) {
      return res.json(ok(issueToken(current), "资料未变化"));
    }

    const updated = updateUserProfile(current.id, patch);
    return res.json(ok(issueToken(updated), "资料已更新"));
  } catch (error) {
    handleError(res, error, "资料更新失败");
  }
});
