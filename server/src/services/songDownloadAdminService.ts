import { configManager } from "../config/configManager";
import {
  getAdminQuotaStateDetail,
  queryQuotaStates,
  querySongDownloadOverview,
  querySongDownloadRecords,
  queryTopDownloadedSongs,
  upsertQuotaStateOverride,
  type AdminQuotaStateItem,
} from "../db/songDownloadAdminStore";
import { getDefaultQuotaLimits, type QuotaLimits, type SongDownloadSubjectType } from "../db/songDownloadStore";
import { SongDownloadValidationError } from "./songDownloadService";

function parseDays(raw: unknown, allowAll = false): number | "all" {
  if (allowAll && raw === "all") return "all";
  const num = Number(raw ?? 7);
  if (num === 7 || num === 30 || num === 90) return num;
  throw new SongDownloadValidationError("days 参数仅支持 7、30、90" + (allowAll ? " 或 all" : ""));
}

function parsePagination(offsetRaw: unknown, limitRaw: unknown, defaultLimit = 20): { offset: number; limit: number } {
  const offset = Math.max(0, Math.trunc(Number(offsetRaw ?? 0) || 0));
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(limitRaw ?? defaultLimit) || defaultLimit)));
  return { offset, limit };
}

function parseNullableLimit(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 100000000) {
    throw new SongDownloadValidationError(`${fieldName} 必须为 null（不限制）或 0~100000000 的整数`);
  }
  return value;
}

function parseSubjectType(raw: unknown): SongDownloadSubjectType {
  if (raw === "user" || raw === "device") return raw;
  throw new SongDownloadValidationError("subjectType 必须是 user 或 device");
}

function parseSubjectKey(raw: unknown): string {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key || key.length > 191) {
    throw new SongDownloadValidationError("subjectKey 不能为空且不超过 191 字符");
  }
  return key;
}

export async function getAdminSongDownloadOverview(daysRaw: unknown) {
  const days = parseDays(daysRaw, false) as number;
  return querySongDownloadOverview(days);
}

export async function getAdminTopDownloadedSongs(query: Record<string, unknown>) {
  const days = parseDays(query.days ?? 30, true);
  const source = typeof query.source === "string" && ["all", "kg", "wy", "kw", "cloud"].includes(query.source)
    ? query.source
    : "all";
  const { offset, limit } = parsePagination(query.offset, query.limit, 20);
  return queryTopDownloadedSongs({ days, source, offset, limit });
}

export async function getAdminSongDownloadRecords(query: Record<string, unknown>) {
  const { offset, limit } = parsePagination(query.offset, query.limit, 20);
  const keyword = typeof query.keyword === "string" ? query.keyword.trim() : "";
  const source = typeof query.source === "string" && ["all", "kg", "wy", "kw", "cloud"].includes(query.source)
    ? query.source
    : "all";
  const platform = typeof query.platform === "string" && ["all", "android", "desktop"].includes(query.platform)
    ? query.platform
    : "all";
  const subjectType = typeof query.subjectType === "string" && ["all", "user", "device"].includes(query.subjectType)
    ? query.subjectType
    : "all";
  const userId = typeof query.userId === "string" ? query.userId.trim() : "";
  const deviceId = typeof query.deviceId === "string" ? query.deviceId.trim() : "";
  const startDay = typeof query.startDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.startDay) ? query.startDay : "";
  const endDay = typeof query.endDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.endDay) ? query.endDay : "";

  return querySongDownloadRecords({
    keyword,
    source,
    platform,
    subjectType,
    userId,
    deviceId,
    startDay,
    endDay,
    offset,
    limit,
  });
}

export async function getAdminQuotaStates(query: Record<string, unknown>) {
  const { offset, limit } = parsePagination(query.offset, query.limit, 20);
  const subjectType = typeof query.subjectType === "string" && ["all", "user", "device"].includes(query.subjectType)
    ? query.subjectType
    : "all";
  const keyword = typeof query.keyword === "string" ? query.keyword.trim() : "";
  return queryQuotaStates({ subjectType, keyword, offset, limit });
}

export async function getAdminSubjectQuotaDetail(subjectTypeRaw: unknown, subjectKeyRaw: unknown): Promise<AdminQuotaStateItem> {
  return getAdminQuotaStateDetail(parseSubjectType(subjectTypeRaw), parseSubjectKey(subjectKeyRaw));
}

export async function saveAdminSubjectQuotaOverride(
  subjectTypeRaw: unknown,
  subjectKeyRaw: unknown,
  body: unknown,
): Promise<AdminQuotaStateItem> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SongDownloadValidationError("请求体必须是对象");
  }
  const obj = body as Record<string, unknown>;
  if (typeof obj.overrideEnabled !== "boolean") {
    throw new SongDownloadValidationError("overrideEnabled 必须是布尔值");
  }
  const subjectType = parseSubjectType(subjectTypeRaw);
  const subjectKey = parseSubjectKey(subjectKeyRaw);

  const dailyLimit = obj.overrideEnabled ? parseNullableLimit(obj.dailyLimit, "dailyLimit") : null;
  const weeklyLimit = obj.overrideEnabled ? parseNullableLimit(obj.weeklyLimit, "weeklyLimit") : null;
  const monthlyLimit = obj.overrideEnabled ? parseNullableLimit(obj.monthlyLimit, "monthlyLimit") : null;
  const totalLimit = obj.overrideEnabled ? parseNullableLimit(obj.totalLimit, "totalLimit") : null;

  return upsertQuotaStateOverride({
    subjectType,
    subjectKey,
    overrideEnabled: obj.overrideEnabled,
    dailyLimit,
    weeklyLimit,
    monthlyLimit,
    totalLimit,
    resetDayUsed: obj.resetDayUsed === true,
    resetWeekUsed: obj.resetWeekUsed === true,
    resetMonthUsed: obj.resetMonthUsed === true,
    resetTotalUsed: obj.resetTotalUsed === true,
  });
}

export function getAdminDefaultQuotaLimits(): QuotaLimits {
  return getDefaultQuotaLimits();
}

export async function saveAdminDefaultQuotaLimits(body: unknown): Promise<QuotaLimits> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SongDownloadValidationError("请求体必须是对象");
  }
  const obj = body as Record<string, unknown>;
  const daily = parseNullableLimit(obj.daily, "daily");
  const weekly = parseNullableLimit(obj.weekly, "weekly");
  const monthly = parseNullableLimit(obj.monthly, "monthly");
  const total = parseNullableLimit(obj.total, "total");

  await configManager.setMany([
    { key: "songDownload.defaultDailyLimit", value: daily === null ? -1 : daily },
    { key: "songDownload.defaultWeeklyLimit", value: weekly === null ? -1 : weekly },
    { key: "songDownload.defaultMonthlyLimit", value: monthly === null ? -1 : monthly },
    { key: "songDownload.defaultTotalLimit", value: total === null ? -1 : total },
  ]);

  return getDefaultQuotaLimits();
}
