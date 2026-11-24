import type { DbTransaction } from "../core/types";
import { getAppDb } from "../appDb";
import type { ReleasePlatform } from "../system/systemConfigStore";
import type { PaginatedListData } from "../../types/response";
import { buildPaginatedList, normalizePagination } from "../../utils/pagination";

export type ReleaseFileStatus = "uploaded" | "deleted";

export type DesktopUpdateAssetType = "latest-yml" | "installer" | "blockmap";

export type DesktopUpdateAssetInfo = {
  id: string;
  fileRecordId?: string | null;
  version: string;
  platform: "win32";
  arch: "x64";
  fileType: DesktopUpdateAssetType;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: ReleaseFileStatus;
  active: boolean;
  createdAt: number;
  deletedAt: number | null;
  releaseFile?: ReleaseFileInfo | null;
};

export type ReleaseFileInfo = {
  id: string;
  fileRecordId?: string | null;
  historyId: string | null;
  platform: ReleasePlatform;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
  status: ReleaseFileStatus;
  createdAt: number;
  deletedAt: number | null;
  desktopUpdateAsset?: DesktopUpdateAssetInfo;
};

export type FileRecordUsageType = "release-package" | "desktop-update" | "cloud-music" | "announcement-image" | "app-share-icon" | "sidebar-menu-icon" | "playlist-cover";
export type FileRecordStatus = ReleaseFileStatus | "pending";
export type FileRecordOwnerType = "system" | "user";

export type FileRecordInfo = {
  id: string;
  usageType: FileRecordUsageType;
  ownerType: FileRecordOwnerType;
  ownerUserId: string | null;
  ownerSnapshot: Record<string, unknown>;
  platform: string;
  version: string;
  assetType: string;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
  status: FileRecordStatus;
  referencedBy: string[];
  createdAt: number;
  deletedAt: number | null;
};

export type FileRecordListQuery = {
  status?: FileRecordStatus | "all";
  usageType?: FileRecordUsageType | "all";
  platform?: string;
  version?: string;
  keyword?: string;
  offset?: number;
  limit?: number;
};

export type FileRecordListResult = PaginatedListData<FileRecordInfo>;

export type FileRecordRow = {
  id: string;
  usage_type: string;
  owner_type: string;
  owner_user_id: string | null;
  owner_snapshot_json: string;
  platform: string;
  version: string;
  asset_type: string;
  provider: string;
  bucket: string;
  object_key: string;
  hash: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  download_url: string;
  status: string;
  referenced_by: string;
  created_at: number;
  deleted_at: number | null;
};

type FileRecordReferenceBase = {
  id?: string;
  platform?: ReleasePlatform | "win32";
  version?: string;
  fileName?: string;
};

export type FileRecordReference =
  | (FileRecordReferenceBase & { type: "cloud-music"; id: string })
  | (FileRecordReferenceBase & { type: "announcement-image" | "app-share-icon" | "playlist-cover"; id: string })
  | (FileRecordReferenceBase & { type: "history" | "current-release" | "active-desktop-update" });

export type FileRecordReferenceType = FileRecordReference["type"];

export const DESKTOP_UPDATE_PLATFORM = "win32/x64";

export function buildReleaseDownloadPath(id: string): string {
  return "/api/config/release-files/" + encodeURIComponent(id) + "/download";
}

export function parseFileReferences(raw: string): FileRecordReference[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const value = JSON.parse(text) as unknown;
    if (!Array.isArray(value)) return legacyFileReferences(text);
    return value
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .flatMap<FileRecordReference>((item) => {
        const type =
          item.type === "current-release" ||
          item.type === "active-desktop-update" ||
          item.type === "cloud-music" ||
          item.type === "announcement-image" ||
          item.type === "app-share-icon" ||
          item.type === "playlist-cover" ||
          item.type === "history"
            ? item.type
            : "history";
        const id = typeof item.id === "string" ? item.id : undefined;
        if (type === "cloud-music" || type === "announcement-image" || type === "app-share-icon" || type === "playlist-cover") {
          return id ? [{ type, id }] : [];
        }
        return [
          {
            type,
            id,
            platform:
              item.platform === "android" || item.platform === "desktop" || item.platform === "win32"
                ? item.platform
                : undefined,
            version: typeof item.version === "string" ? item.version : undefined,
            fileName: typeof item.fileName === "string" ? item.fileName : undefined,
          },
        ];
      });
  } catch {
    return legacyFileReferences(text);
  }
}

function legacyFileReferences(value: string): FileRecordReference[] {
  if (!value) return [];
  if (value === "active-desktop-update") return [{ type: "active-desktop-update", platform: "win32" }];
  return [{ type: "history", id: value }];
}

export function fileReferenceKey(ref: FileRecordReference): string {
  return [ref.type, ref.id ?? "", ref.platform ?? "", ref.version ?? "", ref.fileName ?? ""].join("|");
}

export function serializeFileReferences(refs: FileRecordReference[]): string {
  const unique = new Map<string, FileRecordReference>();
  for (const ref of refs) unique.set(fileReferenceKey(ref), ref);
  return JSON.stringify([...unique.values()]);
}

export function fileReferenceLabel(ref: FileRecordReference): string {
  if (ref.type === "current-release") return `当前${ref.platform === "desktop" ? "PC" : "Android"}发布`;
  if (ref.type === "active-desktop-update")
    return `PC 自动更新${ref.version ? ` ${ref.version}` : ""}${ref.fileName ? ` ${ref.fileName}` : ""}`;
  if (ref.type === "cloud-music") return ref.id ? `网盘音乐 ${ref.id}` : "网盘音乐";
  if (ref.type === "playlist-cover") return `歌单封面 ${ref.id}`;
  if (ref.type === "app-share-icon") return "当前 App 分享图标";
  if (ref.type === "announcement-image") return ref.id ? `公告图片 ${ref.id}` : "公告图片";
  return ref.id ? `发布记录 ${ref.id}` : "发布记录";
}

function parseOwnerSnapshot(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function releasePlatformFromRecord(record: Pick<FileRecordInfo, "platform">): ReleasePlatform {
  return record.platform === "android" ? "android" : "desktop";
}

export function isInstallerRecord(record: Pick<FileRecordInfo, "assetType">): boolean {
  return record.assetType === "installer";
}

export function isDesktopUpdateRecord(record: Pick<FileRecordInfo, "platform" | "assetType" | "version">): boolean {
  return (
    Boolean(record.version) &&
    (record.platform === DESKTOP_UPDATE_PLATFORM || record.platform === "desktop") &&
    (record.assetType === "latest-yml" || record.assetType === "installer" || record.assetType === "blockmap")
  );
}

export function canonicalDownloadUrlForRecord(record: Pick<FileRecordInfo, "id" | "assetType">): string {
  return isInstallerRecord(record) ? buildReleaseDownloadPath(record.id) : "";
}

export function normalizeRecordPlatform(input: {
  usageType: FileRecordUsageType;
  platform: string;
  assetType: string;
  version: string;
}): string {
  if (input.assetType === "latest-yml" || input.assetType === "blockmap") return DESKTOP_UPDATE_PLATFORM;
  if (input.usageType === "desktop-update") return DESKTOP_UPDATE_PLATFORM;
  if (input.platform === "desktop" && input.version && input.assetType === "installer") return DESKTOP_UPDATE_PLATFORM;
  return input.platform;
}

export function mapFileRecord(row?: FileRecordRow | null): FileRecordInfo | null {
  if (!row) return null;
  const refs = parseFileReferences(row.referenced_by);
  return {
    id: row.id,
    usageType:
      row.usage_type === "desktop-update" ||
      row.usage_type === "cloud-music" ||
      row.usage_type === "announcement-image" ||
      row.usage_type === "app-share-icon" ||
      row.usage_type === "playlist-cover"
        ? row.usage_type
        : "release-package",
    ownerType: row.owner_type === "user" ? "user" : "system",
    ownerUserId: row.owner_user_id,
    ownerSnapshot: parseOwnerSnapshot(row.owner_snapshot_json),
    platform: row.platform,
    version: row.version,
    assetType: row.asset_type,
    provider: "qiniu",
    bucket: row.bucket,
    objectKey: row.object_key,
    hash: row.hash,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size) || 0,
    downloadUrl: row.download_url,
    status: row.status === "deleted" ? "deleted" : row.status === "pending" ? "pending" : "uploaded",
    referencedBy: refs.map(fileReferenceLabel),
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

export function releaseFileFromRecord(record?: FileRecordInfo | null): ReleaseFileInfo | null {
  if (!record || !isInstallerRecord(record)) return null;
  return {
    id: record.id,
    fileRecordId: record.id,
    historyId: null,
    platform: releasePlatformFromRecord(record),
    provider: "qiniu",
    bucket: record.bucket,
    objectKey: record.objectKey,
    hash: record.hash,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    downloadUrl: canonicalDownloadUrlForRecord(record),
    status: record.status === "deleted" ? "deleted" : "uploaded",
    createdAt: record.createdAt,
    deletedAt: record.deletedAt,
  };
}

export function desktopAssetFromRecord(record?: FileRecordInfo | null): DesktopUpdateAssetInfo | null {
  if (!record || !isDesktopUpdateRecord(record)) return null;
  const fileType =
    record.assetType === "latest-yml" || record.assetType === "blockmap" ? record.assetType : "installer";
  return {
    id: record.id,
    fileRecordId: record.id,
    version: record.version,
    platform: "win32",
    arch: "x64",
    fileType,
    provider: "qiniu",
    bucket: record.bucket,
    objectKey: record.objectKey,
    hash: record.hash,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    status: record.status === "deleted" ? "deleted" : "uploaded",
    active: record.referencedBy.some((label) => label.startsWith("PC 自动更新")),
    createdAt: record.createdAt,
    deletedAt: record.deletedAt,
    releaseFile: fileType === "installer" ? releaseFileFromRecord(record) : undefined,
  };
}

export async function readFileRecordByIdWithDb(db: DbTransaction, id: string): Promise<FileRecordInfo | null> {
  const row = (await db.queryOne("SELECT * FROM file_records WHERE id = ?", [id])) as FileRecordRow | undefined;
  return mapFileRecord(row);
}

export async function readFileRecordRowById(db: DbTransaction, id: string): Promise<FileRecordRow | null> {
  return ((await db.queryOne("SELECT * FROM file_records WHERE id = ?", [id])) as FileRecordRow | undefined) ?? null;
}

export async function readFileRecordByProviderKey(
  provider: "qiniu",
  bucket: string,
  objectKey: string,
): Promise<FileRecordInfo | null> {
  const row = (await getAppDb().queryOne(
    "SELECT * FROM file_records WHERE provider = ? AND bucket = ? AND object_key = ?",
    [provider, bucket, objectKey],
  )) as FileRecordRow | undefined;
  return mapFileRecord(row);
}

export async function updateFileReferences(
  db: DbTransaction,
  id: string,
  updater: (refs: FileRecordReference[]) => FileRecordReference[],
): Promise<void> {
  const row = await readFileRecordRowById(db, id);
  if (!row) throw new Error("文件记录不存在");
  const refs = updater(parseFileReferences(row.referenced_by));
  await db.execute("UPDATE file_records SET referenced_by = ? WHERE id = ?", [serializeFileReferences(refs), id]);
}

export async function addFileReference(db: DbTransaction, id: string, ref: FileRecordReference): Promise<void> {
  await updateFileReferences(db, id, (refs) => [
    ...refs.filter((item) => fileReferenceKey(item) !== fileReferenceKey(ref)),
    ref,
  ]);
}

export async function removeFileReferences(
  db: DbTransaction,
  predicate: (ref: FileRecordReference, row: FileRecordRow) => boolean,
): Promise<void> {
  const rows = (await db.query("SELECT * FROM file_records WHERE referenced_by <> ''", [])) as FileRecordRow[];
  for (const row of rows) {
    const refs = parseFileReferences(row.referenced_by);
    const next = refs.filter((ref) => !predicate(ref, row));
    if (next.length !== refs.length) {
      await db.execute("UPDATE file_records SET referenced_by = ? WHERE id = ?", [serializeFileReferences(next), row.id]);
    }
  }
}

export async function readReleaseFileById(id: string): Promise<ReleaseFileInfo | null> {
  const record = await readFileRecordByIdWithDb(getAppDb(), id);
  return releaseFileFromRecord(record);
}

export type CreateFileRecordInput = {
  id: string;
  usageType: FileRecordUsageType;
  ownerType?: FileRecordOwnerType;
  ownerUserId?: string | null;
  ownerSnapshot?: Record<string, unknown>;
  platform: string;
  version: string;
  assetType: string;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl?: string;
};

export async function createFileRecord(input: CreateFileRecordInput, db: DbTransaction = getAppDb()): Promise<FileRecordInfo> {
  const now = Date.now();
  const platform = normalizeRecordPlatform(input);
  const downloadUrl = input.assetType === "installer" ? buildReleaseDownloadPath(input.id) : "";
  await db.execute(
    db.dialect === "mysql"
      ? `INSERT INTO file_records (
          id, usage_type, owner_type, owner_user_id, owner_snapshot_json, platform, version, asset_type, provider, bucket, object_key,
          hash, file_name, mime_type, file_size, download_url, status, referenced_by, created_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, NULL)
        ON DUPLICATE KEY UPDATE
          usage_type = CASE
            WHEN VALUES(usage_type) = 'desktop-update' OR file_records.usage_type = 'desktop-update' THEN 'desktop-update'
            ELSE VALUES(usage_type)
          END,
          owner_type = VALUES(owner_type),
          owner_user_id = VALUES(owner_user_id),
          owner_snapshot_json = VALUES(owner_snapshot_json),
          platform = CASE WHEN VALUES(platform) <> '' THEN VALUES(platform) ELSE file_records.platform END,
          version = CASE WHEN VALUES(version) <> '' THEN VALUES(version) ELSE file_records.version END,
          asset_type = CASE WHEN VALUES(asset_type) <> '' THEN VALUES(asset_type) ELSE file_records.asset_type END,
          hash = VALUES(hash),
          file_name = VALUES(file_name),
          mime_type = VALUES(mime_type),
          file_size = VALUES(file_size),
          download_url = CASE WHEN VALUES(asset_type) = 'installer' THEN file_records.download_url ELSE '' END,
          status = 'uploaded',
          deleted_at = NULL`
      : `INSERT INTO file_records (
          id, usage_type, owner_type, owner_user_id, owner_snapshot_json, platform, version, asset_type, provider, bucket, object_key,
          hash, file_name, mime_type, file_size, download_url, status, referenced_by, created_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, NULL)
        ON CONFLICT(provider, bucket, object_key) DO UPDATE SET
          usage_type = CASE
            WHEN excluded.usage_type = 'desktop-update' OR file_records.usage_type = 'desktop-update' THEN 'desktop-update'
            ELSE excluded.usage_type
          END,
          owner_type = excluded.owner_type,
          owner_user_id = excluded.owner_user_id,
          owner_snapshot_json = excluded.owner_snapshot_json,
          platform = CASE WHEN excluded.platform <> '' THEN excluded.platform ELSE file_records.platform END,
          version = CASE WHEN excluded.version <> '' THEN excluded.version ELSE file_records.version END,
          asset_type = CASE WHEN excluded.asset_type <> '' THEN excluded.asset_type ELSE file_records.asset_type END,
          hash = excluded.hash,
          file_name = excluded.file_name,
          mime_type = excluded.mime_type,
          file_size = excluded.file_size,
          download_url = CASE WHEN excluded.asset_type = 'installer' THEN file_records.download_url ELSE '' END,
          status = 'uploaded',
          deleted_at = NULL`,
    [
      input.id,
      input.usageType,
      input.ownerType ?? "system",
      input.ownerUserId ?? null,
      JSON.stringify(input.ownerSnapshot ?? { displayName: "system" }),
      platform,
      input.version,
      input.assetType,
      input.provider,
      input.bucket,
      input.objectKey,
      input.hash,
      input.fileName,
      input.mimeType,
      input.fileSize,
      downloadUrl,
      serializeFileReferences([]),
      now,
    ],
  );
  const saved = mapFileRecord(await db.queryOne<FileRecordRow>("SELECT * FROM file_records WHERE provider=? AND bucket=? AND object_key=?", [input.provider,input.bucket,input.objectKey]));
  if (!saved) throw new Error("文件记录保存失败");
  const canonicalDownloadUrl = canonicalDownloadUrlForRecord(saved);
  if (saved.downloadUrl !== canonicalDownloadUrl) {
    await db.execute("UPDATE file_records SET download_url = ? WHERE id = ?", [canonicalDownloadUrl, saved.id]);
    return (await readFileRecordByIdWithDb(db, saved.id)) ?? saved;
  }
  return saved;
}

export async function readFileRecordById(id: string): Promise<FileRecordInfo | null> {
  return await readFileRecordByIdWithDb(getAppDb(), id);
}

export async function listFileRecords(query: FileRecordListQuery = {}): Promise<FileRecordListResult> {
  const db = getAppDb();
  const { offset, limit } = normalizePagination(query.offset, query.limit);
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.status && query.status !== "all") {
    where.push("status = ?");
    params.push(query.status);
  }
  if (query.usageType && query.usageType !== "all") {
    where.push("usage_type = ?");
    params.push(query.usageType);
  }
  if (query.platform?.trim()) {
    where.push("platform LIKE ?");
    params.push(`%${query.platform.trim()}%`);
  }
  if (query.version?.trim()) {
    where.push("version = ?");
    params.push(query.version.trim());
  }
  if (query.keyword?.trim()) {
    where.push("(file_name LIKE ? OR object_key LIKE ?)");
    const keyword = `%${query.keyword.trim()}%`;
    params.push(keyword, keyword);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM file_records ${whereSql}`, [...params])) as {
    total: number;
  };
  const orderKey = db.dialect === "mysql" ? "id" : "rowid";
  const rows = (await db.query(
    `SELECT * FROM file_records ${whereSql}
       ORDER BY created_at DESC, ${orderKey} DESC
       LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )) as FileRecordRow[];
  const list = rows.map((row) => mapFileRecord(row)).filter((item): item is FileRecordInfo => Boolean(item));
  return buildPaginatedList(list, totalRow.total, offset, limit);
}

export async function findFileRecordDeleteBlockers(id: string): Promise<string[]> {
  const db = getAppDb();
  const row = await readFileRecordRowById(db, id);
  if (!row || row.status === "deleted") return [];
  const refs = parseFileReferences(row.referenced_by);
  return Array.from(
    new Set(
      refs
        .filter((ref) => ref.type === "current-release" || ref.type === "active-desktop-update")
        .map(fileReferenceLabel),
    ),
  );
}

export async function markFileRecordDeleted(id: string): Promise<FileRecordInfo> {
  return await deleteFileRecordAndCleanupReferences(id);
}

export function downloadUrlMatchesFile(downloadUrl: string, fileId: string): boolean {
  const filePath = buildReleaseDownloadPath(fileId);
  return Boolean(downloadUrl) && (downloadUrl === filePath || downloadUrl.includes(filePath));
}

async function clearHistoryFileReferences(db: DbTransaction, fileId: string): Promise<void> {
  const rows = (await db.query("SELECT id, download_url FROM update_history WHERE release_file_id = ?", [fileId])) as Array<{
    id: string;
    download_url: string;
  }>;
  for (const row of rows) {
    await db.execute("UPDATE update_history SET release_file_id = NULL, download_url = ? WHERE id = ?", [
      downloadUrlMatchesFile(row.download_url, fileId) ? "" : row.download_url,
      row.id,
    ]);
  }
}

async function clearCurrentReleaseFileReferences(db: DbTransaction, fileId: string): Promise<void> {
  const now = Date.now();
  const releaseRows = (await db.query("SELECT platform, download_url FROM release_info", [])) as Array<{
    platform: ReleasePlatform;
    download_url: string;
  }>;
  let clearAndroidCurrentUpdate = false;

  for (const row of releaseRows) {
    if (!downloadUrlMatchesFile(row.download_url, fileId)) continue;
    await db.execute(
      `UPDATE release_info
       SET download_url = '', file_size_text = '', available = 0, updated_at = ?
       WHERE platform = ?`,
      [now, row.platform],
    );
    if (row.platform === "android") clearAndroidCurrentUpdate = true;
  }

  const currentUpdate = (await db.queryOne("SELECT download_url FROM current_update WHERE id = 1", [])) as
    | { download_url: string }
    | undefined;
  if (clearAndroidCurrentUpdate || downloadUrlMatchesFile(currentUpdate?.download_url ?? "", fileId)) {
    await db.execute("UPDATE current_update SET download_url = '', updated_at = ? WHERE id = 1", [now]);
  }
}

export async function deleteFileRecordAndCleanupReferencesWithDb(
  db: DbTransaction,
  id: string,
  now = Date.now(),
): Promise<FileRecordInfo> {
  const file = await readFileRecordByIdWithDb(db, id);
  if (!file) throw new Error("文件记录不存在");
  await clearHistoryFileReferences(db, id);
  await clearCurrentReleaseFileReferences(db, id);
  await db.execute("UPDATE file_records SET status = 'deleted', referenced_by = ?, deleted_at = ? WHERE id = ?", [
    serializeFileReferences([]),
    now,
    id,
  ]);
  const deleted = await readFileRecordByIdWithDb(db, id);
  if (!deleted) throw new Error("文件状态更新失败");
  return deleted;
}

export async function deleteFileRecordAndCleanupReferences(id: string): Promise<FileRecordInfo> {
  const db = getAppDb();
  return await db.transaction(async (tx) => await deleteFileRecordAndCleanupReferencesWithDb(tx, id));
}

export async function readReleaseFileForHistory(historyId: string): Promise<ReleaseFileInfo | null> {
  const db = getAppDb();
  const row = (await db.queryOne(
    `SELECT f.*
     FROM update_history h
     JOIN file_records f ON f.id = h.release_file_id
     WHERE h.id = ?`,
    [historyId],
  )) as FileRecordRow | undefined;
  const releaseFile = releaseFileFromRecord(mapFileRecord(row));
  return releaseFile ? { ...releaseFile, historyId } : null;
}

export async function markReleaseFileDeletedForHistory(historyId: string): Promise<ReleaseFileInfo> {
  const file = await readReleaseFileForHistory(historyId);
  if (!file) throw new Error("该发布记录没有可删除的七牛安装包");
  const deleted = await deleteFileRecordAndCleanupReferences(file.id);
  const releaseFile = releaseFileFromRecord(deleted);
  if (!releaseFile) throw new Error("安装包文件状态更新失败");
  return { ...releaseFile, historyId };
}

export function hasFileReference(
  refs: FileRecordReference[],
  type: FileRecordReferenceType,
  predicate: (ref: FileRecordReference) => boolean = () => true,
): boolean {
  return refs.some((ref) => ref.type === type && predicate(ref));
}
