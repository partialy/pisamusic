import { getAppDb } from "./appDb";
import type { DbTransaction } from "./core/types";
import { createFileRecord, type CreateFileRecordInput, readFileRecordByIdWithDb, serializeFileReferences } from "./files/fileRecordStore";
import { lockSyncUser, type SyncChangeInput } from "./syncStore";
import { SyncValidationError } from "../services/syncPayloadPolicy";

export const COVER_GRACE_MS = 7 * 86400000;
export type CoverResource = {
  id: string; upload_id: string; owner_user_id: string | null; playlist_id: string; edit_generation: string;
  file_record_id: string; state: "pending" | "ready" | "deleting" | "deleted"; public_url: string;
  width: number; height: number; created_at: number; expires_at: number; unreferenced_at: number | null;
  deletion_claimed_at: number | null; last_error: string;
};
export async function lockCover(tx: DbTransaction, id: string): Promise<CoverResource | null> {
  // 写锁保证 MySQL RR 读取的是锁之后的最新状态；与 SQLite 写事务保持一致。
  await tx.execute("UPDATE playlist_cover_resources SET state=state WHERE id=?", [id]);
  return tx.queryOne<CoverResource>(`SELECT * FROM playlist_cover_resources WHERE id=?${tx.dialect === "mysql" ? " FOR UPDATE" : ""}`, [id]);
}
export async function readOwnedCover(userId: string, resourceId: string): Promise<CoverResource | null> {
  return getAppDb().queryOne<CoverResource>("SELECT * FROM playlist_cover_resources WHERE id=? AND owner_user_id=?", [resourceId,userId]);
}
export async function readCoverUpload(userId: string, uploadId: string): Promise<CoverResource | null> {
  return getAppDb().queryOne<CoverResource>("SELECT * FROM playlist_cover_resources WHERE upload_id=? AND owner_user_id=?", [uploadId,userId]);
}
export async function createCoverSession(userId: string, input: { id: string; uploadId: string; playlistId: string; editGeneration: string; publicUrl: string; expiresAt: number; file: CreateFileRecordInput }): Promise<void> {
  await getAppDb().transaction(async tx => {
    await lockSyncUser(tx,userId);
    await createFileRecord(input.file,tx);
    await tx.execute("UPDATE file_records SET status='pending' WHERE id=?", [input.file.id]);
    const now = Date.now();
    await tx.execute(`INSERT INTO playlist_cover_resources(id,upload_id,owner_user_id,playlist_id,edit_generation,file_record_id,state,public_url,width,height,created_at,expires_at,unreferenced_at,deletion_claimed_at,last_error)
      VALUES(?,?,?,?,?,?,'pending',?,0,0,?,?,?,NULL,'')`, [input.id,input.uploadId,userId,input.playlistId,input.editGeneration,input.file.id,input.publicUrl,now,input.expiresAt,now]);
  });
}
export async function completeCoverSession(userId: string, expected: CoverResource, info: { hash: string; width: number; height: number }): Promise<CoverResource> {
  return getAppDb().transaction(async tx => {
    await lockSyncUser(tx,userId);
    const row = await lockCover(tx,expected.id);
    if (!row || row.owner_user_id !== userId || row.upload_id !== expected.upload_id || !["pending","ready"].includes(row.state)) throw new SyncValidationError("封面会话不可用，请重新上传");
    if (row.state === "ready") return row;
    if (Number(row.expires_at) < Date.now()) throw new SyncValidationError("封面上传会话已过期");
    const file = await readFileRecordByIdWithDb(tx,row.file_record_id);
    if (!file || file.status !== "pending") throw new SyncValidationError("封面对象账本已失效");
    await tx.execute("UPDATE file_records SET status='uploaded',hash=? WHERE id=?", [info.hash,row.file_record_id]);
    await tx.execute("UPDATE playlist_cover_resources SET state='ready',width=?,height=?,unreferenced_at=? WHERE id=?", [info.width,info.height,Date.now(),row.id]);
    return { ...row,state:"ready",width:info.width,height:info.height };
  });
}
export async function applyCoverReferences(tx: DbTransaction, userId: string, changes: Iterable<SyncChangeInput>): Promise<void> {
  const touched = new Set<string>();
  for (const c of changes) {
    if (c.itemType !== "user_playlist") continue;
    const old = await tx.queryOne<{resource_id:string}>("SELECT resource_id FROM playlist_cover_refs WHERE user_id=? AND playlist_id=?", [userId,c.itemKey]);
    const p = c.payload as {coverResource?: {resourceId:string}|null};
    const next = c.action === "upsert" ? p?.coverResource?.resourceId : undefined;
    if (old?.resource_id === next) continue;
    // 旧资源也加锁；GC 若已认领删除，该资源不可能仍有权威引用。
    if (old) { await lockCover(tx,old.resource_id); touched.add(old.resource_id); }
    await tx.execute("DELETE FROM playlist_cover_refs WHERE user_id=? AND playlist_id=?", [userId,c.itemKey]);
    if (next) {
      await tx.execute("INSERT INTO playlist_cover_refs(user_id,playlist_id,resource_id) VALUES(?,?,?)", [userId,c.itemKey,next]);
      touched.add(next);
    }
  }
  for (const id of touched) {
    const refs = await tx.query<{user_id:string;playlist_id:string}>("SELECT user_id,playlist_id FROM playlist_cover_refs WHERE resource_id=? ORDER BY user_id,playlist_id", [id]);
    await tx.execute("UPDATE playlist_cover_resources SET unreferenced_at=? WHERE id=?", [refs.length ? null : Date.now(),id]);
    await tx.execute("UPDATE file_records SET referenced_by=? WHERE id=(SELECT file_record_id FROM playlist_cover_resources WHERE id=?)", [serializeFileReferences(refs.map(r => ({type:"playlist-cover" as const,id:`${r.user_id}:${r.playlist_id}`}))),id]);
  }
}
/** 身份和引用即时撤销，物理对象保留七天回收；不依赖用户外键级联删除资源。 */
export async function detachDeletedUserCovers(tx: DbTransaction, userId: string): Promise<void> {
  const rows = await tx.query<CoverResource>("SELECT * FROM playlist_cover_resources WHERE owner_user_id=? ORDER BY id", [userId]);
  for (const row of rows) await lockCover(tx,row.id);
  await tx.execute("DELETE FROM playlist_cover_refs WHERE user_id=?", [userId]);
  await tx.execute("UPDATE playlist_cover_resources SET owner_user_id=NULL,unreferenced_at=? WHERE owner_user_id=?", [Date.now(),userId]);
  await tx.execute("UPDATE file_records SET owner_user_id=NULL,referenced_by='[]' WHERE usage_type='playlist-cover' AND owner_user_id=?", [userId]);
}
