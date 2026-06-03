import {
  deleteFileRecordAndCleanupReferences,
  readFileRecordById,
  readReleaseFileById,
  readReleaseFileForHistory,
  type FileRecordInfo,
  type ReleaseFileInfo,
} from "../db/configStore";
import { deleteQiniuObject } from "./qiniuReleaseFiles";

export async function deleteManagedFileRecord(id: string): Promise<FileRecordInfo> {
  const file = readFileRecordById(id);
  if (!file) throw new Error("文件记录不存在");

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
