import { createHash } from "node:crypto";
import type { SyncChangeInput, SyncItemRow } from "../db/syncStore";
import { mergeSyncPayload, playlistId } from "./syncPayloadPolicy";

export const syncKey = (c: Pick<SyncChangeInput, "itemType" | "itemKey">) => JSON.stringify([c.itemType, c.itemKey]);
export const syncTime = (v: string) => /^\d+$/.test(v) ? Number(v) : (Date.parse(v) || 0);

export type SyncPlanRejection = {
  opId: string;
  itemType: string;
  itemKey: string;
  reason: "lww_lost" | "parent_deleted";
  serverVersion: number;
};

/** 在事务内的权威快照上累计同批有效变更，过期操作不能夹带扩展更新。 */
export function planSyncChanges(changes: SyncChangeInput[], rows: SyncItemRow[], lww: boolean) {
  const existing = new Map(rows.map(r => [syncKey({ itemType: r.item_type, itemKey: r.item_key }), r]));
  const latest = new Map<string, SyncChangeInput>();
  const rejected: SyncPlanRejection[] = [];
  let conflicts = 0;

  for (const change of changes) {
    const id = syncKey(change), previous = latest.get(id), row = existing.get(id);
    const currentRowVersion = row ? Number(row.server_version) : 0;
    const hasBase = typeof change.baseVersion === "number";
    const isCausalFastForward = !previous && hasBase && change.baseVersion! >= currentRowVersion;
    if (!previous && row && hasBase && change.baseVersion! < currentRowVersion) {
      conflicts++;
    }
    const clock = previous?.clientUpdatedAt ?? row?.client_updated_at ?? "";
    if (lww && !isCausalFastForward && syncTime(change.clientUpdatedAt ?? "") < syncTime(clock)) {
      rejected.push({
        opId: change.opId,
        itemType: change.itemType,
        itemKey: change.itemKey,
        reason: "lww_lost",
        serverVersion: currentRowVersion,
      });
      continue;
    }
    const payload = previous ? (previous.action === "upsert" ? previous.payload : undefined)
      : row && !Number(row.deleted) ? JSON.parse(row.payload_json) : undefined;
    latest.set(id, { ...change, payload: mergeSyncPayload(change, payload) });
  }
  const parent = (id: string) => latest.get(syncKey({ itemType: "user_playlist", itemKey: id }));
  const deletedParent = (id: string) => {
    const pending = parent(id);
    return pending ? pending.action === "delete" : Number(existing.get(syncKey({ itemType: "user_playlist", itemKey: id }))?.deleted) === 1;
  };
  for (const [id, change] of latest) {
    const owner = change.itemType === "playlist_track" ? playlistId(change.itemKey) : null;
    if (owner && change.action === "upsert" && deletedParent(owner)) {
      const parentVersion = Number(existing.get(syncKey({ itemType: "user_playlist", itemKey: owner }))?.server_version ?? 0);
      rejected.push({
        opId: change.opId,
        itemType: change.itemType,
        itemKey: change.itemKey,
        reason: "parent_deleted",
        serverVersion: parentVersion,
      });
      latest.delete(id);
    }
  }
  const derived = new Set<string>();
  for (const row of rows) {
    if (row.item_type !== "playlist_track" || Number(row.deleted)) continue;
    const owner = playlistId(row.item_key);
    if (!owner || !deletedParent(owner)) continue;
    const id = syncKey({ itemType: row.item_type, itemKey: row.item_key });
    const deletion = parent(owner);
    const parentRow = existing.get(syncKey({ itemType: "user_playlist", itemKey: owner }));
    const clock = deletion?.clientUpdatedAt ?? parentRow?.client_updated_at ?? "";
    const explicit = latest.get(id);
    if (explicit?.action === "delete") {
      if (syncTime(clock) > syncTime(explicit.clientUpdatedAt ?? "")) explicit.clientUpdatedAt = clock;
      continue;
    }
    latest.set(id, {
      itemType: row.item_type, itemKey: row.item_key, action: "delete", payload: {},
      opId: "cascade:" + createHash("sha256").update(JSON.stringify([deletion?.opId ?? parentRow!.last_op_id, row.item_type, row.item_key])).digest("hex"),
      clientUpdatedAt: syncTime(clock) >= syncTime(row.client_updated_at) ? clock : row.client_updated_at,
    });
    derived.add(id);
  }
  return { existing, latest, derived, conflicts, rejected };
}
