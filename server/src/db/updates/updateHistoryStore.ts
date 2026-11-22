import type { DbTransaction } from "../core/types";
import { getAppDb } from "../appDb";
import {
  DESKTOP_UPDATE_PLATFORM,
  addFileReference,
  createFileRecord,
  deleteFileRecordAndCleanupReferencesWithDb,
  desktopAssetFromRecord,
  hasFileReference,
  mapFileRecord,
  parseFileReferences,
  readFileRecordByIdWithDb,
  readReleaseFileById,
  releaseFileFromRecord,
  removeFileReferences,
  type DesktopUpdateAssetInfo,
  type DesktopUpdateAssetType,
  type FileRecordInfo,
  type FileRecordRow,
  type FileRecordReference,
  type ReleaseFileInfo,
} from "../files/fileRecordStore";
import {
  appUpdateFromRelease,
  boolToDb,
  normalizeRelease,
  readAppConfig,
  replaceCurrentUpdate,
  replaceReleases,
  type AppUpdate,
  type ReleaseInfo,
  type ReleasePlatform,
} from "../system/systemConfigStore";

export type UpdateHistoryItem = {
  id: string;
  platform: ReleasePlatform;
  version: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
  releaseFileId?: string | null;
  releaseFile?: ReleaseFileInfo | null;
};

export type UpdateHistoryDeletionPlan = {
  history: UpdateHistoryItem;
  files: FileRecordInfo[];
};

export async function createReleaseUploadRecord(input: {
  id: string;
  platform: ReleasePlatform;
  version?: string;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<ReleaseFileInfo> {
  const record = await createFileRecord({
    id: input.id,
    usageType: "release-package",
    platform: input.platform,
    version: input.version ?? "",
    assetType: "installer",
    provider: input.provider,
    bucket: input.bucket,
    objectKey: input.objectKey,
    hash: input.hash,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    downloadUrl: "",
  });
  const releaseFile = releaseFileFromRecord(record);
  if (!releaseFile) throw new Error("安装包文件保存失败");
  const desktopUpdateAsset = desktopAssetFromRecord(record);
  return desktopUpdateAsset ? { ...releaseFile, desktopUpdateAsset } : releaseFile;
}

export async function createDesktopUpdateUploadRecord(input: {
  id: string;
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
}): Promise<DesktopUpdateAssetInfo> {
  const record = await createFileRecord({
    id: input.id,
    usageType: "desktop-update",
    platform: `${input.platform}/${input.arch}`,
    version: input.version,
    assetType: input.fileType,
    provider: input.provider,
    bucket: input.bucket,
    objectKey: input.objectKey,
    hash: input.hash,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    downloadUrl: "",
  });
  const asset = desktopAssetFromRecord(record);
  if (!asset) throw new Error("自动更新文件保存失败");
  return asset;
}

export async function readDesktopUpdateAssets(
  version: string,
  platform = "win32",
  arch = "x64",
  db: DbTransaction = getAppDb(),
): Promise<DesktopUpdateAssetInfo[]> {
  const rows = (await db.query(
    `SELECT * FROM file_records
     WHERE version = ?
       AND status = 'uploaded'
       AND asset_type IN ('latest-yml', 'installer', 'blockmap')
       AND (platform = ? OR (asset_type = 'installer' AND platform = 'desktop'))
     ORDER BY created_at DESC`,
    [version, `${platform}/${arch}`],
  )) as FileRecordRow[];
  return rows
    .map((row) => desktopAssetFromRecord(mapFileRecord(row)))
    .filter((asset): asset is DesktopUpdateAssetInfo => Boolean(asset));
}

async function readDesktopUpdateAssetsByIds(
  assetIds: string[],
  db: DbTransaction = getAppDb(),
): Promise<DesktopUpdateAssetInfo[]> {
  const uniqueIds = [...new Set(assetIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const placeholders = uniqueIds.map(() => "?").join(", ");
  const rows = (await db.query(
    `SELECT * FROM file_records
     WHERE id IN (${placeholders})
       AND status = 'uploaded'
       AND asset_type IN ('latest-yml', 'installer', 'blockmap')
     ORDER BY created_at DESC`,
    uniqueIds,
  )) as FileRecordRow[];
  return rows
    .map((row) => desktopAssetFromRecord(mapFileRecord(row)))
    .filter((asset): asset is DesktopUpdateAssetInfo => Boolean(asset));
}

async function syncFileRecordVersionAndDesktopPlatform(
  tx: DbTransaction,
  fileId: string,
  version: string,
  forceDesktopUpdatePlatform: boolean,
): Promise<void> {
  const row = (await tx.queryOne("SELECT id, usage_type, platform, version, asset_type FROM file_records WHERE id = ?", [
    fileId,
  ])) as { id: string; usage_type: string; platform: string; version: string; asset_type: string } | undefined;
  if (!row) return;
  const nextPlatform =
    forceDesktopUpdatePlatform && (row.platform === "desktop" || row.platform === DESKTOP_UPDATE_PLATFORM)
      ? DESKTOP_UPDATE_PLATFORM
      : row.platform;
  const nextUsageType =
    forceDesktopUpdatePlatform && row.asset_type === "installer" ? "desktop-update" : row.usage_type;
  if (row.version !== version || row.platform !== nextPlatform || row.usage_type !== nextUsageType) {
    await tx.execute("UPDATE file_records SET version = ?, platform = ?, usage_type = ? WHERE id = ?", [
      version,
      nextPlatform,
      nextUsageType,
      fileId,
    ]);
  }
}

export async function activateDesktopUpdateVersion(
  version: string,
  platform = "win32",
  arch = "x64",
  assetIds?: string[],
): Promise<DesktopUpdateAssetInfo[]> {
  const db = getAppDb();
  return await db.transaction(async (tx) => {
    const normalizedIds = Array.isArray(assetIds)
      ? [...new Set(assetIds.map((id) => String(id ?? "").trim()).filter(Boolean))]
      : [];
    const assets =
      normalizedIds.length > 0
        ? await readDesktopUpdateAssetsByIds(normalizedIds, tx)
        : await readDesktopUpdateAssets(version, platform, arch, tx);
    if (normalizedIds.length > 0 && assets.length !== normalizedIds.length) {
      throw new Error("部分 PC 自动更新文件不存在或已删除，请重新上传");
    }
    const hasLatest = assets.some((asset) => asset.fileType === "latest-yml" && asset.fileName === "latest.yml");
    const hasInstaller = assets.some((asset) => asset.fileType === "installer");
    if (!hasLatest) throw new Error("缺少 latest.yml，请先上传 electron-builder 生成的 latest.yml");
    if (!hasInstaller) throw new Error("缺少安装包 EXE，请先上传与 latest.yml 对应的 Windows 安装包");
    await removeFileReferences(
      tx,
      (ref, row) =>
        ref.type === "active-desktop-update" &&
        (row.platform === `${platform}/${arch}` || row.platform === "desktop"),
    );
    for (const asset of assets) {
      await syncFileRecordVersionAndDesktopPlatform(tx, asset.id, version, true);
      await addFileReference(tx, asset.id, {
        type: "active-desktop-update",
        platform: "win32",
        version,
        fileName: asset.fileName,
      });
    }
    if (normalizedIds.length > 0) {
      return (await readDesktopUpdateAssetsByIds(normalizedIds, tx)).map((asset) => ({ ...asset, active: true }));
    }
    return (await readDesktopUpdateAssets(version, platform, arch, tx)).map((asset) => ({ ...asset, active: true }));
  });
}

export async function readActiveDesktopUpdateAsset(
  fileName: string,
  platform = "win32",
  arch = "x64",
): Promise<DesktopUpdateAssetInfo | null> {
  const db = getAppDb();
  const rows = (await db.query(
    `SELECT * FROM file_records
     WHERE status = 'uploaded'
       AND file_name = ?
       AND asset_type IN ('latest-yml', 'installer', 'blockmap')
       AND (platform = ? OR (asset_type = 'installer' AND platform = 'desktop'))
       AND referenced_by LIKE '%active-desktop-update%'
     ORDER BY created_at DESC`,
    [fileName, `${platform}/${arch}`],
  )) as FileRecordRow[];
  for (const row of rows) {
    const refs = parseFileReferences(row.referenced_by);
    if (hasFileReference(refs, "active-desktop-update", (ref: FileRecordReference) => !ref.platform || ref.platform === "win32")) {
      return desktopAssetFromRecord(mapFileRecord(row));
    }
  }
  return null;
}

export async function findDesktopInstallerForVersion(version: string): Promise<ReleaseFileInfo | null> {
  const assets = await readDesktopUpdateAssets(version, "win32", "x64");
  const installer = assets.find((asset) => asset.fileType === "installer");
  return installer ? await readReleaseFileById(installer.id) : null;
}

export async function publishUpdate(
  update: AppUpdate,
  historyId: string,
  platform: ReleasePlatform = "android",
  releaseFileId?: string | null,
): Promise<UpdateHistoryItem> {
  const db = getAppDb();
  const current = await readAppConfig();
  const initialRelease = normalizeRelease(platform, update, platform === "android" ? update : undefined);
  const releaseFile = releaseFileId
    ? await readReleaseFileById(releaseFileId)
    : platform === "desktop" && initialRelease.available
      ? await findDesktopInstallerForVersion(initialRelease.latestVersion)
      : null;
  if (releaseFileId && !releaseFile) throw new Error("安装包文件不存在");
  if (releaseFile && releaseFile.status !== "uploaded") throw new Error("安装包文件已删除");
  if (releaseFile && releaseFile.platform !== platform) throw new Error("安装包文件平台不匹配");
  const release = releaseFile
    ? normalizeRelease(
        platform,
        { ...update, downloadUrl: releaseFile.downloadUrl },
        platform === "android" ? { ...update, downloadUrl: releaseFile.downloadUrl } : undefined,
      )
    : initialRelease;
  const item: UpdateHistoryItem = {
    id: historyId,
    platform,
    version: release.latestVersion,
    updateTime: release.updateTime,
    forceUpdate: release.forceUpdate,
    downloadUrl: release.downloadUrl,
    officialUrl: release.officialUrl,
    updateContent: release.updateContent,
    releaseFileId: releaseFile?.id ?? null,
    releaseFile: releaseFile ? { ...releaseFile, historyId } : null,
  };
  await db.transaction(async (tx) => {
    if (platform === "android") {
      await replaceCurrentUpdate(tx, appUpdateFromRelease(release));
    }
    await replaceReleases(tx, {
      android: platform === "android" ? release : current.releases.android,
      desktop: platform === "desktop" ? release : current.releases.desktop,
    });
    await insertUpdateHistory(tx, item);
    await removeFileReferences(tx, (ref) => ref.type === "current-release" && ref.platform === platform);
    if (releaseFile) {
      await syncFileRecordVersionAndDesktopPlatform(tx, releaseFile.id, release.latestVersion, platform === "desktop");
      await addFileReference(tx, releaseFile.id, {
        type: "history",
        id: historyId,
        platform,
        version: release.latestVersion,
      });
      await addFileReference(tx, releaseFile.id, {
        type: "current-release",
        platform,
        version: release.latestVersion,
      });
    }
  });
  return item;
}

function releaseMatchesHistory(release: ReleaseInfo, item: UpdateHistoryItem): boolean {
  return (
    release.latestVersion === item.version &&
    release.updateTime === item.updateTime &&
    release.forceUpdate === item.forceUpdate &&
    release.downloadUrl === item.downloadUrl &&
    release.officialUrl === item.officialUrl &&
    release.updateContent === item.updateContent
  );
}

export async function updatePublishedUpdate(
  historyId: string,
  update: AppUpdate,
  platform: ReleasePlatform = "android",
  releaseFileId?: string | null,
): Promise<UpdateHistoryItem> {
  const db = getAppDb();
  const current = await readAppConfig();
  const existing = (await readUpdateHistory()).find((item) => item.id === historyId);
  if (!existing) throw new Error("发布记录不存在");
  if (existing.platform !== platform) throw new Error("发布记录平台不能修改");

  const releaseFile = releaseFileId ? await readReleaseFileById(releaseFileId) : null;
  if (releaseFileId && !releaseFile) throw new Error("安装包文件不存在");
  if (releaseFile && releaseFile.status !== "uploaded") throw new Error("安装包文件已删除");
  if (releaseFile && releaseFile.platform !== platform) throw new Error("安装包文件平台不匹配");

  const initialRelease = normalizeRelease(platform, update, platform === "android" ? update : undefined);
  const release = releaseFile
    ? normalizeRelease(
        platform,
        { ...update, downloadUrl: releaseFile.downloadUrl },
        platform === "android" ? { ...update, downloadUrl: releaseFile.downloadUrl } : undefined,
      )
    : initialRelease;
  const shouldSyncCurrent = releaseMatchesHistory(current.releases[platform], existing);
  const currentRelease =
    shouldSyncCurrent && !release.fileSizeText
      ? { ...release, fileSizeText: current.releases[platform].fileSizeText }
      : release;

  await db.transaction(async (tx) => {
    await tx.execute(
      `UPDATE update_history
       SET version = ?, update_time = ?, force_update = ?, download_url = ?, official_url = ?, update_content = ?, release_file_id = ?
       WHERE id = ?`,
      [
        release.latestVersion,
        release.updateTime,
        boolToDb(release.forceUpdate),
        release.downloadUrl,
        release.officialUrl,
        release.updateContent,
        releaseFile?.id ?? null,
        historyId,
      ],
    );

    await removeFileReferences(tx, (ref) => ref.type === "history" && ref.id === historyId);
    if (releaseFile) {
      await syncFileRecordVersionAndDesktopPlatform(tx, releaseFile.id, release.latestVersion, platform === "desktop");
      await addFileReference(tx, releaseFile.id, {
        type: "history",
        id: historyId,
        platform,
        version: release.latestVersion,
      });
    }

    if (shouldSyncCurrent) {
      if (platform === "android") {
        await replaceCurrentUpdate(tx, appUpdateFromRelease(currentRelease));
      }
      await replaceReleases(tx, {
        android: platform === "android" ? currentRelease : current.releases.android,
        desktop: platform === "desktop" ? currentRelease : current.releases.desktop,
      });
      await removeFileReferences(tx, (ref) => ref.type === "current-release" && ref.platform === platform);
      if (releaseFile) {
        await addFileReference(tx, releaseFile.id, {
          type: "current-release",
          platform,
          version: release.latestVersion,
        });
      }
    }
  });

  const updated = (await readUpdateHistory()).find((item) => item.id === historyId);
  if (!updated) throw new Error("发布记录更新失败");
  return updated;
}

function findLatestHistoryForPlatform(items: UpdateHistoryItem[], platform: ReleasePlatform): UpdateHistoryItem | null {
  const samePlatform = items.filter((item) => item.platform === platform);
  return samePlatform[samePlatform.length - 1] ?? null;
}

async function readFilesForHistoryDeletion(history: UpdateHistoryItem): Promise<FileRecordInfo[]> {
  const db = getAppDb();
  const ids = new Set<string>();
  if (history.releaseFileId) ids.add(history.releaseFileId);

  if (history.platform === "desktop") {
    const rows = (await db.query(
      `SELECT id
       FROM file_records
       WHERE version = ?
         AND status = 'uploaded'
         AND asset_type IN ('latest-yml', 'installer', 'blockmap')
         AND platform IN ('desktop', ?)`,
      [history.version, DESKTOP_UPDATE_PLATFORM],
    )) as Array<{ id: string }>;
    for (const row of rows) ids.add(row.id);
  }

  return (await Promise.all([...ids].map((id) => readFileRecordByIdWithDb(db, id)))).filter(
    (file): file is FileRecordInfo => Boolean(file && file.status === "uploaded"),
  );
}

export async function prepareUpdateHistoryDeletion(
  historyId: string,
): Promise<{ ok: true; plan: UpdateHistoryDeletionPlan } | { ok: false; reason: "NOT_FOUND" | "LATEST_NOT_DELETABLE" }> {
  const history = await readUpdateHistory();
  const target = history.find((item) => item.id === historyId);
  if (!target) return { ok: false, reason: "NOT_FOUND" };
  if (findLatestHistoryForPlatform(history, target.platform)?.id === target.id) {
    return { ok: false, reason: "LATEST_NOT_DELETABLE" };
  }
  return {
    ok: true,
    plan: {
      history: target,
      files: await readFilesForHistoryDeletion(target),
    },
  };
}

export async function completeUpdateHistoryDeletion(historyId: string, fileIds: string[]): Promise<FileRecordInfo[]> {
  const db = getAppDb();
  return await db.transaction(async (tx) => {
    const history = await readUpdateHistory(tx);
    const target = history.find((item) => item.id === historyId);
    if (!target) throw new Error("发布记录不存在");
    if (findLatestHistoryForPlatform(history, target.platform)?.id === target.id) {
      throw new Error("当前最新版本不可删除");
    }

    const now = Date.now();
    const deletedFiles: FileRecordInfo[] = [];
    for (const fileId of new Set(fileIds)) {
      const file = await readFileRecordByIdWithDb(tx, fileId);
      if (!file || file.status === "deleted") continue;
      deletedFiles.push(await deleteFileRecordAndCleanupReferencesWithDb(tx, fileId, now));
    }
    await removeFileReferences(tx, (ref) => ref.type === "history" && ref.id === historyId);
    await tx.execute("UPDATE update_history SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL", [now, historyId]);
    return deletedFiles;
  });
}

export async function insertUpdateHistory(db: DbTransaction, item: UpdateHistoryItem, createdAt = Date.now()): Promise<void> {
  await db.execute(
    db.dialect === "mysql"
      ? `INSERT INTO update_history (
          id, platform, version, update_time, force_update, download_url, official_url, update_content, release_file_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`
      : `INSERT OR IGNORE INTO update_history (
          id, platform, version, update_time, force_update, download_url, official_url, update_content, release_file_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.platform,
      item.version,
      item.updateTime,
      boolToDb(item.forceUpdate),
      item.downloadUrl,
      item.officialUrl,
      item.updateContent,
      item.releaseFileId ?? null,
      createdAt,
    ],
  );
}

export async function readUpdateHistory(db: DbTransaction = getAppDb()): Promise<UpdateHistoryItem[]> {
  const rows = (await db.query(
    db.dialect === "mysql"
      ? `SELECT h.*, f.id AS file_id, f.usage_type, f.owner_type, f.owner_user_id, f.owner_snapshot_json,
          f.platform AS file_platform, f.version AS file_version,
          f.asset_type, f.provider, f.bucket, f.object_key, f.hash, f.file_name, f.mime_type,
          f.file_size, f.download_url AS file_download_url, f.status, f.referenced_by, f.created_at AS file_created_at,
          f.deleted_at AS file_deleted_at
         FROM update_history h
         LEFT JOIN file_records f ON f.id = h.release_file_id
         WHERE h.deleted_at IS NULL
         ORDER BY h.created_at ASC, h.id ASC`
      : `SELECT h.*, f.id AS file_id, f.usage_type, f.owner_type, f.owner_user_id, f.owner_snapshot_json,
          f.platform AS file_platform, f.version AS file_version,
          f.asset_type, f.provider, f.bucket, f.object_key, f.hash, f.file_name, f.mime_type,
          f.file_size, f.download_url AS file_download_url, f.status, f.referenced_by, f.created_at AS file_created_at,
          f.deleted_at AS file_deleted_at
         FROM update_history h
         LEFT JOIN file_records f ON f.id = h.release_file_id
         WHERE h.deleted_at IS NULL
         ORDER BY h.created_at ASC, h.rowid ASC`,
    [],
  )) as Array<{
    id: string;
    platform?: ReleasePlatform;
    version: string;
    update_time: string;
    force_update: number;
    download_url: string;
    official_url: string;
    update_content: string;
    release_file_id: string | null;
    file_id: string | null;
    usage_type: string | null;
    owner_type: string | null;
    owner_user_id: string | null;
    owner_snapshot_json: string | null;
    file_platform: string | null;
    file_version: string | null;
    asset_type: string | null;
    provider: string | null;
    bucket: string | null;
    object_key: string | null;
    hash: string | null;
    file_name: string | null;
    mime_type: string | null;
    file_size: number | null;
    file_download_url: string | null;
    status: string | null;
    referenced_by: string | null;
    file_created_at: number | null;
    file_deleted_at: number | null;
  }>;

  return rows.map((row) => {
    const platform: ReleasePlatform = row.platform === "desktop" ? "desktop" : "android";
    const releaseFile: ReleaseFileInfo | null =
      row.file_id && row.provider && row.bucket && row.object_key && row.file_name && row.mime_type
        ? releaseFileFromRecord(
            mapFileRecord({
              id: row.file_id,
              usage_type: row.usage_type ?? "release-package",
              owner_type: row.owner_type ?? "system",
              owner_user_id: row.owner_user_id ?? null,
              owner_snapshot_json: row.owner_snapshot_json ?? "{}",
              platform: row.file_platform ?? platform,
              version: row.file_version ?? row.version,
              asset_type: row.asset_type ?? "installer",
              provider: row.provider,
              bucket: row.bucket,
              object_key: row.object_key,
              hash: row.hash ?? "",
              file_name: row.file_name,
              mime_type: row.mime_type,
              file_size: row.file_size ?? 0,
              download_url: row.file_download_url ?? "",
              status: row.status ?? "uploaded",
              referenced_by: row.referenced_by ?? "[]",
              created_at: row.file_created_at ?? 0,
              deleted_at: row.file_deleted_at ?? null,
            }),
          )
        : null;

    return {
      id: row.id,
      platform,
      version: row.version,
      updateTime: row.update_time,
      forceUpdate: Boolean(row.force_update),
      downloadUrl: row.download_url,
      officialUrl: row.official_url,
      updateContent: row.update_content,
      releaseFileId: row.release_file_id ?? null,
      releaseFile: releaseFile ? { ...releaseFile, historyId: row.id } : null,
    };
  });
}
