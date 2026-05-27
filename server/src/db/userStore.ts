import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { getAppDb } from "./appDb";

export type UserRecord = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  avatar: string;
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
};

export type CreateUserInput = {
  email: string;
  username: string;
  passwordHash: string;
  avatar?: string;
};

type UserRow = {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  avatar: string;
  sync_version: number;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
};

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
        id, email, username, password_hash, avatar, sync_version, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    ).run(id, input.email, input.username, input.passwordHash, input.avatar ?? "", now, now, now);
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

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
  };
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.password_hash,
    avatar: row.avatar,
    syncVersion: row.sync_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}
