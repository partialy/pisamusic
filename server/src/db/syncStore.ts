import type { DbTransaction, SqlValue } from "./core/types";
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
  baseVersion?: number | null;
};
export type SyncChange = SyncChangeInput & {
  version: number;
  deviceId: string;
  payload: unknown;
  clientUpdatedAt: string;
  serverUpdatedAt: number;
};
export type SyncItemRow = {
  item_type: string;
  item_key: string;
  payload_json: string;
  deleted: number;
  last_op_id: string;
  last_device_id: string;
  client_updated_at: string;
  server_version: number;
  server_updated_at: number;
};
export type SyncLogRow = {
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
/** 所有读写先锁用户行，MySQL RR 的首次一致性读由此建立在最新提交之后。 */
export async function lockSyncUser(tx: DbTransaction, userId: string): Promise<{
  sync_version: number;
  sync_log_floor: number;
}> {
  await tx.execute("UPDATE users SET sync_version=sync_version+0 WHERE id=?", [userId]);
  const row = await tx.queryOne<{
    sync_version: number;
    sync_log_floor: number;
  }>("SELECT sync_version,sync_log_floor FROM users WHERE id=?", [userId]);
  if (!row)
    throw new Error("同步用户不存在");
  return { sync_version: Number(row.sync_version), sync_log_floor: Number(row.sync_log_floor) };
}
export async function allocateVersions(tx: DbTransaction, userId: string, count: number): Promise<number> {
  await tx.execute("UPDATE users SET sync_version=sync_version+?,updated_at=? WHERE id=?", [count, Date.now(), userId]);
  return Number((await tx.queryOne<{
    sync_version: number;
  }>("SELECT sync_version FROM users WHERE id=?", [userId]))!.sync_version);
}
export async function findAppliedOps(tx: DbTransaction, auth: SyncAuth, opIds: string[]): Promise<Set<string>> {
  if (!opIds.length)
    return new Set();
  const rows = await tx.query<{
    op_id: string;
  }>(`SELECT op_id FROM user_sync_applied_ops WHERE user_id=? AND device_id=? AND op_id IN (${opIds.map(() => "?").join(",")})`, [auth.userId, auth.deviceId, ...opIds]);
  return new Set(rows.map(row => row.op_id));
}
export async function findItems(tx: DbTransaction, userId: string, keys: Pick<SyncChangeInput, "itemType" | "itemKey">[]): Promise<SyncItemRow[]> {
  const unique = [...new Map(keys.map(key => [JSON.stringify([key.itemType, key.itemKey]), key])).values()];
  const rows: SyncItemRow[] = [];
  // 加上父项后最多可达 1000 key；分块避免 SQLite 表达式深度/参数上限。
  for (let offset = 0; offset < unique.length; offset += 100) {
    const batch = unique.slice(offset, offset + 100);
    rows.push(...await tx.query<SyncItemRow>(`SELECT * FROM user_sync_items WHERE user_id=? AND (${batch.map(() => "(item_type=? AND item_key=?)").join(" OR ")})`, [userId, ...batch.flatMap(key => [key.itemType, key.itemKey])]));
  }
  return rows;
}
/** 使用精确前缀比较，避免歌单 ID 中的 SQL LIKE 通配符扩大删除范围。 */
export async function findPlaylistTracks(tx: DbTransaction, userId: string, playlistIds: string[]): Promise<SyncItemRow[]> {
  if (!playlistIds.length) return [];
  const ids = [...new Set(playlistIds)];
  const prefix = tx.dialect === "mysql" ? "LEFT(item_key,?)=?" : "substr(item_key,1,?)=?";
  return tx.query<SyncItemRow>(`SELECT * FROM user_sync_items WHERE user_id=? AND item_type='playlist_track' AND deleted=0 AND (${ids.map(() => prefix).join(" OR ")})`,
    [userId, ...ids.flatMap(id => [Array.from(id + "|").length, id + "|"])]);
}
async function insertBatch(tx: DbTransaction, table: string, fields: string[], rows: SqlValue[][], suffix = ""): Promise<void> {
  // 限制单条 SQL 参数数及包体积；每批最多 100 行。
  for (let offset = 0; offset < rows.length; offset += 100) {
    const batch = rows.slice(offset, offset + 100);
    await tx.execute(`INSERT INTO ${table} (${fields.join(",")}) VALUES ${batch.map(() => `(${fields.map(() => "?").join(",")})`).join(",")} ${suffix}`, batch.flat());
  }
}
export async function insertItems(tx: DbTransaction, auth: SyncAuth, changes: SyncChange[]): Promise<void> {
  const fields = ["user_id", "item_type", "item_key", "payload_json", "deleted", "last_op_id", "last_device_id", "client_updated_at", "server_version", "server_updated_at"];
  const update = fields.slice(3).map(field => tx.dialect === "mysql" ? `${field}=VALUES(${field})` : `${field}=excluded.${field}`).join(",");
  await insertBatch(tx, "user_sync_items", fields, changes.map(c => [auth.userId, c.itemType, c.itemKey, JSON.stringify(c.payload), c.action === "delete" ? 1 : 0, c.opId, auth.deviceId, c.clientUpdatedAt, c.version, c.serverUpdatedAt]), `${tx.dialect === "mysql" ? "ON DUPLICATE KEY UPDATE" : "ON CONFLICT(user_id,item_type,item_key) DO UPDATE SET"} ${update}`);
}
export async function insertLogs(tx: DbTransaction, auth: SyncAuth, changes: SyncChange[]): Promise<void> {
  await insertBatch(tx, "user_sync_change_log", ["user_id", "version", "op_id", "device_id", "item_type", "item_key", "action", "payload_json", "client_updated_at", "server_updated_at"], changes.map(c => [auth.userId, c.version, c.opId, auth.deviceId, c.itemType, c.itemKey, c.action, JSON.stringify(c.payload), c.clientUpdatedAt, c.serverUpdatedAt]));
}
export async function updateItemClocks(tx: DbTransaction, userId: string, changes: SyncChange[]): Promise<void> {
  for (let offset = 0; offset < changes.length; offset += 100) {
    const batch = changes.slice(offset, offset + 100);
    const cases = batch.map(() => "WHEN item_type=? AND item_key=? THEN ?").join(" ");
    await tx.execute(`UPDATE user_sync_items SET client_updated_at=CASE ${cases} ELSE client_updated_at END WHERE user_id=? AND (${batch.map(() => "(item_type=? AND item_key=?)").join(" OR ")})`, [...batch.flatMap(c => [c.itemType, c.itemKey, c.clientUpdatedAt]), userId, ...batch.flatMap(c => [c.itemType, c.itemKey])]);
  }
}
export async function insertAppliedOps(tx: DbTransaction, auth: SyncAuth, changes: SyncChangeInput[], version: number): Promise<void> {
  await insertBatch(tx, "user_sync_applied_ops", ["user_id", "device_id", "op_id", "server_version", "applied_at"], changes.map(c => [auth.userId, auth.deviceId, c.opId, version, Date.now()]));
}
export async function listLogs(tx: DbTransaction, userId: string, since: number, limit: number): Promise<SyncLogRow[]> {
  return tx.query<SyncLogRow>("SELECT * FROM user_sync_change_log WHERE user_id=? AND version>? ORDER BY version LIMIT ?", [userId, since, limit]);
}
export async function listSnapshot(tx: DbTransaction, userId: string, offset: number, limit: number, includeDeleted = false): Promise<SyncItemRow[]> {
  return tx.query<SyncItemRow>(`SELECT * FROM user_sync_items WHERE user_id=? ${includeDeleted ? "" : "AND deleted=0"} ORDER BY server_version,item_type,item_key LIMIT ? OFFSET ?`, [userId, limit, offset]);
}
export async function cleanupUserSync(tx: DbTransaction, userId: string, cutoff: number, minimum: number, opsCutoff: number): Promise<void> {
  await lockSyncUser(tx, userId);
  const keep = await tx.queryOne<{
    version: number;
  }>("SELECT version FROM user_sync_change_log WHERE user_id=? ORDER BY version DESC LIMIT 1 OFFSET ?", [userId, Math.max(0, minimum - 1)]);
  if (keep) {
    const last = await tx.queryOne<{
      version: number | null;
    }>("SELECT MAX(version) AS version FROM user_sync_change_log WHERE user_id=? AND version<? AND server_updated_at<?", [userId, Number(keep.version), cutoff]);
    if (last?.version != null) {
      // 裁剪连续前缀；floor 表示最后一个被裁剪版本，since==floor 仍可完整增量。
      const barrier = await tx.queryOne<{
        version: number | null;
      }>("SELECT MIN(version) AS version FROM user_sync_change_log WHERE user_id=? AND version<=? AND server_updated_at>=?", [userId, Number(last.version), cutoff]);
      const floor = barrier?.version != null ? Number(barrier.version) - 1 : Number(last.version);
      await tx.execute("DELETE FROM user_sync_change_log WHERE user_id=? AND version<=?", [userId, floor]);
      await tx.execute("UPDATE users SET sync_log_floor=CASE WHEN sync_log_floor<? THEN ? ELSE sync_log_floor END WHERE id=?", [floor, floor, userId]);
    }
  }
  await tx.execute("DELETE FROM user_sync_applied_ops WHERE user_id=? AND applied_at<?", [userId, opsCutoff]);
}
