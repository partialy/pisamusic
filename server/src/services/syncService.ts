import { applyCoverReferences } from "../db/playlistCoverStore";
import { normalizeCoverChanges } from "./playlistCoverSync";
import { getAppDb } from "../db/appDb";
import type { DbClient } from "../db/core/types";
import * as store from "../db/syncStore";
import { configManager } from "../config/configManager";
export type { SyncAuth } from "../db/syncStore";

export { SyncValidationError } from "./syncPayloadPolicy";
import { SyncValidationError, validateSyncPayload, playlistId } from "./syncPayloadPolicy";
import { planSyncChanges, syncKey as key, syncTime as time } from "./syncChangePlanner";
export class SyncSnapshotExpiredError extends Error {
}
const TYPES = new Set(["favorite_song", "favorite_playlist", "user_playlist", "playlist_track"]);
const text = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";

/** JSON 对象递归排序，数组顺序保留；历史未规范化 JSON 也按语义比较。 */
export function canonicalPayload(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(normalize);
    if (!v || typeof v !== "object") return v;
    return Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize((v as Record<string, unknown>)[k])]));
  };
  return JSON.stringify(normalize(value ?? {}));
}
function timestamp(v: unknown, now: number): string {
  const raw = text(v, 64);
  if (!raw)
    return "";
  const n = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  if (!Number.isFinite(n) || n < 0)
    throw new SyncValidationError("clientUpdatedAt 必须是有效时间");
  // 允许五分钟时钟漂移，避免损坏的设备时间永久阻挡其他设备。
  return new Date(Math.min(n, now + 300000)).toISOString();
}
function normalizeChanges(raw: unknown): store.SyncChangeInput[] {
  if (!Array.isArray(raw))
    throw new SyncValidationError("changes 必须是数组");
  if (raw.length > 500)
    throw new SyncValidationError("单次最多推送 500 条变更");
  const now = Date.now();
  return raw.map(v => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new SyncValidationError("change 必须是对象");
    const c = v as Record<string, unknown>;
    const opId = text(c.opId, 128);
    const itemType = text(c.itemType, 64);
    const itemKey = text(c.itemKey, 256);
    const action = text(c.action, 16);
    if (!opId || !itemKey || !TYPES.has(itemType) || !["upsert", "delete"].includes(action))
      throw new SyncValidationError("同步变更字段无效");
    if (c.payload != null && (typeof c.payload !== "object" || Array.isArray(c.payload)))
      throw new SyncValidationError("payload 必须是对象");
    const change = { opId, itemType, itemKey, action: action as store.SyncAction, payload: JSON.parse(canonicalPayload(action === "delete" ? {} : c.payload)), clientUpdatedAt: timestamp(c.clientUpdatedAt, now) };
    validateSyncPayload(change);
    return change;
  });
}
export async function applySyncChanges(auth: store.SyncAuth, raw: unknown, db: DbClient = getAppDb()): Promise<{
  version: number;
  accepted: number;
  skipped: number;
}> {
  const changes = normalizeChanges(raw);
  return db.transaction(async (tx) => {
    const current = await store.lockSyncUser(tx, auth.userId);
    const ids = [...new Set(changes.map(c => c.opId))];
    const applied = await store.findAppliedOps(tx, auth, ids);
    const unique = new Map<string, store.SyncChangeInput>();
    for (const c of changes)
      if (!applied.has(c.opId) && !unique.has(c.opId))
        unique.set(c.opId, c);
    const inputs = [...unique.values()];
    const parentKeys = inputs.filter(c => c.itemType === "playlist_track")
      .map(c => playlistId(c.itemKey)).filter((id): id is string => id !== null)
      .map(itemKey => ({ itemType: "user_playlist", itemKey }));
    const rows = await store.findItems(tx, auth.userId, [...inputs, ...parentKeys]);
    const deletions = inputs.filter(c => c.itemType === "user_playlist" && c.action === "delete").map(c => c.itemKey);
    const children = await store.findPlaylistTracks(tx, auth.userId, deletions);
    const allRows = new Map([...rows, ...children].map(r => [key({ itemType: r.item_type, itemKey: r.item_key }), r]));
    const { existing, latest, derived } = planSyncChanges(inputs, [...allRows.values()], configManager.get<boolean>("sync.lwwEnabled", true));
    await normalizeCoverChanges(tx, auth.userId, latest.values());
    const effective: store.SyncChangeInput[] = [];
    const clocks: store.SyncChange[] = [];
    for (const c of latest.values()) {
      const item = existing.get(key(c));
      const noop = item && (c.action === "delete" ? Number(item.deleted) === 1 : Number(item.deleted) === 0 && canonicalPayload(JSON.parse(item.payload_json)) === canonicalPayload(c.payload));
      if (noop) {
        if (time(c.clientUpdatedAt ?? "") > time(item.client_updated_at))
          clocks.push({ ...c, version: Number(item.server_version), deviceId: item.last_device_id, opId: item.last_op_id, payload: JSON.parse(item.payload_json), clientUpdatedAt: c.clientUpdatedAt ?? "", serverUpdatedAt: Number(item.server_updated_at) });
      }
      else
        effective.push(c);
    }
    const version = effective.length ? await store.allocateVersions(tx, auth.userId, effective.length) : current.sync_version;
    const entries = effective.map((c, i) => ({ ...c, version: version - effective.length + i + 1, deviceId: auth.deviceId, payload: c.payload ?? {}, clientUpdatedAt: c.clientUpdatedAt ?? "", serverUpdatedAt: Date.now() }));
    // no-op 只推进冲突时钟，不改变版本/快照内容或历史设备来源。
    await store.updateItemClocks(tx, auth.userId, clocks);
    await applyCoverReferences(tx, auth.userId, latest.values());
    await store.insertItems(tx, auth, entries);
    await store.insertLogs(tx, auth, entries);
    await store.insertAppliedOps(tx, auth, [...unique.values()], version);
    const accepted = effective.filter(c => !derived.has(key(c))).length;
    return { version, accepted, skipped: changes.length - accepted };
  });
}
function fromItem(r: store.SyncItemRow): store.SyncChange {
  return {
    version: Number(r.server_version), opId: r.last_op_id, deviceId: r.last_device_id,
    itemType: r.item_type, itemKey: r.item_key, action: Number(r.deleted) ? "delete" : "upsert",
    payload: JSON.parse(r.payload_json), clientUpdatedAt: r.client_updated_at,
    serverUpdatedAt: Number(r.server_updated_at),
  };
}
function fromLog(r: store.SyncLogRow): store.SyncChange {
  return {
    version: Number(r.version), opId: r.op_id, deviceId: r.device_id,
    itemType: r.item_type, itemKey: r.item_key, action: r.action,
    payload: JSON.parse(r.payload_json), clientUpdatedAt: r.client_updated_at,
    serverUpdatedAt: Number(r.server_updated_at),
  };
}
function nonnegative(value: unknown, name: string, def = 0): number {
  if (value == null || value === "")
    return def;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new SyncValidationError(`${name} 必须是非负整数`);
  return n;
}
export async function listSyncChanges(auth: store.SyncAuth, query: Record<string, unknown>, db: DbClient = getAppDb()) {
  const since = nonnegative(query.since, "since");
  const limit = Math.max(1, Math.min(1000, nonnegative(query.limit, "limit", 1000)));
  const offset = nonnegative(query.cursor, "cursor");
  const paged = String(query.protocol) === "2";
  const token = query.snapshotVersion == null ? null : nonnegative(query.snapshotVersion, "snapshotVersion");
  if (offset > 0 && token === null)
    throw new SyncValidationError("快照分页缺少 snapshotVersion");
  return db.transaction(async (tx) => {
    const user = await store.lockSyncUser(tx, auth.userId), version = user.sync_version;
    if (since === 0 || since < user.sync_log_floor || token !== null) {
      if (token !== null && token !== version)
        throw new SyncSnapshotExpiredError("快照版本已变化，请从第一页重试");
      const rows = await store.listSnapshot(tx, auth.userId, paged ? offset : 0, paged ? limit + 1 : 2147483647, !paged);
      const hasMore = paged && rows.length > limit;
      const items = (hasMore ? rows.slice(0, limit) : rows).map(fromItem);
      return { mode: "snapshot", version, snapshotVersion: version, items, changes: items, cursor: hasMore ? String(offset + items.length) : null, hasMore };
    }
    const rows = await store.listLogs(tx, auth.userId, since, limit + 1), hasMore = rows.length > limit;
    return { mode: "delta", version, changes: rows.slice(0, limit).map(fromLog), hasMore };
  });
}
export async function cleanupSyncHistory(db: DbClient = getAppDb(), now = Date.now()): Promise<void> {
  const days = configManager.get<number>("sync.logRetentionDays", 90), minimum = configManager.get<number>("sync.logMinimumEntries", 1000);
  let after = "";
  while (true) {
    const users = await db.query<{
      id: string;
    }>("SELECT id FROM users WHERE id>? ORDER BY id LIMIT 100", [after]);
    if (!users.length)
      break;
    for (const user of users)
      await db.transaction(tx => store.cleanupUserSync(tx, user.id, now - days * 86400000, minimum, now - 30 * 86400000));
    after = users[users.length - 1]!.id;
  }
}
