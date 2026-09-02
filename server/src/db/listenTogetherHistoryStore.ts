import crypto from "node:crypto";
import { getAppDb } from "./appDb";
import {
  sanitizeSongSnapshot,
  type ListenTogetherMemberLeaveReason,
  type ListenTogetherRoomEndReason,
  type ListenTogetherSong,
  type ListenTogetherSongSnapshot,
  type ListenTogetherStatus,
  type ListenTogetherSocketUser,
} from "../realtime/listenTogether/listenTogetherTypes";

export type AdminRoomMemberHistoryItem = {
  id: string;
  userId: string;
  username: string;
  nickname: string;
  avatarUrl: string;
  role: "host" | "member";
  joinedAt: number;
  lastSeenAt: number;
  leftAt: number | null;
  leaveReason: string | null;
};

export type AdminRoomHistoryListItem = {
  recordId: string;
  roomId: string;
  roomName: string;
  lifecycleStatus: "active" | "closed";
  initialHost: ListenTogetherSocketUser;
  finalHost: ListenTogetherSocketUser;
  maxPeople: number;
  memberOperation: boolean;
  peakPeople: number;
  totalJoinCount: number;
  uniquePeople: number;
  uniqueMembers?: number;
  finalPeople: number;
  createdAt: number;
  updatedAt: number;
  endedAt: number | null;
  durationMs: number;
  endReason: ListenTogetherRoomEndReason | null;
  endedByAdmin: string | null;
  lastSong: ListenTogetherSongSnapshot | null;
  finalPlaybackStatus: ListenTogetherStatus;
  finalPosition: number;
};

export type AdminRoomHistoryDetail = AdminRoomHistoryListItem & {
  members: AdminRoomMemberHistoryItem[];
};

export type AdminRoomHistoryQuery = {
  keyword?: string;
  endReason?: string;
  startedAt?: number;
  endedAt?: number;
  offset: number;
  limit: number;
};

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function openRoomRecord(input: {
  id: string;
  roomId: string;
  roomName: string;
  host: ListenTogetherSocketUser;
  maxPeople: number;
  memberOperation: boolean;
  createdAt: number;
}): void {
  const db = getAppDb();
  const hostJson = JSON.stringify(input.host);
  const memberId = crypto.randomUUID();

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO listen_together_room_records (
        id, room_id, room_name, lifecycle_status,
        initial_host_user_id, initial_host_snapshot_json,
        final_host_user_id, final_host_snapshot_json,
        max_people, member_operation,
        peak_people, total_join_count, unique_people, final_people,
        last_song_snapshot_json, final_playback_status, final_position,
        created_at, updated_at, ended_at, end_reason, ended_by_admin
      ) VALUES (
        ?, ?, ?, 'active',
        ?, ?,
        ?, ?,
        ?, ?,
        1, 1, 1, 1,
        NULL, 'paused', 0,
        ?, ?, NULL, NULL, NULL
      )`,
    ).run(
      input.id,
      input.roomId,
      input.roomName,
      input.host.userId,
      hostJson,
      input.host.userId,
      hostJson,
      input.maxPeople,
      input.memberOperation ? 1 : 0,
      input.createdAt,
      input.createdAt,
    );

    db.prepare(
      `INSERT INTO listen_together_room_members (
        id, room_record_id, user_id, user_snapshot_json,
        role, joined_at, last_seen_at, left_at, leave_reason
      ) VALUES (
        ?, ?, ?, ?,
        'host', ?, ?, NULL, NULL
      )`,
    ).run(
      memberId,
      input.id,
      input.host.userId,
      hostJson,
      input.createdAt,
      input.createdAt,
    );

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function recordMemberJoined(input: {
  roomRecordId: string;
  user: ListenTogetherSocketUser;
  role: "host" | "member";
  joinedAt: number;
}): void {
  const db = getAppDb();
  const userJson = JSON.stringify(input.user);
  const memberId = crypto.randomUUID();

  db.exec("BEGIN");
  try {
    // If there is already an open segment for this user in this room, close it first
    db.prepare(
      `UPDATE listen_together_room_members
       SET left_at = ?, leave_reason = 'replace_existing'
       WHERE room_record_id = ? AND user_id = ? AND left_at IS NULL`,
    ).run(input.joinedAt, input.roomRecordId, input.user.userId);

    db.prepare(
      `INSERT INTO listen_together_room_members (
        id, room_record_id, user_id, user_snapshot_json,
        role, joined_at, last_seen_at, left_at, leave_reason
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, NULL, NULL
      )`,
    ).run(
      memberId,
      input.roomRecordId,
      input.user.userId,
      userJson,
      input.role,
      input.joinedAt,
      input.joinedAt,
    );

    const openCountRow = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM listen_together_room_members WHERE room_record_id = ? AND left_at IS NULL`,
      )
      .get(input.roomRecordId) as { cnt: number };
    const uniqueCountRow = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) as cnt FROM listen_together_room_members WHERE room_record_id = ?`,
      )
      .get(input.roomRecordId) as { cnt: number };
    const totalJoinsRow = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM listen_together_room_members WHERE room_record_id = ?`,
      )
      .get(input.roomRecordId) as { cnt: number };

    db.prepare(
      `UPDATE listen_together_room_records
       SET peak_people = MAX(peak_people, ?),
           total_join_count = ?,
           unique_people = ?,
           final_people = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(
      openCountRow.cnt,
      totalJoinsRow.cnt,
      uniqueCountRow.cnt,
      openCountRow.cnt,
      input.joinedAt,
      input.roomRecordId,
    );

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function recordMemberLeft(input: {
  roomRecordId: string;
  userId: string;
  leftAt: number;
  leaveReason: ListenTogetherMemberLeaveReason;
}): void {
  const db = getAppDb();
  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE listen_together_room_members
       SET left_at = ?, leave_reason = ?
       WHERE room_record_id = ? AND user_id = ? AND left_at IS NULL`,
    ).run(input.leftAt, input.leaveReason, input.roomRecordId, input.userId);

    const openCountRow = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM listen_together_room_members WHERE room_record_id = ? AND left_at IS NULL`,
      )
      .get(input.roomRecordId) as { cnt: number };

    db.prepare(
      `UPDATE listen_together_room_records
       SET final_people = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(openCountRow.cnt, input.leftAt, input.roomRecordId);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function touchMemberLastSeen(input: {
  roomRecordId: string;
  userId: string;
  lastSeenAt: number;
}): void {
  const db = getAppDb();
  db.prepare(
    `UPDATE listen_together_room_members
     SET last_seen_at = ?
     WHERE room_record_id = ? AND user_id = ? AND left_at IS NULL`,
  ).run(input.lastSeenAt, input.roomRecordId, input.userId);
}

export function updateRoomRecordSnapshot(input: {
  roomRecordId: string;
  roomName?: string;
  host?: ListenTogetherSocketUser;
  maxPeople?: number;
  memberOperation?: boolean;
  song?: ListenTogetherSong | null;
  playbackStatus?: ListenTogetherStatus;
  position?: number;
  updatedAt: number;
}): void {
  const db = getAppDb();
  const sets: string[] = ["updated_at = ?"];
  const params: (string | number | null)[] = [input.updatedAt];

  if (input.roomName !== undefined) {
    sets.push("room_name = ?");
    params.push(input.roomName);
  }
  if (input.host !== undefined) {
    sets.push("final_host_user_id = ?");
    sets.push("final_host_snapshot_json = ?");
    params.push(input.host.userId, JSON.stringify(input.host));
  }
  if (input.maxPeople !== undefined) {
    sets.push("max_people = ?");
    params.push(input.maxPeople);
  }
  if (input.memberOperation !== undefined) {
    sets.push("member_operation = ?");
    params.push(input.memberOperation ? 1 : 0);
  }
  if (input.song !== undefined) {
    sets.push("last_song_snapshot_json = ?");
    const sanitized = sanitizeSongSnapshot(input.song);
    params.push(sanitized ? JSON.stringify(sanitized) : null);
  }
  if (input.playbackStatus !== undefined) {
    sets.push("final_playback_status = ?");
    params.push(input.playbackStatus);
  }
  if (input.position !== undefined) {
    sets.push("final_position = ?");
    params.push(input.position);
  }

  params.push(input.roomRecordId);
  db.prepare(
    `UPDATE listen_together_room_records SET ${sets.join(", ")} WHERE id = ?`,
  ).run(...params);
}

export function closeRoomRecord(input: {
  roomRecordId: string;
  endedAt: number;
  endReason: ListenTogetherRoomEndReason;
  endedByAdmin?: string;
  finalHost?: ListenTogetherSocketUser;
  lastSong?: ListenTogetherSong | null;
  finalPlaybackStatus?: ListenTogetherStatus;
  finalPosition?: number;
}): void {
  const db = getAppDb();
  db.exec("BEGIN");
  try {
    const leaveReason = input.endReason === "admin_dissolved" ? "admin_dissolved" : "left";

    // Close any unclosed member segments
    db.prepare(
      `UPDATE listen_together_room_members
       SET left_at = ?, leave_reason = COALESCE(leave_reason, ?)
       WHERE room_record_id = ? AND left_at IS NULL`,
    ).run(input.endedAt, leaveReason, input.roomRecordId);

    const sets: string[] = [
      "lifecycle_status = 'closed'",
      "ended_at = ?",
      "end_reason = ?",
      "ended_by_admin = ?",
      "final_people = 0",
      "updated_at = ?",
    ];
    const params: (string | number | null)[] = [
      input.endedAt,
      input.endReason,
      input.endedByAdmin || null,
      input.endedAt,
    ];

    if (input.finalHost) {
      sets.push("final_host_user_id = ?");
      sets.push("final_host_snapshot_json = ?");
      params.push(input.finalHost.userId, JSON.stringify(input.finalHost));
    }
    if (input.lastSong !== undefined) {
      sets.push("last_song_snapshot_json = ?");
      const sanitized = sanitizeSongSnapshot(input.lastSong);
      params.push(sanitized ? JSON.stringify(sanitized) : null);
    }
    if (input.finalPlaybackStatus !== undefined) {
      sets.push("final_playback_status = ?");
      params.push(input.finalPlaybackStatus);
    }
    if (input.finalPosition !== undefined) {
      sets.push("final_position = ?");
      params.push(input.finalPosition);
    }

    params.push(input.roomRecordId);
    db.prepare(
      `UPDATE listen_together_room_records SET ${sets.join(", ")} WHERE id = ?`,
    ).run(...params);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function closeStaleActiveRoomRecords(endedAt: number): number {
  const db = getAppDb();
  db.exec("BEGIN");
  try {
    const activeRows = db
      .prepare(`SELECT id FROM listen_together_room_records WHERE lifecycle_status = 'active'`)
      .all() as { id: string }[];

    if (activeRows.length === 0) {
      db.exec("COMMIT");
      return 0;
    }

    for (const row of activeRows) {
      db.prepare(
        `UPDATE listen_together_room_members
         SET left_at = ?, leave_reason = 'server_restart'
         WHERE room_record_id = ? AND left_at IS NULL`,
      ).run(endedAt, row.id);

      db.prepare(
        `UPDATE listen_together_room_records
         SET lifecycle_status = 'closed',
             ended_at = ?,
             end_reason = 'server_restart',
             final_people = 0,
             updated_at = ?
         WHERE id = ?`,
      ).run(endedAt, endedAt, row.id);
    }

    db.exec("COMMIT");
    return activeRows.length;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

type DbRoomRecordRow = {
  id: string;
  room_id: string;
  room_name: string;
  lifecycle_status: "active" | "closed";
  initial_host_user_id: string;
  initial_host_snapshot_json: string;
  final_host_user_id: string;
  final_host_snapshot_json: string;
  max_people: number;
  member_operation: number;
  peak_people: number;
  total_join_count: number;
  unique_people: number;
  final_people: number;
  last_song_snapshot_json: string | null;
  final_playback_status: ListenTogetherStatus;
  final_position: number;
  created_at: number;
  updated_at: number;
  ended_at: number | null;
  end_reason: ListenTogetherRoomEndReason | null;
  ended_by_admin: string | null;
};

type DbRoomMemberRow = {
  id: string;
  room_record_id: string;
  user_id: string;
  user_snapshot_json: string;
  role: "host" | "member";
  joined_at: number;
  last_seen_at: number;
  left_at: number | null;
  leave_reason: string | null;
};

function mapRowToItem(row: DbRoomRecordRow): AdminRoomHistoryListItem {
  const initialHost = parseJsonSafe<ListenTogetherSocketUser>(
    row.initial_host_snapshot_json,
    { userId: row.initial_host_user_id, username: "", nickname: "", avatarUrl: "" },
  );
  const finalHost = parseJsonSafe<ListenTogetherSocketUser>(
    row.final_host_snapshot_json,
    initialHost,
  );
  const lastSong = parseJsonSafe<ListenTogetherSongSnapshot | null>(
    row.last_song_snapshot_json,
    null,
  );
  const endedAt = row.ended_at;
  const durationMs = endedAt ? Math.max(0, endedAt - row.created_at) : Math.max(0, row.updated_at - row.created_at);

  return {
    recordId: row.id,
    roomId: row.room_id,
    roomName: row.room_name,
    lifecycleStatus: row.lifecycle_status,
    initialHost,
    finalHost,
    maxPeople: row.max_people,
    memberOperation: Boolean(row.member_operation),
    peakPeople: row.peak_people,
    totalJoinCount: row.total_join_count,
    uniquePeople: row.unique_people,
    uniqueMembers: row.unique_people,
    finalPeople: row.final_people,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    endedAt,
    durationMs,
    endReason: row.end_reason,
    endedByAdmin: row.ended_by_admin,
    lastSong,
    finalPlaybackStatus: row.final_playback_status,
    finalPosition: row.final_position,
  };
}

export function listRoomHistory(query: AdminRoomHistoryQuery): {
  items: AdminRoomHistoryListItem[];
  total: number;
  offset: number;
  limit: number;
} {
  const db = getAppDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.keyword && query.keyword.trim()) {
    const kw = `%${query.keyword.trim()}%`;
    conditions.push(
      `(room_id LIKE ? OR room_name LIKE ? OR id LIKE ? OR final_host_user_id LIKE ? OR initial_host_snapshot_json LIKE ? OR final_host_snapshot_json LIKE ?)`,
    );
    params.push(kw, kw, kw, kw, kw, kw);
  }

  if (query.endReason && query.endReason.trim()) {
    conditions.push("end_reason = ?");
    params.push(query.endReason.trim());
  }

  if (typeof query.startedAt === "number" && Number.isFinite(query.startedAt)) {
    conditions.push("created_at >= ?");
    params.push(query.startedAt);
  }

  if (typeof query.endedAt === "number" && Number.isFinite(query.endedAt)) {
    conditions.push("ended_at <= ?");
    params.push(query.endedAt);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM listen_together_room_records ${whereClause}`)
    .get(...params) as { total: number };

  const limit = Math.max(1, Math.min(100, query.limit || 20));
  const offset = Math.max(0, query.offset || 0);

  const rows = db
    .prepare(
      `SELECT * FROM listen_together_room_records
       ${whereClause}
       ORDER BY ended_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as unknown as DbRoomRecordRow[];

  return {
    items: rows.map(mapRowToItem),
    total: countRow.total,
    offset,
    limit,
  };
}

export function readRoomHistoryDetail(roomRecordId: string): AdminRoomHistoryDetail | null {
  const db = getAppDb();
  const recordRow = db
    .prepare(`SELECT * FROM listen_together_room_records WHERE id = ?`)
    .get(roomRecordId) as unknown as DbRoomRecordRow | undefined;

  if (!recordRow) return null;

  const memberRows = db
    .prepare(
      `SELECT * FROM listen_together_room_members
       WHERE room_record_id = ?
       ORDER BY joined_at ASC`,
    )
    .all(roomRecordId) as unknown as DbRoomMemberRow[];

  const members: AdminRoomMemberHistoryItem[] = memberRows.map((row) => {
    const user = parseJsonSafe<ListenTogetherSocketUser>(row.user_snapshot_json, {
      userId: row.user_id,
      username: "",
      nickname: "",
      avatarUrl: "",
    });
    return {
      id: row.id,
      userId: row.user_id,
      username: user.username,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      role: row.role,
      joinedAt: row.joined_at,
      lastSeenAt: row.last_seen_at,
      leftAt: row.left_at,
      leaveReason: row.leave_reason,
    };
  });

  return {
    ...mapRowToItem(recordRow),
    members,
  };
}
