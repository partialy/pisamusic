import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getAppDb } from "./appDb";

export type DirectMessageTargetKind = "user" | "android_device" | "desktop_device";

export type DirectMessageTarget =
  | { kind: "user"; id: string }
  | { kind: "android_device"; id: string }
  | { kind: "desktop_device"; id: string };

export type DirectMessageIdentity = {
  userId: string | null;
  device: { kind: "android" | "desktop"; id: string } | null;
};

export type StoredDirectMessage = {
  id: string;
  target: DirectMessageTarget;
  content: string;
  createdByAdmin: string;
  createdAt: number;
  readAt: number | null;
  readPlatform: "android" | "desktop" | null;
  readDeviceId: string | null;
};

export type InsertDirectMessageInput = {
  id?: string;
  target: DirectMessageTarget;
  content: string;
  createdByAdmin: string;
  createdAt?: number;
};

export type DirectMessagePage = {
  items: StoredDirectMessage[];
  hasMore: boolean;
};

export type AdminDirectMessagePage = {
  items: StoredDirectMessage[];
  total: number;
};

export type ListAdminDirectMessagesInput = {
  target?: DirectMessageTarget;
  userId?: string;
  androidDeviceId?: string;
  desktopDeviceId?: string;
  offset?: number;
  limit?: number;
};

type DirectMessageRow = {
  id: string;
  user_id: string | null;
  android_device_id: string | null;
  desktop_device_id: string | null;
  content: string;
  created_by_admin: string;
  created_at: number;
  read_at: number | null;
  read_platform: "android" | "desktop" | null;
  read_device_id: string | null;
};

function getTargetFromRow(row: DirectMessageRow): DirectMessageTarget {
  if (row.user_id) return { kind: "user", id: row.user_id };
  if (row.android_device_id) return { kind: "android_device", id: row.android_device_id };
  if (row.desktop_device_id) return { kind: "desktop_device", id: row.desktop_device_id };
  throw new Error(`专属消息 ${row.id} 没有有效接收方`);
}

function mapRow(row: DirectMessageRow): StoredDirectMessage {
  return {
    id: row.id,
    target: getTargetFromRow(row),
    content: row.content,
    createdByAdmin: row.created_by_admin,
    createdAt: row.created_at,
    readAt: row.read_at,
    readPlatform: row.read_platform,
    readDeviceId: row.read_device_id,
  };
}

function nonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field}不能为空`);
  return normalized;
}

function targetColumns(target: DirectMessageTarget): Pick<DirectMessageRow, "user_id" | "android_device_id" | "desktop_device_id"> {
  const id = nonEmpty(target.id, "接收方ID");
  switch (target.kind) {
    case "user":
      return { user_id: id, android_device_id: null, desktop_device_id: null };
    case "android_device":
      return { user_id: null, android_device_id: id, desktop_device_id: null };
    case "desktop_device":
      return { user_id: null, android_device_id: null, desktop_device_id: id };
  }
}

function ownsMessage(row: DirectMessageRow, identity: DirectMessageIdentity): boolean {
  return Boolean(
    (identity.userId && row.user_id === identity.userId)
    || (identity.device?.kind === "android" && row.android_device_id === identity.device.id)
    || (identity.device?.kind === "desktop" && row.desktop_device_id === identity.device.id),
  );
}

function normalizeLimit(limit: number | undefined, fallback: number, maximum: number): number {
  const value = Number.isFinite(limit) ? Math.floor(limit!) : fallback;
  return Math.max(1, Math.min(value, maximum));
}

function normalizeOffset(offset: number | undefined): number {
  const value = Number.isFinite(offset) ? Math.floor(offset!) : 0;
  return Math.max(0, value);
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

export function insertDirectMessage(input: InsertDirectMessageInput): StoredDirectMessage {
  const db = getAppDb();
  const id = input.id ? nonEmpty(input.id, "消息ID") : randomUUID();
  const content = nonEmpty(input.content, "消息内容");
  const createdByAdmin = nonEmpty(input.createdByAdmin, "管理员");
  const createdAt = input.createdAt ?? Date.now();
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) throw new Error("创建时间无效");
  const target = targetColumns(input.target);

  db.prepare(
    `INSERT INTO direct_messages (
      id, user_id, android_device_id, desktop_device_id, content, created_by_admin, created_at,
      read_at, read_platform, read_device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
  ).run(
    id,
    target.user_id,
    target.android_device_id,
    target.desktop_device_id,
    content,
    createdByAdmin,
    createdAt,
  );
  return mapRow(readDirectMessageById(db, id)!);
}

export function readDirectMessageForIdentity(identity: DirectMessageIdentity, id: string): StoredDirectMessage | null {
  const row = readDirectMessageById(getAppDb(), id);
  return row && ownsMessage(row, identity) ? mapRow(row) : null;
}

export function listUnreadDirectMessages(identity: DirectMessageIdentity, limit: number): DirectMessagePage {
  const safeLimit = normalizeLimit(limit, 50, 100);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (identity.userId) {
    where.push("user_id = ?");
    params.push(identity.userId);
  }
  if (identity.device?.kind === "android") {
    where.push("android_device_id = ?");
    params.push(identity.device.id);
  }
  if (identity.device?.kind === "desktop") {
    where.push("desktop_device_id = ?");
    params.push(identity.device.id);
  }
  if (where.length === 0) return { items: [], hasMore: false };

  params.push(safeLimit + 1);
  const rows = getAppDb().prepare(
    `SELECT *
     FROM direct_messages
     WHERE read_at IS NULL
       AND (${where.join(" OR ")})
     ORDER BY created_at ASC, id ASC
     LIMIT ?`,
  ).all(...params) as DirectMessageRow[];
  return {
    items: rows.slice(0, safeLimit).map(mapRow),
    hasMore: rows.length > safeLimit,
  };
}

export function listAdminDirectMessages(input: ListAdminDirectMessagesInput = {}): AdminDirectMessagePage {
  const target = input.target;
  const where: string[] = [];
  const params: string[] = [];
  if (target) {
    const columns = targetColumns(target);
    if (columns.user_id) {
      where.push("user_id = ?");
      params.push(columns.user_id);
    }
    if (columns.android_device_id) {
      where.push("android_device_id = ?");
      params.push(columns.android_device_id);
    }
    if (columns.desktop_device_id) {
      where.push("desktop_device_id = ?");
      params.push(columns.desktop_device_id);
    }
  }
  if (input.userId) {
    where.push("user_id = ?");
    params.push(input.userId);
  }
  if (input.androidDeviceId) {
    where.push("android_device_id = ?");
    params.push(input.androidDeviceId);
  }
  if (input.desktopDeviceId) {
    where.push("desktop_device_id = ?");
    params.push(input.desktopDeviceId);
  }
  const condition = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = normalizeLimit(input.limit, 30, 100);
  const offset = normalizeOffset(input.offset);
  const db = getAppDb();
  const totalRow = db.prepare(`SELECT COUNT(*) AS count FROM direct_messages ${condition}`).get(...params) as { count: number };
  const rows = db.prepare(
    `SELECT * FROM direct_messages ${condition}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset) as DirectMessageRow[];
  return { items: rows.map(mapRow), total: totalRow.count };
}

export function deleteDirectMessage(id: string): boolean {
  const messageId = nonEmpty(id, "消息 ID");
  const result = getAppDb().prepare("DELETE FROM direct_messages WHERE id = ?").run(messageId);
  return result.changes > 0;
}

export function markDirectMessageRead(
  identity: DirectMessageIdentity,
  id: string,
  readAt = Date.now(),
): StoredDirectMessage | null {
  if (!Number.isSafeInteger(readAt) || readAt < 0) throw new Error("阅读时间无效");
  const db = getAppDb();
  return runInTransaction(db, () => {
    const row = readDirectMessageById(db, id);
    if (!row || !ownsMessage(row, identity)) return null;
    if (row.read_at === null) {
      db.prepare(
        `UPDATE direct_messages
         SET read_at = ?, read_platform = ?, read_device_id = ?
         WHERE id = ? AND read_at IS NULL`,
      ).run(readAt, identity.device?.kind ?? null, identity.device?.id ?? null, id);
    }
    return mapRow(readDirectMessageById(db, id)!);
  });
}

function readDirectMessageById(db: DatabaseSync, id: string): DirectMessageRow | null {
  return (db.prepare("SELECT * FROM direct_messages WHERE id = ?").get(id) as DirectMessageRow | undefined) ?? null;
}
