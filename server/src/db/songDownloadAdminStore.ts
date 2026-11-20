import { getBeijingPeriodKeys, listRecentBeijingDays, type BeijingPeriodKeys } from "../utils/beijingTime";
import { getAppDb } from "./appDb";
import type { DbTransaction } from "./core/types";
import {
  computeQuotaSnapshot,
  type QuotaStateRow,
  type SongDownloadQuotaSnapshot,
  type SongDownloadSubjectType,
} from "./songDownloadStore";

export type SongDownloadDailyTrendItem = {
  day: string;
  downloads: number;
  batches: number;
};

export type SongDownloadOverviewStats = {
  days: number;
  totalDownloads: number;
  totalBatches: number;
  todayDownloads: number;
  periodDownloads: number;
  bySource: Array<{ source: string; count: number }>;
  byPlatform: Array<{ platform: string; count: number }>;
  trend: SongDownloadDailyTrendItem[];
};

export type TopDownloadedSongItem = {
  source: string;
  songId: string;
  songName: string;
  singer: string;
  album: string;
  coverUrl: string;
  downloadCount: number;
  uniqueSubjects: number;
  lastDownloadedAt: number;
};

export type SongDownloadRecordAdminItem = {
  id: string;
  batchId: string;
  subjectType: SongDownloadSubjectType;
  subjectKey: string;
  userId: string | null;
  username: string | null;
  deviceKind: "android" | "desktop";
  deviceId: string;
  deviceName: string | null;
  platform: "android" | "desktop";
  source: string;
  songId: string;
  songName: string;
  singer: string;
  album: string;
  coverUrl: string;
  durationMs: number | null;
  qualityKey: string;
  downloadDay: string;
  createdAt: number;
};

export type AdminQuotaStateItem = SongDownloadQuotaSnapshot & {
  displayName: string;
  secondaryLabel: string;
  updatedAt: number;
};

export type QuotaOverrideSaveInput = {
  subjectType: SongDownloadSubjectType;
  subjectKey: string;
  overrideEnabled: boolean;
  dailyLimit: number | null;
  weeklyLimit: number | null;
  monthlyLimit: number | null;
  totalLimit: number | null;
  resetDayUsed?: boolean;
  resetWeekUsed?: boolean;
  resetMonthUsed?: boolean;
  resetTotalUsed?: boolean;
};

export async function querySongDownloadOverview(days: number, nowMs: number = Date.now()): Promise<SongDownloadOverviewStats> {
  const db = getAppDb();
  const dayList = listRecentBeijingDays(days, nowMs);
  const startDay = dayList[0]!;
  const today = dayList[dayList.length - 1]!;

  const totals = (await db.queryOne<{ total_downloads: number; total_batches: number }>(
    "SELECT COUNT(*) AS total_downloads, (SELECT COUNT(*) FROM song_download_batches) AS total_batches FROM song_download_records",
  )) ?? { total_downloads: 0, total_batches: 0 };

  const todayRow = (await db.queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM song_download_records WHERE download_day = ?",
    [today],
  )) ?? { count: 0 };

  const trendRows = await db.query<{ day: string; downloads: number }>(
    "SELECT download_day AS day, COUNT(*) AS downloads FROM song_download_records WHERE download_day >= ? GROUP BY download_day",
    [startDay],
  );
  const batchTrendRows = await db.query<{ day: string; batches: number }>(
    `SELECT r.download_day AS day, COUNT(DISTINCT r.batch_id) AS batches
     FROM song_download_records r WHERE r.download_day >= ? GROUP BY r.download_day`,
    [startDay],
  );

  const downloadMap = new Map(trendRows.map((r) => [r.day, Number(r.downloads) || 0]));
  const batchMap = new Map(batchTrendRows.map((r) => [r.day, Number(r.batches) || 0]));
  const trend = dayList.map((day) => ({
    day,
    downloads: downloadMap.get(day) ?? 0,
    batches: batchMap.get(day) ?? 0,
  }));

  const bySource = await db.query<{ source: string; count: number }>(
    "SELECT source, COUNT(*) AS count FROM song_download_records WHERE download_day >= ? GROUP BY source ORDER BY count DESC",
    [startDay],
  );
  const byPlatform = await db.query<{ platform: string; count: number }>(
    "SELECT platform, COUNT(*) AS count FROM song_download_records WHERE download_day >= ? GROUP BY platform ORDER BY count DESC",
    [startDay],
  );

  return {
    days,
    totalDownloads: Number(totals.total_downloads) || 0,
    totalBatches: Number(totals.total_batches) || 0,
    todayDownloads: Number(todayRow.count) || 0,
    periodDownloads: trend.reduce((sum, item) => sum + item.downloads, 0),
    bySource: bySource.map((r) => ({ source: r.source, count: Number(r.count) || 0 })),
    byPlatform: byPlatform.map((r) => ({ platform: r.platform, count: Number(r.count) || 0 })),
    trend,
  };
}

export async function queryTopDownloadedSongs(params: {
  days: number | "all";
  source?: string;
  offset: number;
  limit: number;
}): Promise<{ items: TopDownloadedSongItem[]; total: number; offset: number; limit: number }> {
  const db = getAppDb();
  const where: string[] = [];
  const args: Array<string | number> = [];

  if (params.days !== "all") {
    const startDay = listRecentBeijingDays(params.days)[0]!;
    where.push("download_day >= ?");
    args.push(startDay);
  }
  if (params.source && params.source !== "all") {
    where.push("source = ?");
    args.push(params.source);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = (await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM (SELECT 1 FROM song_download_records ${whereSql} GROUP BY source, song_id) t`,
    args,
  )) ?? { total: 0 };

  const uniqueSubjectExpr =
    db.dialect === "mysql"
      ? "COUNT(DISTINCT CONCAT(subject_type, ':', subject_key))"
      : "COUNT(DISTINCT (subject_type || ':' || subject_key))";

  const rows = await db.query<{
    source: string;
    song_id: string;
    song_name: string;
    singer: string;
    album: string;
    cover_url: string;
    download_count: number;
    unique_subjects: number;
    last_downloaded_at: number;
  }>(
    `SELECT source, song_id,
      MAX(song_name) AS song_name,
      MAX(singer) AS singer,
      MAX(album) AS album,
      MAX(cover_url) AS cover_url,
      COUNT(*) AS download_count,
      ${uniqueSubjectExpr} AS unique_subjects,
      MAX(created_at) AS last_downloaded_at
    FROM song_download_records
    ${whereSql}
    GROUP BY source, song_id
    ORDER BY download_count DESC, last_downloaded_at DESC
    LIMIT ? OFFSET ?`,
    [...args, params.limit, params.offset],
  );

  return {
    items: rows.map((r) => ({
      source: r.source,
      songId: r.song_id,
      songName: r.song_name,
      singer: r.singer,
      album: r.album,
      coverUrl: r.cover_url,
      downloadCount: Number(r.download_count) || 0,
      uniqueSubjects: Number(r.unique_subjects) || 0,
      lastDownloadedAt: Number(r.last_downloaded_at) || 0,
    })),
    total: Number(totalRow.total) || 0,
    offset: params.offset,
    limit: params.limit,
  };
}

export async function querySongDownloadRecords(params: {
  keyword?: string;
  source?: string;
  platform?: string;
  subjectType?: string;
  userId?: string;
  deviceId?: string;
  startDay?: string;
  endDay?: string;
  offset: number;
  limit: number;
}): Promise<{ items: SongDownloadRecordAdminItem[]; total: number; offset: number; limit: number }> {
  const db = getAppDb();
  const where: string[] = [];
  const args: Array<string | number> = [];

  if (params.keyword) {
    const term = `%${params.keyword}%`;
    where.push("(r.song_name LIKE ? OR r.singer LIKE ? OR r.album LIKE ? OR r.song_id LIKE ? OR u.username LIKE ? OR r.device_id LIKE ?)");
    args.push(term, term, term, term, term, term);
  }
  if (params.source && params.source !== "all") {
    where.push("r.source = ?");
    args.push(params.source);
  }
  if (params.platform && params.platform !== "all") {
    where.push("r.platform = ?");
    args.push(params.platform);
  }
  if (params.subjectType && params.subjectType !== "all") {
    where.push("r.subject_type = ?");
    args.push(params.subjectType);
  }
  if (params.userId) {
    where.push("r.user_id = ?");
    args.push(params.userId);
  }
  if (params.deviceId) {
    where.push("r.device_id = ?");
    args.push(params.deviceId);
  }
  if (params.startDay) {
    where.push("r.download_day >= ?");
    args.push(params.startDay);
  }
  if (params.endDay) {
    where.push("r.download_day <= ?");
    args.push(params.endDay);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = (await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM song_download_records r
     LEFT JOIN users u ON u.id = r.user_id
     ${whereSql}`,
    args,
  )) ?? { total: 0 };

  const rows = await db.query<{
    id: string;
    batch_id: string;
    subject_type: SongDownloadSubjectType;
    subject_key: string;
    user_id: string | null;
    username: string | null;
    device_kind: "android" | "desktop";
    device_id: string;
    android_device_name: string | null;
    desktop_device_name: string | null;
    platform: "android" | "desktop";
    source: string;
    song_id: string;
    song_name: string;
    singer: string;
    album: string;
    cover_url: string;
    duration_ms: number | null;
    quality_key: string;
    download_day: string;
    created_at: number;
  }>(
    `SELECT r.id, r.batch_id, r.subject_type, r.subject_key, r.user_id, u.username,
      r.device_kind, r.device_id,
      ad.device_name AS android_device_name,
      dd.device_name AS desktop_device_name,
      r.platform, r.source, r.song_id, r.song_name, r.singer, r.album,
      r.cover_url, r.duration_ms, r.quality_key, r.download_day, r.created_at
    FROM song_download_records r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN device_info ad ON r.device_kind = 'android' AND ad.id = r.device_id
    LEFT JOIN desktop_device_info dd ON r.device_kind = 'desktop' AND dd.id = r.device_id
    ${whereSql}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ? OFFSET ?`,
    [...args, params.limit, params.offset],
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      batchId: r.batch_id,
      subjectType: r.subject_type,
      subjectKey: r.subject_key,
      userId: r.user_id,
      username: r.username,
      deviceKind: r.device_kind,
      deviceId: r.device_id,
      deviceName: r.device_kind === "android" ? r.android_device_name : r.desktop_device_name,
      platform: r.platform,
      source: r.source,
      songId: r.song_id,
      songName: r.song_name,
      singer: r.singer,
      album: r.album,
      coverUrl: r.cover_url,
      durationMs: r.duration_ms === null ? null : Number(r.duration_ms),
      qualityKey: r.quality_key,
      downloadDay: r.download_day,
      createdAt: Number(r.created_at) || 0,
    })),
    total: Number(totalRow.total) || 0,
    offset: params.offset,
    limit: params.limit,
  };
}

export async function queryQuotaStates(params: {
  subjectType?: string;
  keyword?: string;
  offset: number;
  limit: number;
}): Promise<{ items: AdminQuotaStateItem[]; total: number; offset: number; limit: number }> {
  const db = getAppDb();
  const periods = getBeijingPeriodKeys();
  const where: string[] = [];
  const args: Array<string | number> = [];

  if (params.subjectType && params.subjectType !== "all") {
    where.push("q.subject_type = ?");
    args.push(params.subjectType);
  }
  if (params.keyword) {
    const term = `%${params.keyword}%`;
    where.push("(q.subject_key LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR ad.device_name LIKE ? OR dd.device_name LIKE ?)");
    args.push(term, term, term, term, term);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = (await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM song_download_quota_states q
     LEFT JOIN users u ON q.subject_type = 'user' AND u.id = q.subject_key
     LEFT JOIN device_info ad ON q.subject_type = 'device' AND q.subject_key = ${
       db.dialect === "mysql" ? "CONCAT('android:', ad.id)" : "('android:' || ad.id)"
     }
     LEFT JOIN desktop_device_info dd ON q.subject_type = 'device' AND q.subject_key = ${
       db.dialect === "mysql" ? "CONCAT('desktop:', dd.id)" : "('desktop:' || dd.id)"
     }
     ${whereSql}`,
    args,
  )) ?? { total: 0 };

  const rows = await db.query<
    QuotaStateRow & {
      username: string | null;
      email: string | null;
      android_device_name: string | null;
      desktop_device_name: string | null;
    }
  >(
    `SELECT q.*, u.username, u.email,
      ad.device_name AS android_device_name,
      dd.device_name AS desktop_device_name
    FROM song_download_quota_states q
    LEFT JOIN users u ON q.subject_type = 'user' AND u.id = q.subject_key
    LEFT JOIN device_info ad ON q.subject_type = 'device' AND q.subject_key = ${
      db.dialect === "mysql" ? "CONCAT('android:', ad.id)" : "('android:' || ad.id)"
    }
    LEFT JOIN desktop_device_info dd ON q.subject_type = 'device' AND q.subject_key = ${
      db.dialect === "mysql" ? "CONCAT('desktop:', dd.id)" : "('desktop:' || dd.id)"
    }
    ${whereSql}
    ORDER BY q.updated_at DESC
    LIMIT ? OFFSET ?`,
    [...args, params.limit, params.offset],
  );

  return {
    items: rows.map((row) => {
      const snap = computeQuotaSnapshot(row.subject_type, row.subject_key, row, periods);
      const displayName =
        row.subject_type === "user"
          ? row.username || row.subject_key
          : row.android_device_name || row.desktop_device_name || row.subject_key;
      const secondaryLabel =
        row.subject_type === "user" ? row.email || row.subject_key : row.subject_key;
      return {
        ...snap,
        displayName,
        secondaryLabel,
        updatedAt: Number(row.updated_at) || 0,
      };
    }),
    total: Number(totalRow.total) || 0,
    offset: params.offset,
    limit: params.limit,
  };
}

export async function getAdminQuotaStateDetail(
  subjectType: SongDownloadSubjectType,
  subjectKey: string,
): Promise<AdminQuotaStateItem> {
  const db = getAppDb();
  const periods = getBeijingPeriodKeys();
  const row = await db.queryOne<QuotaStateRow>(
    "SELECT * FROM song_download_quota_states WHERE subject_type = ? AND subject_key = ?",
    [subjectType, subjectKey],
  );
  const snap = computeQuotaSnapshot(subjectType, subjectKey, row ?? undefined, periods);

  let displayName = subjectKey;
  let secondaryLabel = subjectKey;
  if (subjectType === "user") {
    const u = await db.queryOne<{ username: string; email: string }>(
      "SELECT username, email FROM users WHERE id = ?",
      [subjectKey],
    );
    if (u) {
      displayName = u.username || subjectKey;
      secondaryLabel = u.email || subjectKey;
    }
  } else if (subjectKey.startsWith("android:")) {
    const devId = subjectKey.slice("android:".length);
    const d = await db.queryOne<{ device_name: string; model: string }>(
      "SELECT device_name, model FROM device_info WHERE id = ?",
      [devId],
    );
    if (d) {
      displayName = d.device_name || devId;
      secondaryLabel = d.model || subjectKey;
    }
  } else if (subjectKey.startsWith("desktop:")) {
    const devId = subjectKey.slice("desktop:".length);
    const d = await db.queryOne<{ device_name: string; platform: string }>(
      "SELECT device_name, platform FROM desktop_device_info WHERE id = ?",
      [devId],
    );
    if (d) {
      displayName = d.device_name || devId;
      secondaryLabel = d.platform || subjectKey;
    }
  }

  return {
    ...snap,
    displayName,
    secondaryLabel,
    updatedAt: row ? Number(row.updated_at) || 0 : 0,
  };
}

async function upsertQuotaStateInTx(
  tx: DbTransaction,
  input: QuotaOverrideSaveInput,
  now: number,
  periods: BeijingPeriodKeys,
): Promise<void> {
  const existing = await tx.queryOne<QuotaStateRow>(
    `SELECT * FROM song_download_quota_states WHERE subject_type = ? AND subject_key = ?${
      tx.dialect === "mysql" ? " FOR UPDATE" : ""
    }`,
    [input.subjectType, input.subjectKey],
  );

  const currentDayUsed = input.resetDayUsed
    ? 0
    : existing && existing.day_key === periods.dayKey
      ? Number(existing.day_used) || 0
      : 0;
  const currentWeekUsed = input.resetWeekUsed
    ? 0
    : existing && existing.week_key === periods.weekKey
      ? Number(existing.week_used) || 0
      : 0;
  const currentMonthUsed = input.resetMonthUsed
    ? 0
    : existing && existing.month_key === periods.monthKey
      ? Number(existing.month_used) || 0
      : 0;
  const currentTotalUsed = input.resetTotalUsed ? 0 : existing ? Number(existing.total_used) || 0 : 0;

  if (existing) {
    await tx.execute(
      `UPDATE song_download_quota_states SET
        override_enabled = ?, daily_limit = ?, weekly_limit = ?, monthly_limit = ?, total_limit = ?,
        day_key = ?, day_used = ?, week_key = ?, week_used = ?, month_key = ?, month_used = ?,
        total_used = ?, updated_at = ?
      WHERE subject_type = ? AND subject_key = ?`,
      [
        input.overrideEnabled ? 1 : 0,
        input.overrideEnabled ? input.dailyLimit : null,
        input.overrideEnabled ? input.weeklyLimit : null,
        input.overrideEnabled ? input.monthlyLimit : null,
        input.overrideEnabled ? input.totalLimit : null,
        periods.dayKey,
        currentDayUsed,
        periods.weekKey,
        currentWeekUsed,
        periods.monthKey,
        currentMonthUsed,
        currentTotalUsed,
        now,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.subjectType,
        input.subjectKey,
        input.overrideEnabled ? 1 : 0,
        input.overrideEnabled ? input.dailyLimit : null,
        input.overrideEnabled ? input.weeklyLimit : null,
        input.overrideEnabled ? input.monthlyLimit : null,
        input.overrideEnabled ? input.totalLimit : null,
        periods.dayKey,
        currentDayUsed,
        periods.weekKey,
        currentWeekUsed,
        periods.monthKey,
        currentMonthUsed,
        currentTotalUsed,
        now,
      ],
    );
  }
}

export async function upsertQuotaStateOverride(input: QuotaOverrideSaveInput): Promise<AdminQuotaStateItem> {
  const db = getAppDb();
  const now = Date.now();
  const periods = getBeijingPeriodKeys(now);

  await db.transaction(async (tx) => {
    await upsertQuotaStateInTx(tx, input, now, periods);
  });

  return getAdminQuotaStateDetail(input.subjectType, input.subjectKey);
}

export async function batchUpsertQuotaStateOverride(
  targets: ReadonlyArray<{ subjectType: SongDownloadSubjectType; subjectKey: string }>,
  patch: Omit<QuotaOverrideSaveInput, "subjectType" | "subjectKey">,
): Promise<{ updatedCount: number }> {
  const db = getAppDb();
  const now = Date.now();
  const periods = getBeijingPeriodKeys(now);

  await db.transaction(async (tx) => {
    for (const target of targets) {
      await upsertQuotaStateInTx(tx, { ...patch, ...target }, now, periods);
    }
  });

  return { updatedCount: targets.length };
}
