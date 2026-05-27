import { DatabaseSync } from "node:sqlite";
import { getAppDb } from "./appDb";

export const SYNC_ITEM_TYPES = new Set([
  "favorite_song",
  "favorite_playlist",
  "user_playlist",
  "playlist_track",
]);

export const SYNC_ACTIONS = new Set(["upsert", "delete"]);

export type SyncAction = "upsert" | "delete";

export type SyncAuth = {
  userId: string;
  deviceId: string;
};

export type SyncChangeInput = {
  opId: string;
  itemType: string;
  itemKey: string;
  action: SyncAction;
  payload?: unknown;
  clientUpdatedAt?: string;
};

export type SyncChange = {
  version: number;
  opId: string;
  deviceId: string;
  itemType: string;
  itemKey: string;
  action: SyncAction;
  payload: unknown;
  clientUpdatedAt: string;
  serverUpdatedAt: number;
};

const MAX_CHANGES_PER_PUSH = 500;
const MAX_CHANGES_PER_PULL = 1000;

function normalizeText(value: unknown, max: number): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.length <= max ? raw : raw.slice(0, max);
}

function stringifyPayload(payload: unknown): string {
  if (payload === undefined || payload === null) return "{}";
  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload 必须是对象");
  }
  return JSON.stringify(payload);
}

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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

export function listSyncChanges(auth: SyncAuth, since: unknown): { version: number; changes: SyncChange[] } {
  const normalizedSince = Math.max(0, Math.trunc(Number(since) || 0));
  const db = getAppDb();
  const rows = db
    .prepare(
      `SELECT version, op_id, device_id, item_type, item_key, action, payload_json,
              client_updated_at, server_updated_at
       FROM user_sync_change_log
       WHERE user_id = ? AND version > ?
       ORDER BY version ASC
       LIMIT ?`,
    )
    .all(auth.userId, normalizedSince, MAX_CHANGES_PER_PULL) as SyncChangeRow[];
  return {
    version: getUserSyncVersion(db, auth.userId),
    changes: rows.map(toSyncChange),
  };
}

export function applySyncChanges(
  auth: SyncAuth,
  rawChanges: unknown,
): { version: number; accepted: number; skipped: number } {
  const changes = normalizeChanges(rawChanges);
  const db = getAppDb();
  return runInTransaction(db, () => {
    let accepted = 0;
    let skipped = 0;
    for (const change of changes) {
      const existing = db
        .prepare(
          `SELECT server_version FROM user_sync_applied_ops
           WHERE user_id = ? AND device_id = ? AND op_id = ?`,
        )
        .get(auth.userId, auth.deviceId, change.opId) as { server_version: number } | undefined;
      if (existing) {
        skipped += 1;
        continue;
      }
      applyOneChange(db, auth, change);
      accepted += 1;
    }
    return { version: getUserSyncVersion(db, auth.userId), accepted, skipped };
  });
}

function normalizeChanges(rawChanges: unknown): SyncChangeInput[] {
  if (!Array.isArray(rawChanges)) throw new Error("changes 必须是数组");
  if (rawChanges.length > MAX_CHANGES_PER_PUSH) throw new Error(`单次最多推送 ${MAX_CHANGES_PER_PUSH} 条变更`);
  return rawChanges.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("change 必须是对象");
    const record = raw as Record<string, unknown>;
    const itemType = normalizeText(record.itemType, 64);
    const itemKey = normalizeText(record.itemKey, 256);
    const action = normalizeText(record.action, 16) as SyncAction;
    const opId = normalizeText(record.opId, 128);
    if (!opId) throw new Error("opId 不能为空");
    if (!SYNC_ITEM_TYPES.has(itemType)) throw new Error(`不支持的同步类型: ${itemType}`);
    if (!itemKey) throw new Error("itemKey 不能为空");
    if (!SYNC_ACTIONS.has(action)) throw new Error(`不支持的同步动作: ${action}`);
    return {
      opId,
      itemType,
      itemKey,
      action,
      payload: action === "delete" ? {} : record.payload,
      clientUpdatedAt: normalizeText(record.clientUpdatedAt, 64),
    };
  });
}

function applyOneChange(db: DatabaseSync, auth: SyncAuth, change: SyncChangeInput) {
  const nextVersion = getUserSyncVersion(db, auth.userId) + 1;
  const now = Date.now();
  const payloadJson = change.action === "delete" ? "{}" : stringifyPayload(change.payload);
  db.prepare("UPDATE users SET sync_version = ?, updated_at = ? WHERE id = ?").run(nextVersion, now, auth.userId);
  db.prepare(
    `INSERT INTO user_sync_items (
      user_id, item_type, item_key, payload_json, deleted, last_op_id, last_device_id,
      client_updated_at, server_version, server_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, item_type, item_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      deleted = excluded.deleted,
      last_op_id = excluded.last_op_id,
      last_device_id = excluded.last_device_id,
      client_updated_at = excluded.client_updated_at,
      server_version = excluded.server_version,
      server_updated_at = excluded.server_updated_at`,
  ).run(
    auth.userId,
    change.itemType,
    change.itemKey,
    payloadJson,
    change.action === "delete" ? 1 : 0,
    change.opId,
    auth.deviceId,
    change.clientUpdatedAt ?? "",
    nextVersion,
    now,
  );
  db.prepare(
    `INSERT INTO user_sync_change_log (
      user_id, version, op_id, device_id, item_type, item_key, action, payload_json,
      client_updated_at, server_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    auth.userId,
    nextVersion,
    change.opId,
    auth.deviceId,
    change.itemType,
    change.itemKey,
    change.action,
    payloadJson,
    change.clientUpdatedAt ?? "",
    now,
  );
  db.prepare(
    `INSERT INTO user_sync_applied_ops (user_id, device_id, op_id, server_version, applied_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(auth.userId, auth.deviceId, change.opId, nextVersion, now);
}

function getUserSyncVersion(db: DatabaseSync, userId: string): number {
  const row = db.prepare("SELECT sync_version FROM users WHERE id = ?").get(userId) as
    | { sync_version: number }
    | undefined;
  return row?.sync_version ?? 0;
}

type SyncChangeRow = {
  version: number;
  op_id: string;
  device_id: string;
  item_type: string;
  item_key: string;
  action: SyncAction;
  payload_json: string;
  client_updated_at: string;
  server_updated_at: number;
};

function toSyncChange(row: SyncChangeRow): SyncChange {
  return {
    version: row.version,
    opId: row.op_id,
    deviceId: row.device_id,
    itemType: row.item_type,
    itemKey: row.item_key,
    action: row.action,
    payload: parsePayload(row.payload_json),
    clientUpdatedAt: row.client_updated_at,
    serverUpdatedAt: row.server_updated_at,
  };
}
