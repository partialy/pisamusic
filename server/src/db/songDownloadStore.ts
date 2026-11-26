import { randomUUID } from "node:crypto";
import { configManager } from "../config/configManager";
import { getBeijingPeriodKeys, type BeijingPeriodKeys } from "../utils/beijingTime";
import { getAppDb } from "./appDb";
import type { DbClient, DbTransaction } from "./core/types";

export type SongDownloadSubjectType = "user" | "device";
export type SongDownloadSource = "kg" | "wy" | "kw" | "cloud";
export type SongDownloadPlatform = "android" | "desktop";
export type SongDownloadTierSource = "override" | "vip" | "standard" | "guest";
export type ExtraQuotaSourceType = "register_gift" | "redeem_code" | "admin_adjust" | "download_charge";

export type QuotaLimits = {
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  total: number | null;
};

export type VipTierConfig = {
  level: number;
  name: string;
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  total: number | null;
  updatedAt: number;
};

export type QuotaDimensionSnapshot = {
  limit: number | null;
  used: number;
  remaining: number | null;
};

export type SongDownloadQuotaSnapshot = {
  subjectType: SongDownloadSubjectType;
  subjectKey: string;
  isGuest: boolean;
  overrideEnabled: boolean;
  tierSource: SongDownloadTierSource;
  extraRemaining: number;
  daily: QuotaDimensionSnapshot;
  weekly: QuotaDimensionSnapshot;
  monthly: QuotaDimensionSnapshot;
  total: QuotaDimensionSnapshot;
};

export type SongDownloadAcquireItemInput = {
  source: SongDownloadSource;
  songId: string;
  name: string;
  singer: string;
  album: string;
  cover: string;
  durationMs: number | null;
  qualityKey: string;
};

export type SongDownloadAcquireInput = {
  clientBatchId: string;
  subjectType: SongDownloadSubjectType;
  subjectKey: string;
  userId: string | null;
  deviceKind: SongDownloadPlatform;
  deviceId: string;
  platform: SongDownloadPlatform;
  clientIp: string;
  items: SongDownloadAcquireItemInput[];
};

export type SongDownloadAcquireResult = {
  allowed: boolean;
  deduplicated: boolean;
  batchId: string | null;
  chargedCount: number;
  regularChargedCount: number;
  extraChargedCount: number;
  requiredCount: number;
  quota: SongDownloadQuotaSnapshot;
};

export type QuotaStateRow = {
  subject_type: SongDownloadSubjectType;
  subject_key: string;
  override_enabled: number;
  daily_limit: number | null;
  weekly_limit: number | null;
  monthly_limit: number | null;
  total_limit: number | null;
  extra_balance: number;
  day_key: string;
  day_used: number;
  week_key: string;
  week_used: number;
  month_key: string;
  month_used: number;
  total_used: number;
  updated_at: number;
};

type VipTierRow = {
  level: number;
  name: string;
  daily_limit: number | null;
  weekly_limit: number | null;
  monthly_limit: number | null;
  total_limit: number | null;
  updated_at: number;
};

export type UserTierContext = {
  vipActive: boolean;
  vipLevel: number;
};

function toNullableLimit(val: number): number | null {
  if (!Number.isFinite(val) || val < 0) return null;
  return Math.trunc(val);
}

export function getGuestQuotaLimits(): QuotaLimits {
  return {
    daily: toNullableLimit(configManager.get("songDownload.guestDailyLimit", 2)),
    weekly: toNullableLimit(configManager.get("songDownload.guestWeeklyLimit", 10)),
    monthly: toNullableLimit(configManager.get("songDownload.guestMonthlyLimit", 30)),
    total: toNullableLimit(configManager.get("songDownload.guestTotalLimit", 30)),
  };
}

export function getStandardQuotaLimits(): QuotaLimits {
  return {
    daily: toNullableLimit(configManager.get("songDownload.standardDailyLimit", 10)),
    weekly: toNullableLimit(configManager.get("songDownload.standardWeeklyLimit", 100)),
    monthly: toNullableLimit(configManager.get("songDownload.standardMonthlyLimit", 1000)),
    total: toNullableLimit(configManager.get("songDownload.standardTotalLimit", -1)),
  };
}

export function getRegisterGiftExtraCount(): number {
  const val = Number(configManager.get("songDownload.registerGiftExtraCount", 10));
  if (!Number.isFinite(val) || val < 0) return 0;
  return Math.trunc(val);
}

/** 兼容旧调用名称，当前映射到游客兜底限制。 */
export function getDefaultQuotaLimits(): QuotaLimits {
  return getGuestQuotaLimits();
}

function mapVipTierRow(row: VipTierRow): VipTierConfig {
  return {
    level: Number(row.level),
    name: row.name || `VIP ${row.level}档`,
    daily: row.daily_limit === null ? null : Math.max(0, Number(row.daily_limit)),
    weekly: row.weekly_limit === null ? null : Math.max(0, Number(row.weekly_limit)),
    monthly: row.monthly_limit === null ? null : Math.max(0, Number(row.monthly_limit)),
    total: row.total_limit === null ? null : Math.max(0, Number(row.total_limit)),
    updatedAt: Number(row.updated_at) || 0,
  };
}

export async function listVipTiers(db: DbClient | DbTransaction = getAppDb()): Promise<VipTierConfig[]> {
  const rows = await db.query<VipTierRow>("SELECT * FROM song_download_vip_tiers ORDER BY level ASC");
  if (!rows.length) {
    return [{ level: 1, name: "VIP 1档", daily: null, weekly: null, monthly: null, total: null, updatedAt: 0 }];
  }
  return rows.map(mapVipTierRow);
}

export async function saveVipTiers(tiers: Array<{
  level: number;
  name: string;
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  total: number | null;
}>): Promise<VipTierConfig[]> {
  const db = getAppDb();
  const now = Date.now();
  await db.transaction(async (tx) => {
    const keepLevels = new Set(tiers.map((t) => t.level));
    const existing = await tx.query<{ level: number }>("SELECT level FROM song_download_vip_tiers");
    for (const row of existing) {
      const lv = Number(row.level);
      if (!keepLevels.has(lv)) {
        await tx.execute("DELETE FROM song_download_vip_tiers WHERE level = ?", [lv]);
      }
    }
    for (const tier of tiers) {
      const sql =
        tx.dialect === "mysql"
          ? `INSERT INTO song_download_vip_tiers(level, name, daily_limit, weekly_limit, monthly_limit, total_limit, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE name=VALUES(name), daily_limit=VALUES(daily_limit), weekly_limit=VALUES(weekly_limit), monthly_limit=VALUES(monthly_limit), total_limit=VALUES(total_limit), updated_at=VALUES(updated_at)`
          : `INSERT INTO song_download_vip_tiers(level, name, daily_limit, weekly_limit, monthly_limit, total_limit, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(level) DO UPDATE SET name=excluded.name, daily_limit=excluded.daily_limit, weekly_limit=excluded.weekly_limit, monthly_limit=excluded.monthly_limit, total_limit=excluded.total_limit, updated_at=excluded.updated_at`;
      await tx.execute(sql, [
        tier.level,
        tier.name,
        tier.daily,
        tier.weekly,
        tier.monthly,
        tier.total,
        now,
      ]);
    }
  });
  return listVipTiers(db);
}

function buildDimension(limit: number | null, used: number): QuotaDimensionSnapshot {
  const safeUsed = Math.max(0, Number(used) || 0);
  if (limit === null) return { limit: null, used: safeUsed, remaining: null };
  return { limit, used: safeUsed, remaining: Math.max(0, limit - safeUsed) };
}

export function resolveEffectiveLimits(params: {
  subjectType: SongDownloadSubjectType;
  row: QuotaStateRow | undefined;
  userContext?: UserTierContext | null;
  vipTiersByLevel: Map<number, VipTierConfig>;
}): { limits: QuotaLimits; tierSource: SongDownloadTierSource; overrideEnabled: boolean } {
  const { subjectType, row, userContext, vipTiersByLevel } = params;
  const overrideEnabled = Boolean(row && Number(row.override_enabled) === 1);
  if (overrideEnabled && row) {
    return {
      overrideEnabled: true,
      tierSource: "override",
      limits: {
        daily: row.daily_limit === null ? null : Math.max(0, Number(row.daily_limit)),
        weekly: row.weekly_limit === null ? null : Math.max(0, Number(row.weekly_limit)),
        monthly: row.monthly_limit === null ? null : Math.max(0, Number(row.monthly_limit)),
        total: row.total_limit === null ? null : Math.max(0, Number(row.total_limit)),
      },
    };
  }

  if (subjectType === "user") {
    if (userContext?.vipActive) {
      const tier =
        vipTiersByLevel.get(userContext.vipLevel) ??
        vipTiersByLevel.get(1) ?? { daily: null, weekly: null, monthly: null, total: null };
      return {
        overrideEnabled: false,
        tierSource: "vip",
        limits: {
          daily: tier.daily,
          weekly: tier.weekly,
          monthly: tier.monthly,
          total: tier.total,
        },
      };
    }
    return {
      overrideEnabled: false,
      tierSource: "standard",
      limits: getStandardQuotaLimits(),
    };
  }

  return {
    overrideEnabled: false,
    tierSource: "guest",
    limits: getGuestQuotaLimits(),
  };
}

export function computeQuotaSnapshot(
  subjectType: SongDownloadSubjectType,
  subjectKey: string,
  row: QuotaStateRow | undefined,
  periods: BeijingPeriodKeys,
  userContext?: UserTierContext | null,
  vipTiersByLevel: Map<number, VipTierConfig> = new Map(),
): SongDownloadQuotaSnapshot {
  const resolved = resolveEffectiveLimits({
    subjectType,
    row,
    userContext,
    vipTiersByLevel,
  });

  const dayUsed = row && row.day_key === periods.dayKey ? Number(row.day_used) || 0 : 0;
  const weekUsed = row && row.week_key === periods.weekKey ? Number(row.week_used) || 0 : 0;
  const monthUsed = row && row.month_key === periods.monthKey ? Number(row.month_used) || 0 : 0;
  const totalUsed = row ? Number(row.total_used) || 0 : 0;
  const extraRemaining = row ? Math.max(0, Number(row.extra_balance) || 0) : 0;

  return {
    subjectType,
    subjectKey,
    isGuest: subjectType === "device",
    overrideEnabled: resolved.overrideEnabled,
    tierSource: resolved.tierSource,
    extraRemaining,
    daily: buildDimension(resolved.limits.daily, dayUsed),
    weekly: buildDimension(resolved.limits.weekly, weekUsed),
    monthly: buildDimension(resolved.limits.monthly, monthUsed),
    total: buildDimension(resolved.limits.total, totalUsed),
  };
}

function computeRegularRemaining(snapshot: SongDownloadQuotaSnapshot): number | null {
  const finite = [snapshot.daily, snapshot.weekly, snapshot.monthly, snapshot.total]
    .map((dim) => dim.remaining)
    .filter((rem): rem is number => rem !== null);
  if (finite.length === 0) return null;
  return Math.max(0, Math.min(...finite));
}

async function loadUserTierContext(
  db: DbClient | DbTransaction,
  subjectType: SongDownloadSubjectType,
  subjectKey: string,
  nowMs: number,
): Promise<UserTierContext | null> {
  if (subjectType !== "user") return null;
  const u = await db.queryOne<{ vip_enabled: number; vip_expires_at: number | null; vip_level: number }>(
    "SELECT vip_enabled, vip_expires_at, vip_level FROM users WHERE id = ?",
    [subjectKey],
  );
  if (!u) return { vipActive: false, vipLevel: 1 };
  const active = Number(u.vip_enabled) === 1 && u.vip_expires_at !== null && Number(u.vip_expires_at) > nowMs;
  return {
    vipActive: active,
    vipLevel: Math.max(1, Number(u.vip_level) || 1),
  };
}

export async function getDownloadQuotaSnapshot(
  subjectType: SongDownloadSubjectType,
  subjectKey: string,
  nowMs: number = Date.now(),
): Promise<SongDownloadQuotaSnapshot> {
  const db = getAppDb();
  const [row, userContext, tiers] = await Promise.all([
    db.queryOne<QuotaStateRow>(
      "SELECT * FROM song_download_quota_states WHERE subject_type = ? AND subject_key = ?",
      [subjectType, subjectKey],
    ),
    loadUserTierContext(db, subjectType, subjectKey, nowMs),
    listVipTiers(db),
  ]);
  const tiersMap = new Map(tiers.map((t) => [t.level, t]));
  return computeQuotaSnapshot(subjectType, subjectKey, row ?? undefined, getBeijingPeriodKeys(nowMs), userContext, tiersMap);
}

export async function deleteSubjectQuotaState(
  db: DbClient | DbTransaction,
  subjectType: SongDownloadSubjectType,
  subjectKey: string,
): Promise<void> {
  await db.execute(
    "DELETE FROM song_download_quota_states WHERE subject_type = ? AND subject_key = ?",
    [subjectType, subjectKey],
  );
}

export async function adjustExtraQuotaInTx(
  tx: DbTransaction,
  params: {
    subjectType: SongDownloadSubjectType;
    subjectKey: string;
    delta: number;
    sourceType: ExtraQuotaSourceType;
    refId?: string;
    remark?: string;
    nowMs?: number;
  },
): Promise<number> {
  const nowMs = params.nowMs ?? Date.now();
  const periods = getBeijingPeriodKeys(nowMs);
  const delta = Math.trunc(params.delta);

  if (tx.dialect === "mysql") {
    await tx.execute(
      `INSERT IGNORE INTO song_download_quota_states (
        subject_type, subject_key, override_enabled,
        daily_limit, weekly_limit, monthly_limit, total_limit, extra_balance,
        day_key, day_used, week_key, week_used, month_key, month_used, total_used, updated_at
      ) VALUES (?, ?, 0, NULL, NULL, NULL, NULL, 0, ?, 0, ?, 0, ?, 0, 0, ?)`,
      [params.subjectType, params.subjectKey, periods.dayKey, periods.weekKey, periods.monthKey, nowMs],
    );
  }

  const row = await tx.queryOne<QuotaStateRow>(
    `SELECT * FROM song_download_quota_states WHERE subject_type = ? AND subject_key = ?${
      tx.dialect === "mysql" ? " FOR UPDATE" : ""
    }`,
    [params.subjectType, params.subjectKey],
  );
  const currentExtra = row ? Math.max(0, Number(row.extra_balance) || 0) : 0;
  const nextExtra = Math.max(0, currentExtra + delta);
  const actualDelta = nextExtra - currentExtra;

  if (row) {
    await tx.execute(
      "UPDATE song_download_quota_states SET extra_balance = ?, updated_at = ? WHERE subject_type = ? AND subject_key = ?",
      [nextExtra, nowMs, params.subjectType, params.subjectKey],
    );
  } else {
    await tx.execute(
      `INSERT INTO song_download_quota_states (
        subject_type, subject_key, override_enabled,
        daily_limit, weekly_limit, monthly_limit, total_limit, extra_balance,
        day_key, day_used, week_key, week_used, month_key, month_used, total_used, updated_at
      ) VALUES (?, ?, 0, NULL, NULL, NULL, NULL, ?, ?, 0, ?, 0, ?, 0, 0, ?)`,
      [params.subjectType, params.subjectKey, nextExtra, periods.dayKey, periods.weekKey, periods.monthKey, nowMs],
    );
  }

  if (actualDelta !== 0) {
    await tx.execute(
      `INSERT INTO song_download_extra_logs (
        id, subject_type, subject_key, delta, balance_after, source_type, ref_id, remark, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        params.subjectType,
        params.subjectKey,
        actualDelta,
        nextExtra,
        params.sourceType,
        params.refId ?? "",
        params.remark ?? "",
        nowMs,
      ],
    );
  }

  return nextExtra;
}

export async function acquireDownloadQuotaTx(
  input: SongDownloadAcquireInput,
  nowMs: number = Date.now(),
): Promise<SongDownloadAcquireResult> {
  const db = getAppDb();
  const periods = getBeijingPeriodKeys(nowMs);
  const requiredCount = input.items.length;

  return db.transaction(async (tx) => {
    const tiers = await listVipTiers(tx);
    const tiersMap = new Map(tiers.map((t) => [t.level, t]));
    const userContext = await loadUserTierContext(tx, input.subjectType, input.subjectKey, nowMs);

    // 1. 幂等批次检查
    const existingBatch = await tx.queryOne<{
      id: string;
      item_count: number;
      regular_charged_count: number;
      extra_charged_count: number;
    }>(
      "SELECT id, item_count, regular_charged_count, extra_charged_count FROM song_download_batches WHERE subject_type = ? AND subject_key = ? AND client_batch_id = ?",
      [input.subjectType, input.subjectKey, input.clientBatchId],
    );
    if (existingBatch) {
      const currentRow = await tx.queryOne<QuotaStateRow>(
        "SELECT * FROM song_download_quota_states WHERE subject_type = ? AND subject_key = ?",
        [input.subjectType, input.subjectKey],
      );
      return {
        allowed: true,
        deduplicated: true,
        batchId: existingBatch.id,
        chargedCount: Number(existingBatch.item_count) || requiredCount,
        regularChargedCount: Number(existingBatch.regular_charged_count) || 0,
        extraChargedCount: Number(existingBatch.extra_charged_count) || 0,
        requiredCount,
        quota: computeQuotaSnapshot(input.subjectType, input.subjectKey, currentRow ?? undefined, periods, userContext, tiersMap),
      };
    }

    // 2. 加锁读取配额行（MySQL 提前 INSERT IGNORE 确保排他锁）
    if (tx.dialect === "mysql") {
      await tx.execute(
        `INSERT IGNORE INTO song_download_quota_states (
          subject_type, subject_key, override_enabled,
          daily_limit, weekly_limit, monthly_limit, total_limit, extra_balance,
          day_key, day_used, week_key, week_used, month_key, month_used, total_used, updated_at
        ) VALUES (?, ?, 0, NULL, NULL, NULL, NULL, 0, ?, 0, ?, 0, ?, 0, 0, ?)`,
        [input.subjectType, input.subjectKey, periods.dayKey, periods.weekKey, periods.monthKey, nowMs],
      );
    }

    const row = await tx.queryOne<QuotaStateRow>(
      `SELECT * FROM song_download_quota_states WHERE subject_type = ? AND subject_key = ?${
        tx.dialect === "mysql" ? " FOR UPDATE" : ""
      }`,
      [input.subjectType, input.subjectKey],
    );

    const beforeSnapshot = computeQuotaSnapshot(
      input.subjectType,
      input.subjectKey,
      row ?? undefined,
      periods,
      userContext,
      tiersMap,
    );

    // 3. 混合拼额度：常规优先，常规不够用额外补足；额外不计入天/周/月/总
    const regularAvailable = computeRegularRemaining(beforeSnapshot);
    const regularCharged =
      regularAvailable === null ? requiredCount : Math.min(requiredCount, regularAvailable);
    const extraCharged = requiredCount - regularCharged;

    if (extraCharged > beforeSnapshot.extraRemaining) {
      return {
        allowed: false,
        deduplicated: false,
        batchId: null,
        chargedCount: 0,
        regularChargedCount: 0,
        extraChargedCount: 0,
        requiredCount,
        quota: beforeSnapshot,
      };
    }

    const nextDayUsed = beforeSnapshot.daily.used + regularCharged;
    const nextWeekUsed = beforeSnapshot.weekly.used + regularCharged;
    const nextMonthUsed = beforeSnapshot.monthly.used + regularCharged;
    const nextTotalUsed = beforeSnapshot.total.used + regularCharged;
    const nextExtraBalance = beforeSnapshot.extraRemaining - extraCharged;

    if (row) {
      await tx.execute(
        `UPDATE song_download_quota_states SET
          day_key = ?, day_used = ?,
          week_key = ?, week_used = ?,
          month_key = ?, month_used = ?,
          total_used = ?, extra_balance = ?, updated_at = ?
        WHERE subject_type = ? AND subject_key = ?`,
        [
          periods.dayKey,
          nextDayUsed,
          periods.weekKey,
          nextWeekUsed,
          periods.monthKey,
          nextMonthUsed,
          nextTotalUsed,
          nextExtraBalance,
          nowMs,
          input.subjectType,
          input.subjectKey,
        ],
      );
    } else {
      await tx.execute(
        `INSERT INTO song_download_quota_states (
          subject_type, subject_key, override_enabled,
          daily_limit, weekly_limit, monthly_limit, total_limit, extra_balance,
          day_key, day_used, week_key, week_used, month_key, month_used, total_used, updated_at
        ) VALUES (?, ?, 0, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.subjectType,
          input.subjectKey,
          nextExtraBalance,
          periods.dayKey,
          nextDayUsed,
          periods.weekKey,
          nextWeekUsed,
          periods.monthKey,
          nextMonthUsed,
          nextTotalUsed,
          nowMs,
        ],
      );
    }

    // 4. 写入批次与明细（一首一条）
    const batchId = randomUUID();
    await tx.execute(
      `INSERT INTO song_download_batches (
        id, client_batch_id, subject_type, subject_key, user_id,
        device_kind, device_id, platform, item_count, regular_charged_count, extra_charged_count, client_ip, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        input.clientBatchId,
        input.subjectType,
        input.subjectKey,
        input.userId,
        input.deviceKind,
        input.deviceId,
        input.platform,
        requiredCount,
        regularCharged,
        extraCharged,
        input.clientIp,
        nowMs,
      ],
    );

    if (extraCharged > 0) {
      await tx.execute(
        `INSERT INTO song_download_extra_logs (
          id, subject_type, subject_key, delta, balance_after, source_type, ref_id, remark, created_at
        ) VALUES (?, ?, ?, ?, ?, 'download_charge', ?, '', ?)`,
        [randomUUID(), input.subjectType, input.subjectKey, -extraCharged, nextExtraBalance, batchId, nowMs],
      );
    }

    for (const item of input.items) {
      await tx.execute(
        `INSERT INTO song_download_records (
          id, batch_id, subject_type, subject_key, user_id,
          device_kind, device_id, platform, source, song_id,
          song_name, singer, album, cover_url, duration_ms,
          quality_key, download_day, download_week, download_month, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          batchId,
          input.subjectType,
          input.subjectKey,
          input.userId,
          input.deviceKind,
          input.deviceId,
          input.platform,
          item.source,
          item.songId,
          item.name,
          item.singer,
          item.album,
          item.cover,
          item.durationMs,
          item.qualityKey,
          periods.dayKey,
          periods.weekKey,
          periods.monthKey,
          nowMs,
        ],
      );
    }

    const afterSnapshot: SongDownloadQuotaSnapshot = {
      ...beforeSnapshot,
      extraRemaining: nextExtraBalance,
      daily: buildDimension(beforeSnapshot.daily.limit, nextDayUsed),
      weekly: buildDimension(beforeSnapshot.weekly.limit, nextWeekUsed),
      monthly: buildDimension(beforeSnapshot.monthly.limit, nextMonthUsed),
      total: buildDimension(beforeSnapshot.total.limit, nextTotalUsed),
    };

    return {
      allowed: true,
      deduplicated: false,
      batchId,
      chargedCount: requiredCount,
      regularChargedCount: regularCharged,
      extraChargedCount: extraCharged,
      requiredCount,
      quota: afterSnapshot,
    };
  });
}
