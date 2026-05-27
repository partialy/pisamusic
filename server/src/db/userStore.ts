import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { getAppDb } from "./appDb";

export type UserRecord = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  avatar: string;
  avatarKey: string;
  syncVersion: number;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
};

export type PublicUser = {
  id: string;
  email: string;
  username: string;
  avatar: string;
  avatarKey: string;
  avatarUrl: string;
  createdAt: number;
};

export type CreateUserInput = {
  email: string;
  username: string;
  passwordHash: string;
  avatar?: string;
  avatarKey?: string;
};

type UserRow = {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  avatar: string;
  avatar_key: string;
  sync_version: number;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
};

export const ACCOUNT_AVATAR_KEYS = [
  "default",
  "anime_sky",
  "anime_mint",
  "anime_peach",
  "anime_lilac",
  "anime_sun",
] as const;

export type AccountAvatarKey = typeof ACCOUNT_AVATAR_KEYS[number];

export type UpdateUserProfileInput = {
  username?: string;
  email?: string;
  avatarKey?: string;
};

export function isAccountAvatarKey(value: string): value is AccountAvatarKey {
  return (ACCOUNT_AVATAR_KEYS as readonly string[]).includes(value);
}

function avatarUrlForKey(key: string): string {
  if (key === "default") return "/static/account-avatars/default.jpg";
  if (isAccountAvatarKey(key)) return `/static/account-avatars/${key}.png`;
  return "";
}

function runInTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createUser(input: CreateUserInput): UserRecord {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const now = Date.now();
    const id = randomUUID().replace(/-/g, "");
    db.prepare(
      `INSERT INTO users (
        id, email, username, password_hash, avatar, avatar_key, sync_version, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    ).run(
      id,
      input.email,
      input.username,
      input.passwordHash,
      input.avatar ?? "",
      input.avatarKey && isAccountAvatarKey(input.avatarKey) ? input.avatarKey : "default",
      now,
      now,
      now,
    );
    const created = readUserById(id);
    if (!created) throw new Error("用户创建失败");
    return created;
  });
}

export function readUserById(id: string): UserRecord | null {
  const row = getAppDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export function readUserByEmail(email: string): UserRecord | null {
  const row = getAppDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export function readUserByUsername(username: string): UserRecord | null {
  const row = getAppDb().prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export function readUserByIdentifier(identifier: string): UserRecord | null {
  return identifier.includes("@") ? readUserByEmail(identifier) : readUserByUsername(identifier);
}

export function touchUserLogin(id: string): void {
  getAppDb().prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(Date.now(), Date.now(), id);
}

export function userExistsForRegister(email: string, username: string): { emailExists: boolean; usernameExists: boolean } {
  const db = getAppDb();
  const emailRow = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string } | undefined;
  const usernameRow = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: string } | undefined;
  return { emailExists: Boolean(emailRow), usernameExists: Boolean(usernameRow) };
}

export function updateUserProfile(id: string, input: UpdateUserProfileInput): UserRecord {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const current = readUserById(id);
    if (!current) throw new Error("用户不存在");
    const nextEmail = input.email ?? current.email;
    const nextUsername = input.username ?? current.username;
    const nextAvatarKey = input.avatarKey ?? current.avatarKey;
    const now = Date.now();
    db.prepare(
      `UPDATE users
       SET email = ?, username = ?, avatar_key = ?, avatar = ?, updated_at = ?
       WHERE id = ?`,
    ).run(nextEmail, nextUsername, nextAvatarKey, avatarUrlForKey(nextAvatarKey), now, id);
    const updated = readUserById(id);
    if (!updated) throw new Error("用户资料更新失败");
    return updated;
  });
}

export function toPublicUser(user: UserRecord): PublicUser {
  const avatarKey = isAccountAvatarKey(user.avatarKey) ? user.avatarKey : "default";
  const avatarUrl = avatarUrlForKey(avatarKey) || user.avatar;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar: avatarUrl,
    avatarKey,
    avatarUrl,
    createdAt: user.createdAt,
  };
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.password_hash,
    avatar: row.avatar,
    avatarKey: row.avatar_key || "default",
    syncVersion: row.sync_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}
