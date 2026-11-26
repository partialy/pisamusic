import { configManager } from "../config/configManager";
import {
  batchUpsertQuotaStateOverride,
  getAdminQuotaStateDetail,
  queryQuotaStates,
  querySongDownloadOverview,
  querySongDownloadRecords,
  queryTopDownloadedSongs,
  upsertQuotaStateOverride,
  type AdminQuotaStateItem,
} from "../db/songDownloadAdminStore";
import {
  getDefaultQuotaLimits,
  getGuestQuotaLimits,
  getRegisterGiftExtraCount,
  getStandardQuotaLimits,
  listVipTiers,
  saveVipTiers,
  type QuotaLimits,
  type SongDownloadSubjectType,
  type VipTierConfig,
} from "../db/songDownloadStore";
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

function parseExtraOptionalInt(value: unknown, fieldName: string, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new SongDownloadValidationError(`${fieldName} 必须为 ${min}~${max} 的整数`);
  }
  return value;
}

function parseQuotaOverrideFields(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SongDownloadValidationError("请求体必须是对象");
  }
  const obj = body as Record<string, unknown>;
  if (typeof obj.overrideEnabled !== "boolean") {
    throw new SongDownloadValidationError("overrideEnabled 必须是布尔值");
  }
  const extraBalance = parseExtraOptionalInt(obj.extraBalance, "extraBalance", 0, 100000000);
  const extraDelta = parseExtraOptionalInt(obj.extraDelta, "extraDelta", -100000000, 100000000);
  return {
    obj,
    patch: {
      overrideEnabled: obj.overrideEnabled,
      dailyLimit: obj.overrideEnabled ? parseNullableLimit(obj.dailyLimit, "dailyLimit") : null,
      weeklyLimit: obj.overrideEnabled ? parseNullableLimit(obj.weeklyLimit, "weeklyLimit") : null,
      monthlyLimit: obj.overrideEnabled ? parseNullableLimit(obj.monthlyLimit, "monthlyLimit") : null,
      totalLimit: obj.overrideEnabled ? parseNullableLimit(obj.totalLimit, "totalLimit") : null,
      extraBalance,
      extraDelta,
      resetDayUsed: obj.resetDayUsed === true,
      resetWeekUsed: obj.resetWeekUsed === true,
      resetMonthUsed: obj.resetMonthUsed === true,
      resetTotalUsed: obj.resetTotalUsed === true,
    },
  };
}

export async function saveAdminSubjectQuotaOverride(
  subjectTypeRaw: unknown,
  subjectKeyRaw: unknown,
  body: unknown,
): Promise<AdminQuotaStateItem> {
  const subjectType = parseSubjectType(subjectTypeRaw);
  const subjectKey = parseSubjectKey(subjectKeyRaw);
  const { patch } = parseQuotaOverrideFields(body);
  return upsertQuotaStateOverride({ subjectType, subjectKey, ...patch });
}

export async function saveAdminBatchSubjectQuotaOverride(
  body: unknown,
): Promise<{ updatedCount: number }> {
  const { obj, patch } = parseQuotaOverrideFields(body);
  if (!Array.isArray(obj.targets) || obj.targets.length === 0 || obj.targets.length > 500) {
    throw new SongDownloadValidationError("targets 必须包含 1 到 500 个配置主体");
  }
  const deduped = new Map<string, { subjectType: SongDownloadSubjectType; subjectKey: string }>();
  for (let i = 0; i < obj.targets.length; i++) {
    const raw = obj.targets[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new SongDownloadValidationError(`targets[${i}] 必须是对象`);
    }
    const item = raw as Record<string, unknown>;
    const subjectType = parseSubjectType(item.subjectType);
    const subjectKey = parseSubjectKey(item.subjectKey);
    deduped.set(`${subjectType}:${subjectKey}`, { subjectType, subjectKey });
  }
  return batchUpsertQuotaStateOverride([...deduped.values()], patch);
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
    { key: "songDownload.guestDailyLimit", value: daily === null ? -1 : daily },
    { key: "songDownload.guestWeeklyLimit", value: weekly === null ? -1 : weekly },
    { key: "songDownload.guestMonthlyLimit", value: monthly === null ? -1 : monthly },
    { key: "songDownload.guestTotalLimit", value: total === null ? -1 : total },
  ]);

  return getDefaultQuotaLimits();
}

export type AdminTierPoliciesPayload = {
  guest: QuotaLimits;
  standard: QuotaLimits;
  registerGiftExtraCount: number;
  vipTiers: VipTierConfig[];
};

export async function getAdminTierPolicies(): Promise<AdminTierPoliciesPayload> {
  return {
    guest: getGuestQuotaLimits(),
    standard: getStandardQuotaLimits(),
    registerGiftExtraCount: getRegisterGiftExtraCount(),
    vipTiers: await listVipTiers(),
  };
}

export async function saveAdminTierPolicies(body: unknown): Promise<AdminTierPoliciesPayload> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SongDownloadValidationError("请求体必须是对象");
  }
  const obj = body as Record<string, unknown>;
  if (!obj.guest || typeof obj.guest !== "object" || Array.isArray(obj.guest)) {
    throw new SongDownloadValidationError("guest 配额配置不正确");
  }
  if (!obj.standard || typeof obj.standard !== "object" || Array.isArray(obj.standard)) {
    throw new SongDownloadValidationError("standard 配额配置不正确");
  }

  const g = obj.guest as Record<string, unknown>;
  const s = obj.standard as Record<string, unknown>;

  const guestDaily = parseNullableLimit(g.daily, "guest.daily");
  const guestWeekly = parseNullableLimit(g.weekly, "guest.weekly");
  const guestMonthly = parseNullableLimit(g.monthly, "guest.monthly");
  const guestTotal = parseNullableLimit(g.total, "guest.total");

  const stdDaily = parseNullableLimit(s.daily, "standard.daily");
  const stdWeekly = parseNullableLimit(s.weekly, "standard.weekly");
  const stdMonthly = parseNullableLimit(s.monthly, "standard.monthly");
  const stdTotal = parseNullableLimit(s.total, "standard.total");

  const giftCount = Number(obj.registerGiftExtraCount ?? 0);
  if (!Number.isInteger(giftCount) || giftCount < 0 || giftCount > 1000000) {
    throw new SongDownloadValidationError("registerGiftExtraCount 必须是 0~1000000 的整数");
  }

  if (!Array.isArray(obj.vipTiers) || obj.vipTiers.length === 0 || obj.vipTiers.length > 50) {
    throw new SongDownloadValidationError("vipTiers 必须包含 1~50 个 VIP 档位");
  }

  const seenLevels = new Set<number>();
  const vipTiers: Array<{
    level: number;
    name: string;
    daily: number | null;
    weekly: number | null;
    monthly: number | null;
    total: number | null;
  }> = [];

  for (let i = 0; i < obj.vipTiers.length; i++) {
    const raw = obj.vipTiers[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new SongDownloadValidationError(`vipTiers[${i}] 必须是对象`);
    }
    const t = raw as Record<string, unknown>;
    const level = Number(t.level);
    if (!Number.isInteger(level) || level < 1 || level > 1000) {
      throw new SongDownloadValidationError(`vipTiers[${i}].level 必须是 1~1000 的整数`);
    }
    if (seenLevels.has(level)) {
      throw new SongDownloadValidationError(`VIP 等级 ${level} 重复`);
    }
    seenLevels.add(level);
    const name = typeof t.name === "string" ? t.name.trim().slice(0, 64) : "";
    vipTiers.push({
      level,
      name: name || `VIP ${level}档`,
      daily: parseNullableLimit(t.daily, `vipTiers[${i}].daily`),
      weekly: parseNullableLimit(t.weekly, `vipTiers[${i}].weekly`),
      monthly: parseNullableLimit(t.monthly, `vipTiers[${i}].monthly`),
      total: parseNullableLimit(t.total, `vipTiers[${i}].total`),
    });
  }
  if (!seenLevels.has(1)) {
    throw new SongDownloadValidationError("必须保留 VIP 1档 作为默认基础 VIP 档位");
  }

  await configManager.setMany([
    { key: "songDownload.guestDailyLimit", value: guestDaily === null ? -1 : guestDaily },
    { key: "songDownload.guestWeeklyLimit", value: guestWeekly === null ? -1 : guestWeekly },
    { key: "songDownload.guestMonthlyLimit", value: guestMonthly === null ? -1 : guestMonthly },
    { key: "songDownload.guestTotalLimit", value: guestTotal === null ? -1 : guestTotal },
    { key: "songDownload.standardDailyLimit", value: stdDaily === null ? -1 : stdDaily },
    { key: "songDownload.standardWeeklyLimit", value: stdWeekly === null ? -1 : stdWeekly },
    { key: "songDownload.standardMonthlyLimit", value: stdMonthly === null ? -1 : stdMonthly },
    { key: "songDownload.standardTotalLimit", value: stdTotal === null ? -1 : stdTotal },
    { key: "songDownload.registerGiftExtraCount", value: giftCount },
  ]);
  await saveVipTiers(vipTiers);

  return getAdminTierPolicies();
}
