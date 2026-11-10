import { readAppShareConfig } from "../db/appShareStore";
import { deletingAppShareIcons } from "./appShareIconLifecycle";
import { readCloudMusicByFileRecordId } from "../db/cloudMusicStore";
import {
  completeUpdateHistoryDeletion,
  deleteFileRecordAndCleanupReferences,
  prepareUpdateHistoryDeletion,
  readFileRecordById,
  readReleaseFileById,
  readReleaseFileForHistory,
  type FileRecordInfo,
  type ReleaseFileInfo,
  type UpdateHistoryDeletionPlan,
} from "../db/configStore";
import { deleteCloudMusic } from "./cloudMusicService";
import { deleteQiniuObject } from "./qiniuReleaseFiles";

type DeleteObject = (bucket: string, key: string) => Promise<void>;

export type DeletedUpdateHistory = {
  id: string;
  deletedFiles: FileRecordInfo[];
};

export async function previewManagedUpdateHistoryDeletion(historyId: string): Promise<UpdateHistoryDeletionPlan> {
  const prepared = (await prepareUpdateHistoryDeletion(historyId));
  if (!prepared.ok) {
    if (prepared.reason === "NOT_FOUND") throw new Error("发布记录不存在");
    throw new Error("当前最新版本不可删除");
  }
  return prepared.plan;
}

export async function deleteManagedFileRecord(id: string): Promise<FileRecordInfo> {
  const file = (await readFileRecordById(id));
  if (!file) throw new Error("文件记录不存在");

  if (file.usageType === "app-share-icon") {
    if ((await readAppShareConfig()).iconFileId === id) throw new Error("当前 App 分享图标不能删除，请先更换图标");
    if (deletingAppShareIcons.has(id)) throw new Error("图标正在删除，请稍后重试");
    deletingAppShareIcons.add(id);
    try {
      if (file.status !== "deleted") await deleteQiniuObject(file.bucket, file.objectKey);
      return (await deleteFileRecordAndCleanupReferences(id));
    } finally { deletingAppShareIcons.delete(id); }
  }
  if (file.usageType === "announcement-image" && file.referencedBy.length > 0) {
    throw new Error("公告图片仍被公告内容引用，不能直接删除");
  }

  if (file.usageType === "cloud-music") {
    const track = (await readCloudMusicByFileRecordId(id));
    if (track) {
      await deleteCloudMusic(track.uuid);
      const deleted = (await readFileRecordById(id));
      if (!deleted) throw new Error("网盘音乐文件记录删除失败");
      return deleted;
    }
  }

  if (file.status !== "deleted" && file.provider === "qiniu") {
    await deleteQiniuObject(file.bucket, file.objectKey);
  }

  return (await deleteFileRecordAndCleanupReferences(id));
}

export async function deleteManagedReleaseFileForHistory(historyId: string): Promise<ReleaseFileInfo> {
  const file = (await readReleaseFileForHistory(historyId));
  if (!file) throw new Error("该发布记录没有可删除的安装包");

  await deleteManagedFileRecord(file.id);

  const deleted = (await readReleaseFileById(file.id));
  if (!deleted) throw new Error("安装包文件状态更新失败");
  return { ...deleted, historyId };
}

export async function deleteManagedUpdateHistory(
  historyId: string,
  deleteObject: DeleteObject = deleteQiniuObject,
): Promise<DeletedUpdateHistory> {
  const plan = (await previewManagedUpdateHistoryDeletion(historyId));

  for (const file of plan.files) {
    if (file.provider === "qiniu") {
      await deleteObject(file.bucket, file.objectKey);
    }
  }

  return {
    id: historyId,
    deletedFiles: (await completeUpdateHistoryDeletion(
      historyId,
      plan.files.map((file) => file.id),
    )),
  };
}
