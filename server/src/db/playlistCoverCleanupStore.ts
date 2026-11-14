import { getAppDb } from "./appDb";
import { lockCover, COVER_GRACE_MS } from "./playlistCoverStore";
import { readFileRecordByIdWithDb } from "./files/fileRecordStore";
/** 认领后永不重新开放引用；超时 lease 支持进程退出后的幂等重试。 */
export async function claimCoverDeletion(resourceId: string, now = Date.now()) {
  return getAppDb().transaction(async tx => {
    const resource = await lockCover(tx,resourceId);
    if (!resource || resource.state === "deleted") return null;
    const refs = await tx.queryOne(`SELECT resource_id FROM playlist_cover_refs WHERE resource_id=? LIMIT 1${tx.dialect === "mysql" ? " FOR UPDATE" : ""}`, [resourceId]);
    if (refs) throw new Error("歌单封面仍被引用，不能删除");
    if (resource.unreferenced_at == null || Number(resource.unreferenced_at) > now - COVER_GRACE_MS || Number(resource.expires_at) > now) throw new Error("歌单封面处于七天未引用保护期，不能删除");
    if (resource.state === "deleting" && resource.deletion_claimed_at != null && Number(resource.deletion_claimed_at) > now - 300000) return null;
    const file = await readFileRecordByIdWithDb(tx,resource.file_record_id);
    if (!file) throw new Error("封面对象账本缺失，保留回收记录");
    await tx.execute("UPDATE playlist_cover_resources SET state='deleting',deletion_claimed_at=?,last_error='' WHERE id=?", [now,resourceId]);
    return {resourceId,file,claimAt:now};
  });
}
export async function finishCoverDeletion(resourceId: string, claimAt: number, error?: string): Promise<void> {
  await getAppDb().transaction(async tx => {
    const row = await lockCover(tx,resourceId);
    if (!row || row.state !== "deleting" || Number(row.deletion_claimed_at) !== claimAt) return;
    if (error) {
      await tx.execute("UPDATE playlist_cover_resources SET last_error=? WHERE id=?", [error.slice(0,1000),resourceId]);
      return;
    }
    // state=deleting 阻止所有新引用；删除前/提交前均复核，异常绝不抹账。
    if (await tx.queryOne("SELECT resource_id FROM playlist_cover_refs WHERE resource_id=? LIMIT 1", [resourceId])) throw new Error("回收过程中发现封面引用冲突");
    await tx.execute("UPDATE file_records SET status='deleted',deleted_at=?,referenced_by='[]' WHERE id=?", [Date.now(),row.file_record_id]);
    await tx.execute("UPDATE playlist_cover_resources SET state='deleted',deletion_claimed_at=NULL,last_error='' WHERE id=?", [resourceId]);
  });
}
export async function coverDeletionCandidates(now = Date.now()): Promise<string[]> {
  const rows = await getAppDb().query<{id:string}>(`SELECT id FROM playlist_cover_resources WHERE state<>'deleted' AND unreferenced_at IS NOT NULL AND unreferenced_at<=? AND expires_at<=?
    AND (state<>'deleting' OR deletion_claimed_at IS NULL OR deletion_claimed_at<=?) ORDER BY COALESCE(deletion_claimed_at,0),unreferenced_at,id LIMIT 100`, [now-COVER_GRACE_MS,now,now-300000]);
  return rows.map(row => row.id);
}
export async function coverResourceForFile(fileId: string): Promise<string | null> {
  return (await getAppDb().queryOne<{id:string}>("SELECT id FROM playlist_cover_resources WHERE file_record_id=?", [fileId]))?.id ?? null;
}
