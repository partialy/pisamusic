import { createHash, randomBytes, randomUUID } from "node:crypto";
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

export type SyncAuth = {
  spaceId: string;
  deviceId: string;
};

export type SyncBindResult = SyncAuth & {
  syncCode: string;
  token: string;
  version: number;
};

const SYNC_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CHANGES_PER_PUSH = 500;
const MAX_CHANGES_PER_PULL = 1000;
const SYNC_CODE_RESET_COOLDOWN_MS = 4 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function makeToken(): string {
  return randomBytes(32).toString("base64url");
}

function makeSyncCode(): string {
  let out = "";
  const bytes = randomBytes(8);
  for (const byte of bytes) out += SYNC_CODE_ALPHABET[byte % SYNC_CODE_ALPHABET.length];
  return out;
}

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

function generateUniqueSyncCode(db: DatabaseSync): string {
  for (let i = 0; i < 20; i += 1) {
    const code = makeSyncCode();
    const row = db.prepare("SELECT id FROM sync_spaces WHERE sync_code = ?").get(code) as
      | { id: string }
      | undefined;
    if (!row) return code;
  }
  throw new Error("同步码生成失败");
}

function createDevice(db: DatabaseSync, spaceId: string, deviceName?: unknown, platform?: unknown): SyncBindResult {
  const now = Date.now();
  const token = makeToken();
  const deviceId = randomUUID();
  db.prepare(
    `INSERT INTO sync_devices (
      id, space_id, token_hash, device_name, platform, active, created_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    deviceId,
    spaceId,
    hashToken(token),
    normalizeText(deviceName, 128),
    normalizeText(platform, 32),
    now,
    now,
  );

  const row = db.prepare("SELECT sync_code, space_version FROM sync_spaces WHERE id = ?").get(spaceId) as {
    sync_code: string;
    space_version: number;
  };

  return {
    spaceId,
    deviceId,
    syncCode: row.sync_code,
    token,
    version: row.space_version,
  };
}

export function createSyncSpace(deviceName?: unknown, platform?: unknown): SyncBindResult {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const now = Date.now();
    const spaceId = randomUUID();
    const syncCode = generateUniqueSyncCode(db);
    db.prepare(
      `INSERT INTO sync_spaces (id, sync_code, space_version, created_at, updated_at)
       VALUES (?, ?, 0, ?, ?)`,
    ).run(spaceId, syncCode, now, now);
    return createDevice(db, spaceId, deviceName, platform);
  });
}

export function resetSyncSpace(
  auth: SyncAuth,
  deviceName?: unknown,
  platform?: unknown,
): SyncBindResult {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const now = Date.now();
    const current = db.prepare("SELECT created_at FROM sync_spaces WHERE id = ?").get(auth.spaceId) as
      | { created_at: number }
      | undefined;
    if (!current) throw new Error("同步空间不存在");
    const elapsed = now - current.created_at;
    if (elapsed < SYNC_CODE_RESET_COOLDOWN_MS) {
      const remainMinutes = Math.ceil((SYNC_CODE_RESET_COOLDOWN_MS - elapsed) / 60000);
      throw new Error(`同步码 4 小时内只能重新生成一次，请 ${remainMinutes} 分钟后再试`);
    }

    const nextSpaceId = randomUUID();
    const nextSyncCode = generateUniqueSyncCode(db);
    db.prepare(
      `INSERT INTO sync_spaces (id, sync_code, space_version, created_at, updated_at)
       VALUES (?, ?, 0, ?, ?)`,
    ).run(nextSpaceId, nextSyncCode, now, now);
    const result = createDevice(db, nextSpaceId, deviceName, platform);
    db.prepare("DELETE FROM sync_spaces WHERE id = ?").run(auth.spaceId);
    return result;
  });
}

export function joinSyncSpace(syncCode: unknown, deviceName?: unknown, platform?: unknown): SyncBindResult {
  const code = normalizeText(syncCode, 32).toUpperCase();
  if (!code) throw new Error("同步码不能为空");
  const db = getAppDb();
  return runInTransaction(db, () => {
    const row = db.prepare("SELECT id FROM sync_spaces WHERE sync_code = ?").get(code) as
      | { id: string }
      | undefined;
    if (!row) throw new Error("同步码不存在");
    return createDevice(db, row.id, deviceName, platform);
  });
}

export function authenticateSyncToken(rawToken: string): SyncAuth | null {
  const token = rawToken.trim();
  if (!token) return null;
  const db = getAppDb();
  const row = db
    .prepare(
      `SELECT id, space_id
       FROM sync_devices
       WHERE token_hash = ? AND active = 1`,
    )
    .get(hashToken(token)) as { id: string; space_id: string } | undefined;
  if (!row) return null;
  db.prepare("UPDATE sync_devices SET last_seen_at = ? WHERE id = ?").run(Date.now(), row.id);
  return { spaceId: row.space_id, deviceId: row.id };
}

export function listSyncChanges(auth: SyncAuth, since: unknown): { version: number; changes: SyncChange[] } {
  const normalizedSince = Math.max(0, Math.trunc(Number(since) || 0));
  const db = getAppDb();
  const rows = db
    .prepare(
      `SELECT version, op_id, device_id, item_type, item_key, action, payload_json,
              client_updated_at, server_updated_at
       FROM sync_change_log
       WHERE space_id = ? AND version > ?
       ORDER BY version ASC
       LIMIT ?`,
    )
    .all(auth.spaceId, normalizedSince, MAX_CHANGES_PER_PULL) as SyncChangeRow[];
  return {
    version: getSpaceVersion(db, auth.spaceId),
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
          `SELECT server_version FROM sync_applied_ops
           WHERE space_id = ? AND device_id = ? AND op_id = ?`,
        )
        .get(auth.spaceId, auth.deviceId, change.opId) as { server_version: number } | undefined;
      if (existing) {
        skipped += 1;
        continue;
      }
      applyOneChange(db, auth, change);
      accepted += 1;
    }
    return { version: getSpaceVersion(db, auth.spaceId), accepted, skipped };
  });
}

export function unbindSyncDevice(auth: SyncAuth): boolean {
  const db = getAppDb();
  db.prepare("UPDATE sync_devices SET active = 0, last_seen_at = ? WHERE id = ? AND space_id = ?").run(
    Date.now(),
    auth.deviceId,
    auth.spaceId,
  );
  return true;
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
  const nextVersion = getSpaceVersion(db, auth.spaceId) + 1;
  const now = Date.now();
  const payloadJson = change.action === "delete" ? "{}" : stringifyPayload(change.payload);
  db.prepare("UPDATE sync_spaces SET space_version = ?, updated_at = ? WHERE id = ?").run(
    nextVersion,
    now,
    auth.spaceId,
  );
  db.prepare(
    `INSERT INTO sync_items (
      space_id, item_type, item_key, payload_json, deleted, last_op_id, last_device_id,
      client_updated_at, server_version, server_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(space_id, item_type, item_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      deleted = excluded.deleted,
      last_op_id = excluded.last_op_id,
      last_device_id = excluded.last_device_id,
      client_updated_at = excluded.client_updated_at,
      server_version = excluded.server_version,
      server_updated_at = excluded.server_updated_at`,
  ).run(
    auth.spaceId,
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
    `INSERT INTO sync_change_log (
      space_id, version, op_id, device_id, item_type, item_key, action, payload_json,
      client_updated_at, server_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    auth.spaceId,
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
    `INSERT INTO sync_applied_ops (space_id, device_id, op_id, server_version, applied_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(auth.spaceId, auth.deviceId, change.opId, nextVersion, now);
}

function getSpaceVersion(db: DatabaseSync, spaceId: string): number {
  const row = db.prepare("SELECT space_version FROM sync_spaces WHERE id = ?").get(spaceId) as
    | { space_version: number }
    | undefined;
  return row?.space_version ?? 0;
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
