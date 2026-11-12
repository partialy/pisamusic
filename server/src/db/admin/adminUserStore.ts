import { getAppDb } from "../appDb";

export type AdminUser = {
  username: string;
  passwordHash: string;
};

export async function readAdminUser(username: string): Promise<AdminUser | null> {
  const db = getAppDb();
  const row = (await db.queryOne("SELECT username, password_hash FROM admin_users WHERE username = ?", [username])) as
    | { username: string; password_hash: string }
    | undefined;
  return row ? { username: row.username, passwordHash: row.password_hash } : null;
}

export async function readAnyAdminUser(): Promise<AdminUser | null> {
  const db = getAppDb();
  const row = (await db.queryOne(
    db.dialect === "mysql"
      ? "SELECT username, password_hash FROM admin_users ORDER BY username ASC LIMIT 1"
      : "SELECT username, password_hash FROM admin_users ORDER BY rowid ASC LIMIT 1",
    [],
  )) as { username: string; password_hash: string } | undefined;
  return row ? { username: row.username, passwordHash: row.password_hash } : null;
}

export async function upsertAdminUser(user: AdminUser): Promise<void> {
  const db = getAppDb();
  await db.execute(
    db.dialect === "mysql"
      ? `INSERT INTO admin_users (username, password_hash, updated_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           updated_at = VALUES(updated_at)`
      : `INSERT INTO admin_users (username, password_hash, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(username) DO UPDATE SET
           password_hash = excluded.password_hash,
           updated_at = excluded.updated_at`,
    [user.username, user.passwordHash, Date.now()],
  );
}
