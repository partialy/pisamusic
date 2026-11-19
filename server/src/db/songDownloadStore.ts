import { randomUUID } from "node:crypto";
import { configManager } from "../config/configManager";
import { getBeijingPeriodKeys, type BeijingPeriodKeys } from "../utils/beijingTime";
import { getAppDb } from "./appDb";
import type { DbClient, DbTransaction } from "./core/types";

export type SongDownloadSubjectType = "user" | "device";
export type SongDownloadSource = "kg" | "wy" | "kw" | "cloud";
export type SongDownloadPlatform = "android" | "desktop";

export type QuotaLimits = {
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  total: number | null;
};

export type QuotaDimensionSnapshot = {
  limit: number | null;
  used: number;
  remaining: number | null;
};

export type SongDownloadQuotaSnapshot = {
  subjectType: SongDownloadSubjectType;
  subjectKey: string;
  overrideEnabled: boolean;
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
  day_key: string;
  day_used: number;
  week_key: string;
  week_used: number;
  month_key: string;
  month_used: number;
  total_used: number;
  updated_at: number;
};

function toNullableLimit(val: number): number | null {
  if (!Number.isFinite(val) || val < 0) return null;
  return Math.trunc(val);
}

export function getDefaultQuotaLimits(): QuotaLimits {
  return {
    daily: toNullableLimit(configManager.get("songDownload.defaultDailyLimit", -1)),
    weekly: toNullableLimit(configManager.get("songDownload.defaultWeeklyLimit", -1)),
    monthly: toNullableLimit(configManager.get("songDownload.defaultMonthlyLimit", -1)),
    total: toNullableLimit(configManager.get("songDownload.defaultTotalLimit", 999999)),
  };
}

function buildDimension(limit: number | null, used: number): QuotaDimensionSnapshot {
  const safeUsed = Math.max(0, Number(used) || 0);
  if (limit === null) return { limit: null, used: safeUsed, remaining: null };
  return { limit, used: safeUsed, remaining: Math.max(0, limit - safeUsed) };
}

export function computeQuotaSnapshot(
  subjectType: SongDownloadSubjectType,
  subjectKey: string,
  row: QuotaStateRow | undefined,
  periods: BeijingPeriodKeys,
): SongDownloadQuotaSnapshot {
  const defaults = getDefaultQuotaLimits();
  const overrideEnabled = Boolean(row && Number(row.override_enabled) === 1);
  const limits: QuotaLimits = overrideEnabled && row
    ? {
        daily: row.daily_limit === null ? null : Math.max(0, Number(row.daily_limit)),
        weekly: row.weekly_limit === null ? null : Math.max(0, Number(row.weekly_limit)),
        monthly: row.monthly_limit === null ? null : Math.max(0, Number(row.monthly_limit)),
        total: row.total_limit === null ? null : Math.max(0, Number(row.total_limit)),
      }
    : defaults;

  const dayUsed = row && row.day_key === periods.dayKey ? Number(row.day_used) || 0 : 0;
  const weekUsed = row && row.week_key === periods.weekKey ? Number(row.week_used) || 0 : 0;
  const monthUsed = row && row.month_key === periods.monthKey ? Number(row.month_used) || 0 : 0;
  const totalUsed = row ? Number(row.total_used) || 0 : 0;

  return {
    subjectType,
    subjectKey,
    overrideEnabled,
    daily: buildDimension(limits.daily, dayUsed),
    weekly: buildDimension(limits.weekly, weekUsed),
    monthly: buildDimension(limits.monthly, monthUsed),
    total: buildDimension(limits.total, totalUsed),
  };
}

function hasEnoughQuota(snapshot: SongDownloadQuotaSnapshot, count: number): boolean {
  const dims = [snapshot.daily, snapshot.weekly, snapshot.monthly, snapshot.total];
  return dims.every((dim) => dim.remaining === null || dim.remaining >= count);
}

export async function getDownloadQuotaSnapshot(
  subjectType: SongDownloadSubjectType,
  subjectKey: string,
  nowMs: number = Date.now(),
): Promise<SongDownloadQuotaSnapshot> {
  const db = getAppDb();
  const row = await db.queryOne<QuotaStateRow>(
    "SELECT * FROM song_download_quota_states WHERE subject_type = ? AND subject_key = ?",
    [subjectType, subjectKey],
  );
  return computeQuotaSnapshot(subjectType, subjectKey, row ?? undefined, getBeijingPeriodKeys(nowMs));
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

export async function acquireDownloadQuotaTx(
  input: SongDownloadAcquireInput,
  nowMs: number = Date.now(),
): Promise<SongDownloadAcquireResult> {
  const db = getAppDb();
  const periods = getBeijingPeriodKeys(nowMs);
  const requiredCount = input.items.length;

  return db.transaction(async (tx) => {
    // 1. 幂等批次检查
    const existingBatch = await tx.queryOne<{ id: string; item_count: number }>(
      "SELECT id, item_count FROM song_download_batches WHERE subject_type = ? AND subject_key = ? AND client_batch_id = ?",
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
        requiredCount,
        quota: computeQuotaSnapshot(input.subjectType, input.subjectKey, currentRow ?? undefined, periods),
      };
    }

    // 2. 加锁读取配额行（MySQL 提前 INSERT IGNORE 确保排他锁）
    if (tx.dialect === "mysql") {
      await tx.execute(
        `INSERT IGNORE INTO song_download_quota_states (
          subject_type, subject_key, override_enabled,
          daily_limit, weekly_limit, monthly_limit, total_limit,
          day_key, day_used, week_key, week_used, month_key, month_used, total_used, updated_at
        ) VALUES (?, ?, 0, NULL, NULL, NULL, NULL, ?, 0, ?, 0, ?, 0, 0, ?)`,
        [input.subjectType, input.subjectKey, periods.dayKey, periods.weekKey, periods.monthKey, nowMs],
      );
    }

    const row = await tx.queryOne<QuotaStateRow>(
      `SELECT * FROM song_download_quota_states WHERE subject_type = ? AND subject_key = ?${
        tx.dialect === "mysql" ? " FOR UPDATE" : ""
      }`,
      [input.subjectType, input.subjectKey],
    );

    const beforeSnapshot = computeQuotaSnapshot(input.subjectType, input.subjectKey, row ?? undefined, periods);
    if (!hasEnoughQuota(beforeSnapshot, requiredCount)) {
      return {
        allowed: false,
        deduplicated: false,
        batchId: null,
        chargedCount: 0,
        requiredCount,
        quota: beforeSnapshot,
      };
    }

    // 3. 扣减次数（合并新周期基数）
    const nextDayUsed = beforeSnapshot.daily.used + requiredCount;
    const nextWeekUsed = beforeSnapshot.weekly.used + requiredCount;
    const nextMonthUsed = beforeSnapshot.monthly.used + requiredCount;
    const nextTotalUsed = beforeSnapshot.total.used + requiredCount;

    if (row) {
      await tx.execute(
        `UPDATE song_download_quota_states SET
          day_key = ?, day_used = ?,
          week_key = ?, week_used = ?,
          month_key = ?, month_used = ?,
          total_used = ?, updated_at = ?
        WHERE subject_type = ? AND subject_key = ?`,
        [
          periods.dayKey,
          nextDayUsed,
          periods.weekKey,
          nextWeekUsed,
          periods.monthKey,
          nextMonthUsed,
          nextTotalUsed,
          nowMs,
          input.subjectType,
          input.subjectKey,
        ],
      );
    } else {
      await tx.execute(
        `INSERT INTO song_download_quota_states (
          subject_type, subject_key, override_enabled,
          daily_limit, weekly_limit, monthly_limit, total_limit,
          day_key, day_used, week_key, week_used, month_key, month_used, total_used, updated_at
        ) VALUES (?, ?, 0, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.subjectType,
          input.subjectKey,
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
        device_kind, device_id, platform, item_count, client_ip, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        input.clientIp,
        nowMs,
      ],
    );

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
      requiredCount,
      quota: afterSnapshot,
    };
  });
}
