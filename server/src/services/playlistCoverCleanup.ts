import { claimCoverDeletion, finishCoverDeletion, coverDeletionCandidates, coverResourceForFile } from "../db/playlistCoverCleanupStore";
import { readFileRecordById } from "../db/files/fileRecordStore";
import { deleteQiniuObject } from "./qiniuReleaseFiles";
async function deleteResource(id: string): Promise<boolean> {
  const claim = await claimCoverDeletion(id);
  if (!claim) return false;
  try {
    // claim 已锁定并复核引用，deleting 状态永久阻止重新引用；612 由七牛 helper 幂等处理。
    await deleteQiniuObject(claim.file.bucket,claim.file.objectKey);
    await finishCoverDeletion(id,claim.claimAt);
    return true;
  } catch(error) {
    await finishCoverDeletion(id,claim.claimAt,error instanceof Error ? error.message : "物理删除失败");
    throw error;
  }
}
export async function deletePlaylistCoverFile(fileId: string) {
  const resourceId = await coverResourceForFile(fileId);
  if (!resourceId) throw new Error("封面资源账本缺失，禁止绕过生命周期删除");
  const file = await readFileRecordById(fileId);
  if (file?.status === "deleted") return file;
  if (!await deleteResource(resourceId)) throw new Error("封面正在回收，请稍后重试");
  const result = await readFileRecordById(fileId);
  if (!result) throw new Error("封面对象账本缺失");
  return result;
}
/** 复用既有每日维护门禁；单轮有界，失败资源保留状态等待下一轮重试。 */
export async function cleanupPlaylistCovers(): Promise<void> {
  for (const id of await coverDeletionCandidates()) {
    try { await deleteResource(id); } catch(error) { console.error("[playlist-cover] 回收失败，保留重试记录",id,error); }
  }
}
