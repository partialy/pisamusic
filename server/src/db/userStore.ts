import { randomUUID } from "node:crypto";
import { type DbClient as DatabaseSync } from "./core/types";
import { getAppDb } from "./appDb";
import { buildUrl, isAccountAvatarObjectKey } from "../services/qiniuReleaseFiles";

export type UserRecord = {
  id: string;
  email: string;
  phone: string | null;
  username: string;
  passwordHash: string;
  avatar: string;
  avatarKey: string;
  vipEnabled: boolean;
  vipExpiresAt: number | null;
  syncVersion: number;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
};

export type PublicUser = {
  id: string;
  /** 未绑定邮箱时为空字符串，保持旧客户端字段类型兼容。 */
  email: string;
  phone?: string | null;
  username: string;
  avatar: string;
  avatarKey: string;
  avatarUrl: string;
  vip: boolean;
  vipExpiresAt: number | null;
  createdAt: number;
  lastLoginAt: number | null;
};

export type CreateUserInput = {
  email: string;
  phone?: string | null;
  username: string;
  passwordHash: string;
  avatar?: string;
  avatarKey?: string;
};

type UserRow = {
  id: string;
  email: string;
  phone: string | null;
  username: string;
  password_hash: string;
  avatar: string;
  avatar_key: string;
  vip_enabled: number;
  vip_expires_at: number | null;
  sync_version: number;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
};

export const ACCOUNT_AVATAR_KEYS = ["default"] as const;

export type AccountAvatarKey = typeof ACCOUNT_AVATAR_KEYS[number];

export type UpdateUserProfileInput = {
  username?: string;
  email?: string;
  phone?: string | null;
  avatarKey?: string;
};

export function isAccountAvatarKey(value: string): value is AccountAvatarKey {
  return (ACCOUNT_AVATAR_KEYS as readonly string[]).includes(value);
}

function avatarUrlForKey(key: string): string {
  if (key === "default") return "/static/account-avatars/default.jpg";
  return "";
}

export function isValidAccountAvatarKey(userId: string, key: string): boolean {
  return key === "default" || isAccountAvatarObjectKey(userId, key);
}

export function normalizeAccountAvatarKey(userId: string, key: string): string {
  return isValidAccountAvatarKey(userId, key) ? key : "default";
}

export function accountAvatarUrl(userId: string, key: string, updatedAt = 0): string {
  if (key === "default") return avatarUrlForKey(key);
  if (!isAccountAvatarObjectKey(userId, key)) return avatarUrlForKey("default");
  const suffix = updatedAt > 0 ? `?v=${encodeURIComponent(String(updatedAt))}` : "";
  return `${buildUrl(key, "public-image")}${suffix}`;
}

async function runInTransaction<T>(db: DatabaseSync, fn: () => Promise<T>): Promise<T> {
  return (await db.transaction(async () => {
    const result = (await fn());

    return result;
  }));
}

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const db = getAppDb();
  return (await runInTransaction(db, async () => {
    const now = Date.now();
    const id = randomUUID().replace(/-/g, "");
    (await db.execute(`INSERT INTO users (
        id, email, phone, username, password_hash, avatar, avatar_key, sync_version, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`, [id, input.email, input.phone ?? null, input.username, input.passwordHash, input.avatar ?? avatarUrlForKey("default"), "default", now, now, now]));
    const created = (await readUserById(id));
    if (!created) throw new Error("用户创建失败");
    return created;
  }));
}

export async function readUserById(id: string): Promise<UserRecord | null> {
  const row = (await getAppDb().queryOne("SELECT * FROM users WHERE id = ?", [id])) as UserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export async function readUserByEmail(email: string): Promise<UserRecord | null> {
  const row = (await getAppDb().queryOne("SELECT * FROM users WHERE email = ?", [email])) as UserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export async function readUserByPhone(phone: string): Promise<UserRecord | null> {
  const row = (await getAppDb().queryOne("SELECT * FROM users WHERE phone = ?", [phone])) as UserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export async function readUserByUsername(username: string): Promise<UserRecord | null> {
  const row = (await getAppDb().queryOne("SELECT * FROM users WHERE username = ?", [username])) as UserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export async function readUserByIdentifier(identifier: string): Promise<UserRecord | null> {
  if (identifier.includes("@")) return (await readUserByEmail(identifier));
  if (/^1\d{10}$/.test(identifier)) return (await readUserByPhone(identifier));
  return (await readUserByUsername(identifier));
}

export async function touchUserLogin(id: string): Promise<void> {
  (await getAppDb().execute("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", [Date.now(), Date.now(), id]));
}

export async function userExistsForRegister(email: string | null, phone: string | null, username: string): Promise<{ emailExists: boolean; phoneExists: boolean; usernameExists: boolean }> {
  const db = getAppDb();
  const emailRow = email ? (await db.queryOne("SELECT id FROM users WHERE email = ?", [email])) as { id: string } | undefined : undefined;
  const phoneRow = phone ? (await db.queryOne("SELECT id FROM users WHERE phone = ?", [phone])) as { id: string } | undefined : undefined;
  const usernameRow = (await db.queryOne("SELECT id FROM users WHERE username = ?", [username])) as { id: string } | undefined;
  return { emailExists: Boolean(emailRow), phoneExists: Boolean(phoneRow), usernameExists: Boolean(usernameRow) };
}

export async function updateUserProfile(id: string, input: UpdateUserProfileInput): Promise<UserRecord> {
  const db = getAppDb();
  return (await runInTransaction(db, async () => {
    const current = (await readUserById(id));
    if (!current) throw new Error("用户不存在");
    const nextEmail = input.email ?? current.email;
    const nextPhone = input.phone === undefined ? current.phone : input.phone;
    const nextUsername = input.username ?? current.username;
    const nextAvatarKey = normalizeAccountAvatarKey(id, input.avatarKey ?? current.avatarKey);
    const now = Date.now();
    const nextAvatarUrl = accountAvatarUrl(id, nextAvatarKey, now);
    (await db.execute(`UPDATE users
       SET email = ?, phone = ?, username = ?, avatar_key = ?, avatar = ?, updated_at = ?
       WHERE id = ?`, [nextEmail, nextPhone, nextUsername, nextAvatarKey, nextAvatarUrl, now, id]));
    const updated = (await readUserById(id));
    if (!updated) throw new Error("用户资料更新失败");
    return updated;
  }));
}

export async function updateUserPassword(id: string, passwordHash: string): Promise<UserRecord> {
  const db = getAppDb();
  return (await runInTransaction(db, async () => {
    const current = (await readUserById(id));
    if (!current) throw new Error("用户不存在");
    (await db.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [passwordHash, Date.now(), id]));
    const updated = (await readUserById(id));
    if (!updated) throw new Error("密码更新失败");
    return updated;
  }));
}

export async function updateUserVip(id: string, vipEnabled: boolean, vipExpiresAt: number | null): Promise<UserRecord> {
  const db = getAppDb();
  return (await runInTransaction(db, async () => {
    const current = (await readUserById(id));
    if (!current) throw new Error("用户不存在");
    const expiresAt = vipEnabled ? vipExpiresAt : null;
    if (vipEnabled && (expiresAt == null || !Number.isFinite(expiresAt) || !Number.isInteger(expiresAt) || expiresAt <= Date.now())) {
      throw new Error("启用 VIP 时必须设置晚于当前时间的到期时间");
    }
    (await db.execute("UPDATE users SET vip_enabled = ?, vip_expires_at = ?, updated_at = ? WHERE id = ?", [vipEnabled ? 1 : 0, expiresAt, Date.now(), id]));
    const updated = (await readUserById(id));
    if (!updated) throw new Error("用户 VIP 权益更新失败");
    return updated;
  }));
}

export function toPublicUser(user: UserRecord): PublicUser {
  const avatarKey = normalizeAccountAvatarKey(user.id, user.avatarKey);
  const avatarUrl = accountAvatarUrl(user.id, avatarKey, user.updatedAt);
  return {
    id: user.id,
    email: user.email.endsWith("@phone.invalid") ? "" : user.email,
    phone: user.phone,
    username: user.username,
    avatar: avatarUrl,
    avatarKey,
    avatarUrl,
    vip: user.vipEnabled && user.vipExpiresAt != null && user.vipExpiresAt > Date.now(),
    vipExpiresAt: user.vipExpiresAt,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    username: row.username,
    passwordHash: row.password_hash,
    avatar: row.avatar,
    avatarKey: row.avatar_key || "default",
    vipEnabled: row.vip_enabled === 1,
    vipExpiresAt: row.vip_expires_at,
    syncVersion: row.sync_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}
