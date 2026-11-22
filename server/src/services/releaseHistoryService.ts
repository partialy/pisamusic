import type { PaginatedListData } from "../types/response";
import { buildPaginatedList } from "../utils/pagination";
import {
  readAppConfig,
  type ReleaseInfo,
  type ReleasePlatform,
} from "../db/system/systemConfigStore";
import {
  findLatestUpdateHistoryByPlatform,
  findUpdateHistoryByVersion,
  normalizeReleaseVersionKey,
  queryUpdateHistoryPage,
  readAllActiveUpdateHistoryForExport,
  readLatestHistoryIdsByPlatform,
  type UpdateHistoryQueryItem,
} from "../db/updates/updateHistoryQueryStore";

export type PaginatedListResult<T> = PaginatedListData<T>;

export type PublicReleaseFileSummary = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  status: "uploaded" | "deleted";
};

export type PublicReleaseHistoryItem = {
  id: string;
  platform: ReleasePlatform;
  platformLabel: string;
  version: string;
  updateTime: string;
  createdAt: number;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
  fileSizeText: string;
  available: boolean;
  isCurrent: boolean;
  releaseFile: PublicReleaseFileSummary | null;
};

export type AdminUpdateHistoryPageItem = UpdateHistoryQueryItem & {
  isCurrent: boolean;
};

export class ReleaseQueryValidationError extends Error {}
export class ReleaseNotFoundError extends Error {}

function parsePositiveInt(
  raw: unknown,
  defaultValue: number,
  min: number,
  max: number,
  fieldName: string,
): number {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return defaultValue;
  }
  const num = Number(raw);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new ReleaseQueryValidationError(`${fieldName} 必须是 ${min} 到 ${max} 之间的整数`);
  }
  return num;
}

function normalizePlatformFilter(raw: unknown): ReleasePlatform | undefined {
  const value = String(raw ?? "all").trim().toLowerCase();
  if (!value || value === "all") return undefined;
  if (value === "android") return "android";
  if (value === "pc" || value === "desktop") return "desktop";
  throw new ReleaseQueryValidationError("platform 仅支持 all、pc、desktop 或 android");
}

function normalizeRequiredPlatform(raw: unknown): ReleasePlatform {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "android") return "android";
  if (value === "pc" || value === "desktop") return "desktop";
  throw new ReleaseQueryValidationError("platform 不能为空且仅支持 pc、desktop 或 android");
}

function formatFileSizeText(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)}MB`;
  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

function defaultPlatformLabel(platform: ReleasePlatform): string {
  return platform === "desktop" ? "PC 版" : "Android";
}

function toPublicReleaseItem(
  item: UpdateHistoryQueryItem,
  currentRelease: ReleaseInfo,
  isCurrent: boolean,
  toAbsoluteUrl: (url: string) => string,
): PublicReleaseHistoryItem {
  const fileAvailable = !item.releaseFile || item.releaseFile.status === "uploaded";
  const resolvedDownloadUrl = fileAvailable && item.downloadUrl ? toAbsoluteUrl(item.downloadUrl) : "";
  const fileSizeText =
    (isCurrent ? currentRelease.fileSizeText : "") ||
    (item.releaseFile ? formatFileSizeText(item.releaseFile.fileSize) : "");

  return {
    id: item.id,
    platform: item.platform,
    platformLabel:
      (isCurrent ? currentRelease.platformLabel : "") || defaultPlatformLabel(item.platform),
    version: item.version,
    updateTime: item.updateTime,
    createdAt: item.createdAt,
    forceUpdate: item.forceUpdate,
    downloadUrl: resolvedDownloadUrl,
    officialUrl: item.officialUrl,
    updateContent: item.updateContent,
    fileSizeText,
    available: Boolean(resolvedDownloadUrl),
    isCurrent,
    releaseFile: item.releaseFile
      ? {
          id: item.releaseFile.id,
          fileName: item.releaseFile.fileName,
          fileSize: item.releaseFile.fileSize,
          mimeType: item.releaseFile.mimeType,
          downloadUrl:
            item.releaseFile.status === "uploaded"
              ? toAbsoluteUrl(item.releaseFile.downloadUrl)
              : "",
          status: item.releaseFile.status,
        }
      : null,
  };
}

function matchesCurrentRelease(
  item: UpdateHistoryQueryItem,
  currentRelease: ReleaseInfo,
  latestHistoryId?: string,
): boolean {
  if (latestHistoryId && item.id === latestHistoryId) return true;
  return (
    currentRelease.latestVersion === item.version &&
    currentRelease.updateTime === item.updateTime &&
    currentRelease.forceUpdate === item.forceUpdate &&
    currentRelease.downloadUrl === item.downloadUrl &&
    currentRelease.officialUrl === item.officialUrl &&
    currentRelease.updateContent === item.updateContent
  );
}

export async function getPublicReleaseHistoryPage(
  query: Record<string, unknown>,
  toAbsoluteUrl: (url: string) => string,
): Promise<PaginatedListResult<PublicReleaseHistoryItem>> {
  const platform = normalizePlatformFilter(query.platform);
  const offset = parsePositiveInt(query.offset, 0, 0, 1000000, "offset");
  const limit = parsePositiveInt(query.limit, 10, 1, 50, "limit");

  const [{ items, total }, appConfig, latestIds] = await Promise.all([
    queryUpdateHistoryPage({ platform, offset, limit }),
    readAppConfig(),
    readLatestHistoryIdsByPlatform(),
  ]);

  const list = items.map((item) => {
    const currentRelease = appConfig.releases[item.platform];
    const isCurrent = matchesCurrentRelease(item, currentRelease, latestIds[item.platform]);
    return toPublicReleaseItem(item, currentRelease, isCurrent, toAbsoluteUrl);
  });

  return buildPaginatedList(list, total, offset, limit);
}

export async function getPublicReleaseDetail(
  query: Record<string, unknown>,
  toAbsoluteUrl: (url: string) => string,
): Promise<PublicReleaseHistoryItem> {
  const platform = normalizeRequiredPlatform(query.platform);
  const rawVersion = String(query.version ?? "").trim();
  if (!rawVersion) {
    throw new ReleaseQueryValidationError("version 不能为空");
  }

  const appConfig = await readAppConfig();
  const currentRelease = appConfig.releases[platform];

  if (rawVersion.toLowerCase() === "latest") {
    const latestHistory = await findLatestUpdateHistoryByPlatform(platform);
    if (!latestHistory) {
      throw new ReleaseNotFoundError("该平台暂无已发布版本记录");
    }
    const useCurrentConfig =
      normalizeReleaseVersionKey(currentRelease.latestVersion) ===
      normalizeReleaseVersionKey(latestHistory.version);
    const merged: UpdateHistoryQueryItem = useCurrentConfig
      ? {
          ...latestHistory,
          version: currentRelease.latestVersion || latestHistory.version,
          updateTime: currentRelease.updateTime || latestHistory.updateTime,
          forceUpdate: currentRelease.forceUpdate,
          downloadUrl: currentRelease.downloadUrl || latestHistory.downloadUrl,
          officialUrl: currentRelease.officialUrl || latestHistory.officialUrl,
          updateContent: currentRelease.updateContent || latestHistory.updateContent,
        }
      : latestHistory;
    return toPublicReleaseItem(merged, currentRelease, true, toAbsoluteUrl);
  }

  const matched = await findUpdateHistoryByVersion(platform, rawVersion);
  if (!matched) {
    throw new ReleaseNotFoundError("未找到指定版本信息");
  }
  const latestIds = await readLatestHistoryIdsByPlatform();
  const isCurrent = matchesCurrentRelease(matched, currentRelease, latestIds[platform]);
  return toPublicReleaseItem(matched, currentRelease, isCurrent, toAbsoluteUrl);
}

export async function getAdminUpdateHistoryPage(
  query: Record<string, unknown>,
): Promise<PaginatedListResult<AdminUpdateHistoryPageItem>> {
  const platform = normalizePlatformFilter(query.platform);
  const offset = parsePositiveInt(query.offset, 0, 0, 1000000, "offset");
  const limit = parsePositiveInt(query.limit, 15, 1, 100, "limit");

  const [{ items, total }, appConfig, latestIds] = await Promise.all([
    queryUpdateHistoryPage({ platform, offset, limit }),
    readAppConfig(),
    readLatestHistoryIdsByPlatform(),
  ]);

  const list: AdminUpdateHistoryPageItem[] = items.map((item) => ({
    ...item,
    isCurrent: matchesCurrentRelease(item, appConfig.releases[item.platform], latestIds[item.platform]),
  }));

  return buildPaginatedList(list, total, offset, limit);
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportAdminUpdateHistory(formatRaw: unknown): Promise<{
  format: "json" | "csv";
  fileName: string;
  mimeType: string;
  content: string;
}> {
  const formatText = String(formatRaw ?? "json").trim().toLowerCase();
  if (formatText !== "json" && formatText !== "csv") {
    throw new ReleaseQueryValidationError("format 仅支持 json 或 csv");
  }

  const [items, appConfig, latestIds] = await Promise.all([
    readAllActiveUpdateHistoryForExport(),
    readAppConfig(),
    readLatestHistoryIdsByPlatform(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const records = items.map((item) => {
    const currentRelease = appConfig.releases[item.platform];
    const isCurrent = matchesCurrentRelease(item, currentRelease, latestIds[item.platform]);
    return {
      id: item.id,
      platform: item.platform,
      platformLabel: defaultPlatformLabel(item.platform),
      version: item.version,
      isCurrent,
      forceUpdate: item.forceUpdate,
      updateTime: item.updateTime,
      createdAt: item.createdAt,
      downloadUrl: item.downloadUrl,
      officialUrl: item.officialUrl,
      updateContent: item.updateContent,
      releaseFileId: item.releaseFileId ?? null,
      fileName: item.releaseFile?.fileName ?? "",
      fileSize: item.releaseFile?.fileSize ?? 0,
      fileStatus: item.releaseFile?.status ?? (item.downloadUrl ? "external" : "none"),
    };
  });

  if (formatText === "json") {
    return {
      format: "json",
      fileName: `发行记录-${today}.json`,
      mimeType: "application/json;charset=utf-8",
      content: JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          total: records.length,
          list: records,
        },
        null,
        2,
      ),
    };
  }

  const headers = [
    "记录ID",
    "平台",
    "版本状态",
    "版本号",
    "强制更新",
    "发布时间",
    "更新日志",
    "下载地址",
    "官网地址",
    "安装包文件名",
    "安装包大小(字节)",
    "安装包状态",
  ];
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const r of records) {
    lines.push(
      [
        r.id,
        r.platformLabel,
        r.isCurrent ? "当前版本" : "历史版本",
        r.version,
        r.forceUpdate ? "是" : "否",
        r.updateTime,
        r.updateContent,
        r.downloadUrl,
        r.officialUrl,
        r.fileName,
        r.fileSize,
        r.fileStatus,
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  return {
    format: "csv",
    fileName: `发行记录-${today}.csv`,
    mimeType: "text/csv;charset=utf-8",
    content: `\ufeff${lines.join("\r\n")}`,
  };
}
