import { randomUUID } from "node:crypto";
import {
  createAnnouncementImageFileRecord,
  deleteAnnouncement,
  markFileRecordDeleted,
  readAnnouncements,
  readFileRecordById,
  saveAnnouncement,
  type Announcement,
  type FileRecordInfo,
  reconcileAnnouncementImageReferences,
} from "../db/configStore";
import {
  buildUrl,
  createAnnouncementImageUploadToken,
  deleteQiniuObject,
  statQiniuObjectInSpace,
  validateAnnouncementImageFile,
  type AnnouncementImageUploadTokenInput,
  type QiniuUploadTokenInfo,
} from "./qiniuReleaseFiles";
import { getAnnouncementImageFileIds, parseAnnouncementContent, type AnnouncementContent } from "./announcementContent";

export type AnnouncementImageRecord = {
  fileId: string;
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
};

export function createAnnouncementImageToken(input: AnnouncementImageUploadTokenInput): QiniuUploadTokenInfo {
  return createAnnouncementImageUploadToken(input);
}

export async function completeAnnouncementImageUpload(input: {
  announcementId: string;
  bucket: string;
  key: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<AnnouncementImageRecord> {
  validateAnnouncementImageFile(input.fileName, input.fileSize, input.mimeType);
  const prefix = `pisamusic/announcements/${encodeURIComponent(input.announcementId)}/`;
  if (!input.key.startsWith(prefix)) throw new Error("七牛文件 key 与公告 ID 不匹配");
  const stat = await statQiniuObjectInSpace("public-image", input.bucket, input.key);
  if (stat.fileSize !== input.fileSize) throw new Error("公告图片实际大小与声明不一致");
  const record = createAnnouncementImageFileRecord({
    id: randomUUID(),
    announcementId: input.announcementId,
    provider: "qiniu",
    bucket: input.bucket,
    objectKey: input.key,
    hash: stat.hash,
    fileName: input.fileName,
    mimeType: stat.mimeType || input.mimeType,
    fileSize: stat.fileSize,
  });
  return {
    fileId: record.id,
    bucket: record.bucket,
    objectKey: record.objectKey,
    hash: record.hash,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    url: buildUrl(record.objectKey, "public-image"),
  };
}

export function validateAnnouncementImages(content: AnnouncementContent): void {
  for (const fileId of getAnnouncementImageFileIds(content)) {
    const file = readFileRecordById(fileId);
    if (!file || file.usageType !== "announcement-image" || file.status !== "uploaded") {
      throw new Error(`公告图片文件无效：${fileId}`);
    }
  }
}

export function hydrateAnnouncementContent(content: AnnouncementContent): AnnouncementContent {
  return {
    schemaVersion: content.schemaVersion,
    blocks: content.blocks.map((block) => {
      if (block.type !== "image") return block;
      const file = readFileRecordById(block.fileId);
      return file?.usageType === "announcement-image" && file.status === "uploaded"
        ? { ...block, url: buildUrl(file.objectKey, "public-image") }
        : block;
    }),
  };
}

export function hydrateAnnouncement(announcement: Announcement): Announcement {
  return { ...announcement, content: hydrateAnnouncementContent(announcement.content) };
}

export function readHydratedAnnouncements(): Announcement[] {
  return readAnnouncements().map(hydrateAnnouncement);
}

export function reconcileAnnouncementImages(announcementId: string, content: AnnouncementContent): FileRecordInfo[] {
  validateAnnouncementImages(content);
  return reconcileAnnouncementImageReferences(announcementId, getAnnouncementImageFileIds(content));
}

export function saveManagedAnnouncement(announcement: Announcement): Announcement {
  validateAnnouncementImages(announcement.content);
  const saved = saveAnnouncement(announcement);
  const removed = reconcileAnnouncementImages(announcement.id, announcement.content);
  void cleanupUnreferencedAnnouncementImages(removed);
  return hydrateAnnouncement(saved);
}

export function deleteManagedAnnouncement(id: string): boolean {
  const removed = reconcileAnnouncementImages(id, { schemaVersion: 1, blocks: [{ type: "text", text: "deleted" }] });
  const deleted = deleteAnnouncement(id);
  if (deleted) void cleanupUnreferencedAnnouncementImages(removed);
  return deleted;
}

export async function cleanupUnreferencedAnnouncementImages(files: FileRecordInfo[]): Promise<void> {
  for (const file of files) {
    const current = readFileRecordById(file.id);
    if (!current || current.status !== "uploaded" || current.referencedBy.length > 0) continue;
    try {
      await deleteQiniuObject(current.bucket, current.objectKey);
      markFileRecordDeleted(current.id);
    } catch {
      // Keep an unreferenced record for the file-management page to retry later.
    }
  }
}

export function normalizeAnnouncementContent(input: unknown): AnnouncementContent {
  return parseAnnouncementContent(input);
}
