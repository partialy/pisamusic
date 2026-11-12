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

export type Announcement = {
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

export async function readAnnouncements(options: { enabledOnly?: boolean } = {}): Promise<Announcement[]> {
  const db = getAppDb();
  const where = options.enabledOnly ? " WHERE enabled = 1" : "";
  const rows = (await db.query(
    db.dialect === "mysql"
      ? `SELECT * FROM announcements${where} ORDER BY sort_order ASC, id ASC`
      : `SELECT * FROM announcements${where} ORDER BY sort_order ASC, rowid ASC`,
    [],
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
  }[];
  return rows.map((row) => {
    let content: AnnouncementContent;
    try {
      content = parseAnnouncementContent(JSON.parse(row.content_json));
    } catch {
      throw new Error(`公告 ${row.id} 的内容数据无效`);
    }
    return {
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

export async function saveAnnouncement(announcement: Announcement): Promise<Announcement> {
  const db = getAppDb();
  const existing = (await db.queryOne("SELECT sort_order FROM announcements WHERE id = ?", [announcement.id])) as
    | { sort_order: number }
    | undefined;
  const maxRow = (await db.queryOne("SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM announcements", [])) as {
    max_order: number;
  };
  const sortOrder = existing?.sort_order ?? maxRow.max_order + 1;
  await db.execute(
    db.dialect === "mysql"
      ? `INSERT INTO announcements (
          id, content_json, time, publisher, confirm_text, show_every_time, show_goto_button, goto_url, sort_order, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          content_json = VALUES(content_json),
          time = VALUES(time),
          publisher = VALUES(publisher),
          confirm_text = VALUES(confirm_text),
          show_every_time = VALUES(show_every_time),
          show_goto_button = VALUES(show_goto_button),
          goto_url = VALUES(goto_url),
          enabled = VALUES(enabled)`
      : `INSERT INTO announcements (
          id, content_json, time, publisher, confirm_text, show_every_time, show_goto_button, goto_url, sort_order, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          content_json = excluded.content_json,
          time = excluded.time,
          publisher = excluded.publisher,
          confirm_text = excluded.confirm_text,
          show_every_time = excluded.show_every_time,
          show_goto_button = excluded.show_goto_button,
          goto_url = excluded.goto_url,
          enabled = excluded.enabled`,
    [
      announcement.id,
      JSON.stringify(toStoredAnnouncementContent(parseAnnouncementContent(announcement.content))),
      announcement.time,
      announcement.publisher,
      announcement.confirmText,
      boolToDb(Boolean(announcement.showEveryTime)),
      boolToDb(announcement.showGotoButton),
      announcement.gotoUrl ?? "",
      sortOrder,
      announcement.enabled === false ? 0 : 1,
    ],
  );
  return announcement;
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  const db = getAppDb();
  const result = await db.execute("DELETE FROM announcements WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function insertAnnouncement(db: DbTransaction, announcement: Announcement, sortOrder: number): Promise<void> {
  await db.execute(
    db.dialect === "mysql"
      ? `INSERT INTO announcements (
          id, content_json, time, publisher, confirm_text, show_every_time, show_goto_button, goto_url, sort_order, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`
      : `INSERT INTO announcements (
          id, content_json, time, publisher, confirm_text, show_every_time, show_goto_button, goto_url, sort_order, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      announcement.id,
      JSON.stringify(toStoredAnnouncementContent(parseAnnouncementContent(announcement.content))),
      announcement.time,
      announcement.publisher,
      announcement.confirmText,
      boolToDb(Boolean(announcement.showEveryTime)),
      boolToDb(announcement.showGotoButton),
      announcement.gotoUrl ?? "",
      sortOrder,
      announcement.enabled === false ? 0 : 1,
    ],
  );
}
