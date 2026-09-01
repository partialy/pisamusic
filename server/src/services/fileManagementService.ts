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

export function previewManagedUpdateHistoryDeletion(historyId: string): UpdateHistoryDeletionPlan {
  const prepared = prepareUpdateHistoryDeletion(historyId);
  if (!prepared.ok) {
    if (prepared.reason === "NOT_FOUND") throw new Error("发布记录不存在");
    throw new Error("当前最新版本不可删除");
  }
  return prepared.plan;
}

export async function deleteManagedFileRecord(id: string): Promise<FileRecordInfo> {
  const file = readFileRecordById(id);
  if (!file) throw new Error("文件记录不存在");

  if (file.usageType === "announcement-image" && file.referencedBy.length > 0) {
    throw new Error("公告图片仍被公告内容引用，不能直接删除");
  }

  if (file.usageType === "cloud-music") {
    const track = readCloudMusicByFileRecordId(id);
    if (track) {
      await deleteCloudMusic(track.uuid);
      const deleted = readFileRecordById(id);
      if (!deleted) throw new Error("网盘音乐文件记录删除失败");
      return deleted;
    }
  }

  if (file.status !== "deleted" && file.provider === "qiniu") {
    await deleteQiniuObject(file.bucket, file.objectKey);
  }

  return deleteFileRecordAndCleanupReferences(id);
}

export async function deleteManagedReleaseFileForHistory(historyId: string): Promise<ReleaseFileInfo> {
  const file = readReleaseFileForHistory(historyId);
  if (!file) throw new Error("该发布记录没有可删除的安装包");

  await deleteManagedFileRecord(file.id);

  const deleted = readReleaseFileById(file.id);
  if (!deleted) throw new Error("安装包文件状态更新失败");
  return { ...deleted, historyId };
}

export async function deleteManagedUpdateHistory(
  historyId: string,
  deleteObject: DeleteObject = deleteQiniuObject,
): Promise<DeletedUpdateHistory> {
  const plan = previewManagedUpdateHistoryDeletion(historyId);

  for (const file of plan.files) {
    if (file.provider === "qiniu") {
      await deleteObject(file.bucket, file.objectKey);
    }
  }

  return {
    id: historyId,
    deletedFiles: completeUpdateHistoryDeletion(
      historyId,
      plan.files.map((file) => file.id),
    ),
  };
}
