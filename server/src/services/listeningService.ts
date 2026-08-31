import {
  addListeningTotal,
  insertFragmentIfAbsent,
  isPlaySessionCompatible,
  listTrackStats,
  mergeTrackInterval,
  mergeUserInterval,
  readLevelConfig,
  readListeningSummaryState,
  replaceLevelConfig,
  runListeningTransaction,
  upsertPlaySession,
  upsertTrackStat,
  type ListeningLevelConfig,
  type ListeningLevelRule,
  type ListeningSource,
  type ListeningTrackPage,
  type StoredListeningFragment,
} from "../db/listeningStore";

const SOURCES: readonly ListeningSource[] = ["kg", "wy", "kw", "cloud", "local"];
const PLATFORMS = ["android", "desktop"] as const;
const TERMINAL_REASONS = ["natural_end", "manual_next", "stop", "error", "app_exit"] as const;
const MAX_FRAGMENT_DURATION_MS = 16 * 60_000;
const MAX_FUTURE_MS = 5 * 60_000;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export type ListeningAuth = {
  userId: string;
  deviceId: string;
};

export type ListeningLevel = ListeningLevelRule;

export type ListeningSummary = {
  totalMs: number;
  totalMinutes: number;
  level: ListeningLevel;
};

export type ListeningTrackQuery = {
  source?: ListeningSource;
  sort?: "listenedMs" | "playCount" | "lastListenedAt";
  offset?: number;
  limit?: number;
};

export type ListeningIngestResult = {
  acceptedEventIds: string[];
  duplicateEventIds: string[];
  rejected: Array<{ eventId: string; reason: string }>;
  summary: ListeningSummary;
  serverTimeMs: number;
};

export class ListeningValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListeningValidationError";
  }
}

type NormalizedBatch = {
  platform: "android" | "desktop";
  fragments: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireSafeInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new ListeningValidationError(`${name} 必须是整数毫秒时间戳`);
  return value;
}

function optionalText(value: unknown, name: string, max: number): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new ListeningValidationError(`${name} 必须是字符串`);
  const normalized = value.trim();
  if (normalized.length > max) throw new ListeningValidationError(`${name} 长度不能超过 ${max}`);
  return normalized;
}

function requiredId(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") throw new ListeningValidationError(`${name} 必须是字符串`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || !ID_RE.test(normalized)) {
    throw new ListeningValidationError(`${name} 格式不正确`);
  }
  return normalized;
}

function requiredOpaqueText(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") throw new ListeningValidationError(`${name} 必须是字符串`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new ListeningValidationError(`${name} 格式不正确`);
  return normalized;
}

function normalizeBatch(input: unknown): NormalizedBatch {
  if (!isRecord(input)) throw new ListeningValidationError("请求体必须是对象");
  if (input.schemaVersion !== 1) throw new ListeningValidationError("仅支持 schemaVersion=1");
  if (typeof input.platform !== "string" || !PLATFORMS.includes(input.platform as "android" | "desktop")) {
    throw new ListeningValidationError("platform 必须是 android 或 desktop");
  }
  if (!Array.isArray(input.fragments) || input.fragments.length < 1 || input.fragments.length > 200) {
    throw new ListeningValidationError("fragments 数量必须在 1 到 200 之间");
  }
  return { platform: input.platform as "android" | "desktop", fragments: input.fragments };
}

function normalizeFragment(auth: ListeningAuth, platform: "android" | "desktop", raw: unknown, now: number): StoredListeningFragment {
  if (!isRecord(raw)) throw new ListeningValidationError("fragment 必须是对象");
  const eventId = requiredId(raw.eventId, "eventId", 128);
  const playSessionId = requiredId(raw.playSessionId, "playSessionId", 128);
  const sourceValue = typeof raw.source === "string" ? raw.source.trim().toLowerCase() : "";
  if (!SOURCES.includes(sourceValue as ListeningSource)) throw new ListeningValidationError("source 不受支持");
  const source = sourceValue as ListeningSource;
  const songId = requiredOpaqueText(raw.songId, "songId", 256);
  if (source === "local" && (/^(content:|file:)/i.test(songId) || songId.includes("/") || songId.includes("\\"))) {
    throw new ListeningValidationError("本地歌曲 ID 必须是不透明标识");
  }
  const startedAtMs = requireSafeInteger(raw.startedAtMs, "startedAtMs");
  const endedAtMs = requireSafeInteger(raw.endedAtMs, "endedAtMs");
  const activeDurationMs = requireSafeInteger(raw.activeDurationMs, "activeDurationMs");
  if (endedAtMs <= startedAtMs) throw new ListeningValidationError("endedAtMs 必须晚于 startedAtMs");
  if (activeDurationMs <= 0) throw new ListeningValidationError("activeDurationMs 必须大于 0");
  if (endedAtMs - startedAtMs > MAX_FRAGMENT_DURATION_MS) throw new ListeningValidationError("连续播放片段不能超过 16 分钟");
  if (Math.abs((endedAtMs - startedAtMs) - activeDurationMs) > 5_000) {
    throw new ListeningValidationError("activeDurationMs 与时间区间差异不能超过 5 秒");
  }
  if (startedAtMs > now + MAX_FUTURE_MS || endedAtMs > now + MAX_FUTURE_MS) {
    throw new ListeningValidationError("播放时间不能超过服务端当前时间 5 分钟");
  }
  const trackDurationMs = raw.trackDurationMs == null ? null : requireSafeInteger(raw.trackDurationMs, "trackDurationMs");
  if (trackDurationMs !== null && trackDurationMs <= 0) throw new ListeningValidationError("trackDurationMs 必须大于 0");
  const terminalReason = raw.terminalReason == null ? null : optionalText(raw.terminalReason, "terminalReason", 32);
  if (terminalReason !== null && !TERMINAL_REASONS.includes(terminalReason as typeof TERMINAL_REASONS[number])) {
    throw new ListeningValidationError("terminalReason 不受支持");
  }
  const fragment = {
    userId: auth.userId,
    deviceId: auth.deviceId,
    eventId,
    playSessionId,
    platform,
    source,
    songId,
    title: optionalText(raw.title, "title", 512),
    artist: optionalText(raw.artist, "artist", 512),
    album: optionalText(raw.album, "album", 512),
    trackDurationMs,
    startedAtMs,
    endedAtMs,
    activeDurationMs,
    terminalReason,
  } satisfies Omit<StoredListeningFragment, "payloadJson">;
  return { ...fragment, payloadJson: JSON.stringify(fragment) };
}

function rejectedEventId(raw: unknown): string {
  return isRecord(raw) && typeof raw.eventId === "string" ? raw.eventId.trim().slice(0, 128) : "";
}

function normalizedEventId(raw: unknown): string | null {
  try {
    return isRecord(raw) ? requiredId(raw.eventId, "eventId", 128) : null;
  } catch {
    return null;
  }
}

export function ingestListeningBatch(auth: ListeningAuth, input: unknown): ListeningIngestResult {
  if (!auth.userId || !auth.deviceId) throw new ListeningValidationError("缺少账号或设备身份");
  const batch = normalizeBatch(input);
  const now = Date.now();
  const acceptedEventIds: string[] = [];
  const duplicateEventIds: string[] = [];
  const rejected: Array<{ eventId: string; reason: string }> = [];
  const grouped = new Map<string, unknown[]>();
  for (const raw of batch.fragments) {
    const eventId = normalizedEventId(raw);
    if (!eventId) {
      rejected.push({ eventId: rejectedEventId(raw), reason: "eventId 格式不正确" });
      continue;
    }
    const group = grouped.get(eventId) ?? [];
    group.push(raw);
    grouped.set(eventId, group);
  }
  const candidates: StoredListeningFragment[] = [];
  for (const [eventId, group] of grouped) {
    const normalized: StoredListeningFragment[] = [];
    let errorMessage: string | null = null;
    for (const raw of group) {
      try {
        normalized.push(normalizeFragment(auth, batch.platform, raw, now));
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "片段无效";
        break;
      }
    }
    if (errorMessage) {
      rejected.push({ eventId, reason: errorMessage });
      continue;
    }
    if (new Set(normalized.map((fragment) => fragment.payloadJson)).size > 1) {
      rejected.push({ eventId, reason: "同一批次 eventId 不能对应不同播放片段" });
      continue;
    }
    candidates.push(normalized[0]);
  }

  runListeningTransaction(() => {
    for (const candidate of candidates) {
      if (!isPlaySessionCompatible(candidate)) {
        rejected.push({ eventId: candidate.eventId, reason: "同一播放会话不能关联不同歌曲" });
        continue;
      }
      const result = insertFragmentIfAbsent(candidate);
      if (result === "duplicate") {
        duplicateEventIds.push(candidate.eventId);
        continue;
      }
      if (result === "conflict") {
        rejected.push({ eventId: candidate.eventId, reason: "eventId 已用于不同播放片段" });
        continue;
      }
      const userCoverage = mergeUserInterval(candidate.userId, candidate.startedAtMs, candidate.endedAtMs);
      const trackCoverage = mergeTrackInterval(
        candidate.userId, candidate.source, candidate.songId,
        candidate.startedAtMs, candidate.endedAtMs,
      );
      addListeningTotal(candidate.userId, userCoverage.creditedMs, now);
      const sessionCounts = upsertPlaySession(candidate);
      upsertTrackStat(candidate, trackCoverage.creditedMs, sessionCounts.playCountIncrement, sessionCounts.completedCountIncrement);
      acceptedEventIds.push(candidate.eventId);
    }
  });

  return {
    acceptedEventIds,
    duplicateEventIds,
    rejected,
    summary: getListeningSummary(auth.userId),
    serverTimeMs: now,
  };
}

export function getListeningSummary(userId: string): ListeningSummary {
  const { totalMs } = readListeningSummaryState(userId);
  const totalMinutes = Math.floor(totalMs / 60_000);
  const config = readLevelConfig();
  const level = config.rules.find((rule) => totalMinutes >= rule.minMinutes && (rule.maxMinutes === null || totalMinutes <= rule.maxMinutes));
  if (!level) throw new Error("听歌等级配置未覆盖当前累计分钟");
  return { totalMs, totalMinutes, level };
}

export function getListeningTracks(userId: string, query: ListeningTrackQuery): ListeningTrackPage {
  const source = query.source && SOURCES.includes(query.source) ? query.source : undefined;
  const sort = query.sort === "playCount" || query.sort === "lastListenedAt" ? query.sort : "listenedMs";
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
  return listTrackStats(userId, { source, sort, offset, limit });
}

export function getListeningLevelConfig(): ListeningLevelConfig {
  return readLevelConfig();
}

function normalizeLevelRules(input: unknown): { expectedVersion: number; rules: ListeningLevelRule[] } {
  if (!isRecord(input)) throw new ListeningValidationError("请求体必须是对象");
  if (typeof input.expectedVersion !== "number" || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new ListeningValidationError("expectedVersion 必须是正整数");
  }
  if (!Array.isArray(input.rules) || input.rules.length < 1 || input.rules.length > 100) {
    throw new ListeningValidationError("rules 数量必须在 1 到 100 之间");
  }
  const inputRules = input.rules;
  const rules: ListeningLevelRule[] = [];
  for (let index = 0; index < inputRules.length; index += 1) {
    const raw = inputRules[index];
    if (!isRecord(raw)) throw new ListeningValidationError("等级规则必须是对象");
    const level = raw.level;
    const minMinutes = raw.minMinutes;
    const maxMinutes = raw.maxMinutes;
    if (typeof level !== "number" || !Number.isSafeInteger(level) || level !== index + 1) throw new ListeningValidationError("等级必须从 1 开始连续编号");
    if (typeof minMinutes !== "number" || !Number.isSafeInteger(minMinutes) || minMinutes < 0) throw new ListeningValidationError("等级起始分钟必须是非负整数");
    if (maxMinutes !== null && (typeof maxMinutes !== "number" || !Number.isSafeInteger(maxMinutes) || maxMinutes < minMinutes)) {
      throw new ListeningValidationError("等级结束分钟必须是不小于起始分钟的整数或 null");
    }
    if (index === 0 && minMinutes !== 0) throw new ListeningValidationError("第一等级必须从 0 分钟开始");
    if (index > 0) {
      const previous = rules[index - 1];
      if (previous.maxMinutes === null || minMinutes !== previous.maxMinutes + 1) {
        throw new ListeningValidationError("等级区间必须连续且不能重叠");
      }
    }
    if (maxMinutes === null && index !== inputRules.length - 1) throw new ListeningValidationError("只有最后一级允许无上限");
    rules.push({ level, minMinutes, maxMinutes });
  }
  if (rules[rules.length - 1].maxMinutes !== null) throw new ListeningValidationError("最后一级必须设置为无上限");
  return { expectedVersion: input.expectedVersion, rules };
}

export function saveListeningLevelConfig(input: unknown): ListeningLevelConfig {
  const normalized = normalizeLevelRules(input);
  return replaceLevelConfig(normalized.expectedVersion, normalized.rules);
}
