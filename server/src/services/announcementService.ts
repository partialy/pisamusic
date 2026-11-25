import { getAppDb } from "../db/appDb";
import { matchesAnnouncement, readAnnouncementQuery } from "./announcementDelivery";
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
import { getAnnouncementImageFileIds, type AnnouncementContent } from "./announcementContent";

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
  const record = (await createAnnouncementImageFileRecord({
    id: randomUUID(),
    announcementId: input.announcementId,
    provider: "qiniu",
    bucket: input.bucket,
    objectKey: input.key,
    hash: stat.hash,
    fileName: input.fileName,
    mimeType: stat.mimeType || input.mimeType,
    fileSize: stat.fileSize,
  }));
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

export async function validateAnnouncementImages(content: AnnouncementContent): Promise<void> {
  for (const fileId of getAnnouncementImageFileIds(content)) {
    const file = (await readFileRecordById(fileId));
    if (!file || file.usageType !== "announcement-image" || file.status !== "uploaded") {
      throw new Error(`公告图片文件无效：${fileId}`);
    }
  }
}

export async function hydrateAnnouncementContent(content: AnnouncementContent): Promise<AnnouncementContent> {
  return {
    schemaVersion: content.schemaVersion,
    blocks: await Promise.all(content.blocks.map(async (block) => {
      if (block.type !== "image") return block;
      const file = (await readFileRecordById(block.fileId));
      return file?.usageType === "announcement-image" && file.status === "uploaded"
        ? { ...block, url: buildUrl(file.objectKey, "public-image") }
        : block;
    })),
  };
}

export async function hydrateAnnouncement(announcement: Announcement): Promise<Announcement> {
  return { ...announcement, content: await hydrateAnnouncementContent(announcement.content) };
}

export async function readHydratedAnnouncements(options: { enabledOnly?: boolean } = {}): Promise<Announcement[]> {
  return Promise.all((await readAnnouncements(options)).map(hydrateAnnouncement));
}

export async function readPublicAnnouncements(input: Record<string, unknown>, startup = false): Promise<Announcement[]> {
  const query = readAnnouncementQuery(input, startup);
  const announcements = await readAnnouncements({ enabledOnly: true, maxVersion: query.announcementVersion });
  return Promise.all(announcements.filter((item) => matchesAnnouncement(item, query)).map(hydrateAnnouncement));
}

export async function reconcileAnnouncementImages(announcementId: string, content: AnnouncementContent): Promise<FileRecordInfo[]> {
  (await validateAnnouncementImages(content));
  return (await reconcileAnnouncementImageReferences(announcementId, getAnnouncementImageFileIds(content)));
}

export async function saveManagedAnnouncement(
  announcement: Announcement,
  expectedVersion: number | null,
): Promise<Announcement> {
  const { saved, removed } = await getAppDb().transaction(async () => {
    const saved = await saveAnnouncement(announcement, expectedVersion);
    const removed = await reconcileAnnouncementImages(announcement.id, announcement.content);
    return { saved, removed };
  });
  await cleanupUnreferencedAnnouncementImages(removed);
  return hydrateAnnouncement(saved);
}

export async function deleteManagedAnnouncement(id: string): Promise<boolean> {
  const removed = (await reconcileAnnouncementImages(id, { schemaVersion: 1, blocks: [{ type: "text", text: "deleted" }] }));
  const deleted = (await deleteAnnouncement(id));
  if (deleted) void (await cleanupUnreferencedAnnouncementImages(removed));
  return deleted;
}

export async function cleanupUnreferencedAnnouncementImages(files: FileRecordInfo[]): Promise<void> {
  for (const file of files) {
    const current = (await readFileRecordById(file.id));
    if (!current || current.status !== "uploaded" || current.referencedBy.length > 0) continue;
    try {
      await deleteQiniuObject(current.bucket, current.objectKey);
      (await markFileRecordDeleted(current.id));
    } catch {
      // Keep an unreferenced record for the file-management page to retry later.
    }
  }
}
