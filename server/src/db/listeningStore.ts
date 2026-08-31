import { type DatabaseSync } from "node:sqlite";
import { getAppDb } from "./appDb";

export type ListeningSource = "kg" | "wy" | "kw" | "cloud" | "local";

export type StoredListeningFragment = {
  userId: string;
  deviceId: string;
  eventId: string;
  playSessionId: string;
  platform: "android" | "desktop";
  source: ListeningSource;
  songId: string;
  title: string;
  artist: string;
  album: string;
  trackDurationMs: number | null;
  startedAtMs: number;
  endedAtMs: number;
  activeDurationMs: number;
  terminalReason: string | null;
  payloadJson: string;
};

export type CoverageMergeResult = {
  startMs: number;
  endMs: number;
  creditedMs: number;
};

export type ListeningLevelRule = {
  level: number;
  minMinutes: number;
  maxMinutes: number | null;
};

export type ListeningLevelConfig = {
  version: number;
  updatedAt: number;
  rules: ListeningLevelRule[];
};

export type ListeningTrackStat = {
  source: ListeningSource;
  songId: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number | null;
  listenedMs: number;
  playCount: number;
  completedCount: number;
  firstListenedAt: number;
  lastListenedAt: number;
};

export type ListeningTrackPage = {
  items: ListeningTrackStat[];
  total: number;
  offset: number;
  limit: number;
};

export class ListeningLevelVersionConflictError extends Error {
  constructor() {
    super("听歌等级配置已被其他管理员更新，请刷新后重试");
    this.name = "ListeningLevelVersionConflictError";
  }
}

type IntervalRow = { start_ms: number; end_ms: number };

function db(): DatabaseSync {
  return getAppDb();
}

export function runListeningTransaction<T>(fn: () => T): T {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function mergeCoverage(existing: readonly (readonly [number, number])[], incoming: readonly [number, number]): CoverageMergeResult {
  let startMs = incoming[0];
  let endMs = incoming[1];
  const connected: Array<readonly [number, number]> = [];
  for (const [start, end] of [...existing].sort((left, right) => left[0] - right[0])) {
    if (end < startMs || start > endMs) continue;
    startMs = Math.min(startMs, start);
    endMs = Math.max(endMs, end);
    connected.push([start, end]);
  }
  let oldCoverage = 0;
  let coveredStart: number | null = null;
  let coveredEnd = 0;
  for (const [start, end] of connected) {
    if (coveredStart === null) {
      coveredStart = start;
      coveredEnd = end;
    } else if (start <= coveredEnd) {
      coveredEnd = Math.max(coveredEnd, end);
    } else {
      oldCoverage += coveredEnd - coveredStart;
      coveredStart = start;
      coveredEnd = end;
    }
  }
  if (coveredStart !== null) oldCoverage += coveredEnd - coveredStart;
  return { startMs, endMs, creditedMs: endMs - startMs - oldCoverage };
}

export function insertFragmentIfAbsent(fragment: StoredListeningFragment): "inserted" | "duplicate" | "conflict" {
  const database = db();
  const existing = database.prepare(
    `SELECT payload_json FROM listening_fragments
     WHERE user_id = ? AND device_id = ? AND event_id = ?`,
  ).get(fragment.userId, fragment.deviceId, fragment.eventId) as { payload_json: string } | undefined;
  if (existing) return existing.payload_json === fragment.payloadJson ? "duplicate" : "conflict";

  database.prepare(
    `INSERT INTO listening_fragments (
      user_id, device_id, event_id, play_session_id, platform, source, song_id,
      title, artist, album, track_duration_ms, start_ms, end_ms, active_duration_ms,
      terminal_reason, payload_json, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    fragment.userId, fragment.deviceId, fragment.eventId, fragment.playSessionId,
    fragment.platform, fragment.source, fragment.songId, fragment.title, fragment.artist,
    fragment.album, fragment.trackDurationMs, fragment.startedAtMs, fragment.endedAtMs,
    fragment.activeDurationMs, fragment.terminalReason, fragment.payloadJson, Date.now(),
  );
  return "inserted";
}

export function isPlaySessionCompatible(fragment: Pick<StoredListeningFragment, "userId" | "deviceId" | "playSessionId" | "source" | "songId">): boolean {
  const current = db().prepare(
    `SELECT source, song_id FROM listening_play_sessions
     WHERE user_id = ? AND device_id = ? AND play_session_id = ?`,
  ).get(fragment.userId, fragment.deviceId, fragment.playSessionId) as { source: ListeningSource; song_id: string } | undefined;
  return !current || (current.source === fragment.source && current.song_id === fragment.songId);
}

function mergeInterval(
  selectSql: string,
  deleteSql: string,
  insertSql: string,
  params: readonly (string | number)[],
  startMs: number,
  endMs: number,
): CoverageMergeResult {
  const database = db();
  const rows = database.prepare(selectSql).all(...params, endMs, startMs) as IntervalRow[];
  const merged = mergeCoverage(rows.map((row) => [row.start_ms, row.end_ms] as const), [startMs, endMs]);
  if (rows.length > 0) database.prepare(deleteSql).run(...params, endMs, startMs);
  database.prepare(insertSql).run(...params, merged.startMs, merged.endMs);
  return merged;
}

export function mergeUserInterval(userId: string, startMs: number, endMs: number): CoverageMergeResult {
  return mergeInterval(
    `SELECT start_ms, end_ms FROM user_listening_intervals
     WHERE user_id = ? AND start_ms <= ? AND end_ms >= ?`,
    `DELETE FROM user_listening_intervals
     WHERE user_id = ? AND start_ms <= ? AND end_ms >= ?`,
    "INSERT INTO user_listening_intervals (user_id, start_ms, end_ms) VALUES (?, ?, ?)",
    [userId], startMs, endMs,
  );
}

export function mergeTrackInterval(userId: string, source: ListeningSource, songId: string, startMs: number, endMs: number): CoverageMergeResult {
  return mergeInterval(
    `SELECT start_ms, end_ms FROM user_track_listening_intervals
     WHERE user_id = ? AND source = ? AND song_id = ? AND start_ms <= ? AND end_ms >= ?`,
    `DELETE FROM user_track_listening_intervals
     WHERE user_id = ? AND source = ? AND song_id = ? AND start_ms <= ? AND end_ms >= ?`,
    `INSERT INTO user_track_listening_intervals (user_id, source, song_id, start_ms, end_ms)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, source, songId], startMs, endMs,
  );
}

export function addListeningTotal(userId: string, creditedMs: number, updatedAt: number): void {
  const database = db();
  database.prepare(
    `INSERT INTO user_listening_stats (user_id, total_ms, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET total_ms = total_ms + excluded.total_ms, updated_at = excluded.updated_at`,
  ).run(userId, creditedMs, updatedAt);
}

export function upsertTrackStat(
  fragment: StoredListeningFragment,
  creditedMs: number,
  playCountIncrement: number,
  completedCountIncrement: number,
): void {
  const now = Date.now();
  const database = db();
  database.prepare(
    `INSERT INTO user_track_stats (
      user_id, source, song_id, title, artist, album, duration_ms, listened_ms,
      play_count, completed_count, first_listened_at, last_listened_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, source, song_id) DO UPDATE SET
      title = CASE WHEN excluded.title <> '' THEN excluded.title ELSE title END,
      artist = CASE WHEN excluded.artist <> '' THEN excluded.artist ELSE artist END,
      album = CASE WHEN excluded.album <> '' THEN excluded.album ELSE album END,
      duration_ms = COALESCE(excluded.duration_ms, duration_ms),
      listened_ms = listened_ms + excluded.listened_ms,
      play_count = play_count + excluded.play_count,
      completed_count = completed_count + excluded.completed_count,
      first_listened_at = MIN(first_listened_at, excluded.first_listened_at),
      last_listened_at = MAX(last_listened_at, excluded.last_listened_at),
      updated_at = excluded.updated_at`,
  ).run(
    fragment.userId, fragment.source, fragment.songId, fragment.title, fragment.artist,
    fragment.album, fragment.trackDurationMs, creditedMs, playCountIncrement,
    completedCountIncrement, fragment.startedAtMs, fragment.endedAtMs, now,
  );
}

type SessionRow = {
  source: ListeningSource;
  song_id: string;
  track_duration_ms: number | null;
  accumulated_ms: number;
  qualified_counted: number;
  completed_counted: number;
  natural_end_seen: number;
};

export function upsertPlaySession(fragment: StoredListeningFragment): { playCountIncrement: number; completedCountIncrement: number } {
  const database = db();
  const current = database.prepare(
    `SELECT source, song_id, track_duration_ms, accumulated_ms, qualified_counted, completed_counted, natural_end_seen
     FROM listening_play_sessions WHERE user_id = ? AND device_id = ? AND play_session_id = ?`,
  ).get(fragment.userId, fragment.deviceId, fragment.playSessionId) as SessionRow | undefined;

  const terminalNaturalEnd = fragment.terminalReason === "natural_end";
  if (!current) {
    const accumulatedMs = fragment.activeDurationMs;
    const thresholdMs = qualifiedThreshold(fragment.trackDurationMs);
    const qualified = accumulatedMs >= thresholdMs;
    const completed = qualified && terminalNaturalEnd;
    database.prepare(
      `INSERT INTO listening_play_sessions (
        user_id, device_id, play_session_id, source, song_id, track_duration_ms,
        accumulated_ms, qualified_counted, completed_counted, natural_end_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      fragment.userId, fragment.deviceId, fragment.playSessionId, fragment.source, fragment.songId,
      fragment.trackDurationMs, accumulatedMs, qualified ? 1 : 0, completed ? 1 : 0, terminalNaturalEnd ? 1 : 0,
    );
    return { playCountIncrement: qualified ? 1 : 0, completedCountIncrement: completed ? 1 : 0 };
  }
  if (current.source !== fragment.source || current.song_id !== fragment.songId) {
    throw new Error("同一播放会话不能关联不同歌曲");
  }
  const durationMs = fragment.trackDurationMs ?? current.track_duration_ms;
  const accumulatedMs = current.accumulated_ms + fragment.activeDurationMs;
  const naturalEndSeen = current.natural_end_seen !== 0 || terminalNaturalEnd;
  const qualified = current.qualified_counted !== 0 || accumulatedMs >= qualifiedThreshold(durationMs);
  const completed = current.completed_counted !== 0 || (qualified && naturalEndSeen);
  database.prepare(
    `UPDATE listening_play_sessions
     SET track_duration_ms = ?, accumulated_ms = ?, qualified_counted = ?, completed_counted = ?, natural_end_seen = ?
     WHERE user_id = ? AND device_id = ? AND play_session_id = ?`,
  ).run(
    durationMs, accumulatedMs, qualified ? 1 : 0, completed ? 1 : 0, naturalEndSeen ? 1 : 0,
    fragment.userId, fragment.deviceId, fragment.playSessionId,
  );
  return {
    playCountIncrement: !current.qualified_counted && qualified ? 1 : 0,
    completedCountIncrement: !current.completed_counted && completed ? 1 : 0,
  };
}

function qualifiedThreshold(trackDurationMs: number | null): number {
  return trackDurationMs && trackDurationMs > 0
    ? Math.min(30_000, Math.max(1, Math.floor(trackDurationMs * 0.5)))
    : 30_000;
}

export function readListeningSummaryState(userId: string): { totalMs: number } {
  const row = db().prepare("SELECT total_ms FROM user_listening_stats WHERE user_id = ?").get(userId) as { total_ms: number } | undefined;
  return { totalMs: row?.total_ms ?? 0 };
}

export function listTrackStats(
  userId: string,
  query: { source?: ListeningSource; sort: "listenedMs" | "playCount" | "lastListenedAt"; offset: number; limit: number },
): ListeningTrackPage {
  const database = db();
  const where = query.source ? "WHERE user_id = ? AND source = ?" : "WHERE user_id = ?";
  const params: (string | number)[] = query.source ? [userId, query.source] : [userId];
  const count = database.prepare(`SELECT COUNT(*) AS total FROM user_track_stats ${where}`).get(...params) as { total: number };
  const orderBy = query.sort === "playCount"
    ? "play_count DESC, last_listened_at DESC"
    : query.sort === "lastListenedAt"
      ? "last_listened_at DESC"
      : "listened_ms DESC, last_listened_at DESC";
  const rows = database.prepare(
    `SELECT * FROM user_track_stats ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
  ).all(...params, query.limit, query.offset) as Array<{
    source: ListeningSource; song_id: string; title: string; artist: string; album: string;
    duration_ms: number | null; listened_ms: number; play_count: number; completed_count: number;
    first_listened_at: number; last_listened_at: number;
  }>;
  return {
    items: rows.map((row) => ({
      source: row.source, songId: row.song_id, title: row.title, artist: row.artist, album: row.album,
      durationMs: row.duration_ms, listenedMs: row.listened_ms, playCount: row.play_count,
      completedCount: row.completed_count, firstListenedAt: row.first_listened_at, lastListenedAt: row.last_listened_at,
    })),
    total: count.total,
    offset: query.offset,
    limit: query.limit,
  };
}

export function readLevelConfig(): ListeningLevelConfig {
  const database = db();
  const config = database.prepare("SELECT version, updated_at FROM listening_level_config WHERE id = 1").get() as { version: number; updated_at: number };
  const rules = database.prepare(
    "SELECT level, min_minutes, max_minutes FROM listening_level_rules ORDER BY level ASC",
  ).all() as Array<{ level: number; min_minutes: number; max_minutes: number | null }>;
  return {
    version: config.version,
    updatedAt: config.updated_at,
    rules: rules.map((row) => ({ level: row.level, minMinutes: row.min_minutes, maxMinutes: row.max_minutes })),
  };
}

export function replaceLevelConfig(expectedVersion: number, rules: readonly ListeningLevelRule[]): ListeningLevelConfig {
  return runListeningTransaction(() => {
    const database = db();
    const current = database.prepare("SELECT version FROM listening_level_config WHERE id = 1").get() as { version: number };
    if (current.version !== expectedVersion) throw new ListeningLevelVersionConflictError();
    const now = Date.now();
    database.prepare("DELETE FROM listening_level_rules").run();
    const insert = database.prepare(
      "INSERT INTO listening_level_rules (level, min_minutes, max_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    );
    for (const rule of rules) insert.run(rule.level, rule.minMinutes, rule.maxMinutes, now, now);
    database.prepare("UPDATE listening_level_config SET version = version + 1, updated_at = ? WHERE id = 1").run(now);
    return readLevelConfig();
  });
}
