import type { DbTransaction } from "../core/types";
import { getAppDb } from "../appDb";
import { parseAnnouncementContent, toStoredAnnouncementContent, type AnnouncementContent } from "../../services/announcementContent";
import {
  addFileReference,
  createFileRecord,
  mapFileRecord,
  parseFileReferences,
  readFileRecordById,
  readFileRecordByIdWithDb,
  readFileRecordRowById,
  serializeFileReferences,
  type FileRecordInfo,
  type FileRecordRow,
} from "../files/fileRecordStore";

import { defaultAnnouncementDelivery, type AnnouncementDelivery } from "../../services/announcementDelivery";

export type Announcement = AnnouncementDelivery & {
  announcementVersion: number;
  id: string;
  content: AnnouncementContent;
  time: string;
  publisher: string;
  confirmText: string;
  showEveryTime?: boolean;
  showGotoButton: boolean;
  gotoUrl?: string;
  enabled: boolean;
};

function boolFromDb(value: unknown): boolean {
  return value === 1 || value === "1" || value === true;
}

function boolToDb(value: boolean): number {
  return value ? 1 : 0;
}

export async function createAnnouncementImageFileRecord(input: {
  id: string;
  announcementId: string;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<FileRecordInfo> {
  const record = await createFileRecord({
    id: input.id,
    usageType: "announcement-image",
    platform: "",
    version: "",
    assetType: "image",
    provider: input.provider,
    bucket: input.bucket,
    objectKey: input.objectKey,
    hash: input.hash,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    downloadUrl: "",
  });
  await addFileReference(getAppDb(), record.id, { type: "announcement-image", id: input.announcementId });
  return (await readFileRecordById(record.id)) ?? record;
}

export async function reconcileAnnouncementImageReferences(
  announcementId: string,
  fileIds: string[],
): Promise<FileRecordInfo[]> {
  const db = getAppDb();
  return await db.transaction(async (tx) => {
    const uniqueIds = [...new Set(fileIds)];
    for (const fileId of uniqueIds) {
      const row = await readFileRecordRowById(tx, fileId);
      const record = mapFileRecord(row);
      if (!record || record.usageType !== "announcement-image" || record.status !== "uploaded") {
        throw new Error(`公告图片文件无效：${fileId}`);
      }
    }

    const removed: FileRecordInfo[] = [];
    const rows = (await tx.query(
      "SELECT * FROM file_records WHERE usage_type = 'announcement-image'",
      [],
    )) as FileRecordRow[];
    for (const row of rows) {
      const refs = parseFileReferences(row.referenced_by);
      const hasReference = refs.some((ref) => ref.type === "announcement-image" && ref.id === announcementId);
      if (hasReference && !uniqueIds.includes(row.id)) {
        const next = refs.filter((ref) => !(ref.type === "announcement-image" && ref.id === announcementId));
        await tx.execute("UPDATE file_records SET referenced_by = ? WHERE id = ?", [
          serializeFileReferences(next),
          row.id,
        ]);
        const updated = await readFileRecordByIdWithDb(tx, row.id);
        if (updated) removed.push(updated);
      }
    }
    for (const fileId of uniqueIds) {
      await addFileReference(tx, fileId, { type: "announcement-image", id: announcementId });
    }
    return removed;
  });
}

export async function readAnnouncements(options: { enabledOnly?: boolean; maxVersion?: number; id?: string } = {}): Promise<Announcement[]> {
  const db = getAppDb();
  const clauses = options.enabledOnly ? ["enabled = 1"] : [];
  const params: (string | number)[] = [];
  if (options.maxVersion !== undefined) {
    clauses.push("announcement_version <= ?");
    params.push(options.maxVersion);
  }
  if (options.id !== undefined) {
    clauses.push("id = ?");
    params.push(options.id);
  }
  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const rows = (await db.query(
    db.dialect === "mysql"
      ? `SELECT * FROM announcements${where} ORDER BY sort_order ASC, id ASC`
      : `SELECT * FROM announcements${where} ORDER BY sort_order ASC, rowid ASC`,
    params,
  )) as {
    id: string;
    content_json: string;
    time: string;
    publisher: string;
    confirm_text: string;
    show_every_time: number;
    show_goto_button: number;
    goto_url: string | null;
    enabled: number;
    announcement_version: number;
    delivery_json: string | null;
  }[];
  return rows.map((row) => {
    let content: AnnouncementContent;
    try {
      content = parseAnnouncementContent(JSON.parse(row.content_json));
    } catch {
      throw new Error(`公告 ${row.id} 的内容数据无效`);
    }
    const delivery: AnnouncementDelivery = row.delivery_json ? JSON.parse(row.delivery_json) : defaultAnnouncementDelivery;
    return {
      ...delivery,
      announcementVersion: Number(row.announcement_version),
      id: row.id,
      content,
      time: row.time,
      publisher: row.publisher,
      confirmText: row.confirm_text,
      showEveryTime: boolFromDb(row.show_every_time),
      showGotoButton: boolFromDb(row.show_goto_button),
      gotoUrl: row.goto_url ?? "",
      enabled: boolFromDb(row.enabled),
    };
  });
}

export class AnnouncementWriteConflict extends Error {}

export async function saveAnnouncement(
  announcement: Announcement,
  expectedVersion: number | null,
): Promise<Announcement> {
  return getAppDb().transaction(async (db) => {
    const lock = db.dialect === "mysql" ? " FOR UPDATE" : "";
    const existing = await db.queryOne<{ announcement_version: number }>(
      "SELECT announcement_version FROM announcements WHERE id = ?" + lock,
      [announcement.id],
    );
    if ((existing ? Number(existing.announcement_version) : null) !== expectedVersion) {
      throw new AnnouncementWriteConflict("公告已被其他操作更新，请刷新后重试");
    }
    if (existing) {
      await db.execute(
        "UPDATE announcements SET content_json = ?, time = ?, publisher = ?, confirm_text = ?, show_every_time = ?, "
        + "show_goto_button = ?, goto_url = ?, enabled = ?, announcement_version = ?, delivery_json = ? WHERE id = ?",
        [...announcementValues(announcement), announcement.id],
      );
    } else {
      const max = await db.queryOne<{ max_order: number }>("SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM announcements");
      await insertAnnouncement(db, announcement, Number(max?.max_order ?? -1) + 1);
    }
    return announcement;
  });
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  const db = getAppDb();
  const result = await db.execute("DELETE FROM announcements WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

function announcementValues(announcement: Announcement): (number | string)[] {
  return [
    JSON.stringify(toStoredAnnouncementContent(parseAnnouncementContent(announcement.content))),
    announcement.time,
    announcement.publisher,
    announcement.confirmText,
    boolToDb(Boolean(announcement.showEveryTime)),
    boolToDb(announcement.showGotoButton),
    announcement.gotoUrl ?? "",
    boolToDb(announcement.enabled),
    announcement.announcementVersion,
    JSON.stringify({
      platform: announcement.platform,
      versionRule: announcement.versionRule,
      waitSeconds: announcement.waitSeconds,
      gotoAction: announcement.gotoAction,
    }),
  ];
}

export async function insertAnnouncement(db: DbTransaction, announcement: Announcement, sortOrder: number): Promise<void> {
  const sql = "INSERT INTO announcements (content_json, time, publisher, confirm_text, show_every_time, show_goto_button, "
    + "goto_url, enabled, announcement_version, delivery_json, id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  await db.execute(sql, [...announcementValues(announcement), announcement.id, sortOrder]);
}
