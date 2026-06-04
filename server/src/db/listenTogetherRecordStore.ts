import { randomUUID } from "node:crypto";
import { getAppDb } from "./appDb";

export type ListenTogetherRecordReason =
  | "leave"
  | "kick"
  | "offline_timeout"
  | "room_destroyed"
  | "server_restart";

export type CreateListenTogetherRoomRecordInput = {
  roomId: string;
  ownerUserId: string;
  roomName: string;
  maxPeople: number;
  memberOperation: boolean;
  config: Record<string, unknown>;
  startedAt: number;
  finalHostUserId: string;
};

export type CreateListenTogetherUserRecordInput = {
  roomRecordId: string;
  roomId: string;
  userId: string;
  username: string;
  nickname: string;
  avatarUrl: string;
  role: "host" | "member";
  joinedAt: number;
  extra?: Record<string, unknown>;
};

function newId(): string {
  return randomUUID().replace(/-/g, "");
}

function boolToDb(value: boolean): number {
  return value ? 1 : 0;
}

function stringifyJson(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

export function createListenTogetherRoomRecord(input: CreateListenTogetherRoomRecordInput): string {
  const id = newId();
  const configJson = stringifyJson(input.config);
  const now = Date.now();
  getAppDb()
    .prepare(
      `INSERT INTO listen_together_room_records (
        id, room_id, owner_user_id, room_name, max_people, member_operation,
        initial_config_json, latest_config_json, started_at, ended_at, duration_seconds,
        end_reason, final_host_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, '', ?, ?, ?)`,
    )
    .run(
      id,
      input.roomId,
      input.ownerUserId,
      input.roomName,
      input.maxPeople,
      boolToDb(input.memberOperation),
      configJson,
      configJson,
      input.startedAt,
      input.finalHostUserId,
      now,
      now,
    );
  return id;
}

export function updateListenTogetherRoomRecordConfig(
  roomRecordId: string,
  input: {
    roomName: string;
    maxPeople: number;
    memberOperation: boolean;
    latestConfig: Record<string, unknown>;
    finalHostUserId: string;
  },
): void {
  getAppDb()
    .prepare(
      `UPDATE listen_together_room_records
       SET room_name = ?, max_people = ?, member_operation = ?, latest_config_json = ?,
           final_host_user_id = ?, updated_at = ?
       WHERE id = ? AND ended_at IS NULL`,
    )
    .run(
      input.roomName,
      input.maxPeople,
      boolToDb(input.memberOperation),
      stringifyJson(input.latestConfig),
      input.finalHostUserId,
      Date.now(),
      roomRecordId,
    );
}

export function closeListenTogetherRoomRecord(roomRecordId: string, endedAt: number, reason: ListenTogetherRecordReason, finalHostUserId: string): void {
  getAppDb()
    .prepare(
      `UPDATE listen_together_room_records
       SET ended_at = ?,
           duration_seconds = MAX(0, CAST((? - started_at) / 1000 AS INTEGER)),
           end_reason = ?,
           final_host_user_id = ?,
           updated_at = ?
       WHERE id = ? AND ended_at IS NULL`,
    )
    .run(endedAt, endedAt, reason, finalHostUserId, Date.now(), roomRecordId);
}

export function createListenTogetherUserRecord(input: CreateListenTogetherUserRecordInput): string {
  const id = newId();
  const now = Date.now();
  getAppDb()
    .prepare(
      `INSERT INTO listen_together_user_records (
        id, room_record_id, room_id, user_id, username, nickname, avatar_url, role,
        joined_at, left_at, duration_seconds, leave_reason, extra_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, '', ?, ?, ?)`,
    )
    .run(
      id,
      input.roomRecordId,
      input.roomId,
      input.userId,
      input.username,
      input.nickname,
      input.avatarUrl,
      input.role,
      input.joinedAt,
      stringifyJson(input.extra ?? {}),
      now,
      now,
    );
  return id;
}

export function closeListenTogetherUserRecord(userRecordId: string | undefined, leftAt: number, reason: ListenTogetherRecordReason, extra: Record<string, unknown> = {}): void {
  if (!userRecordId) return;
  getAppDb()
    .prepare(
      `UPDATE listen_together_user_records
       SET left_at = ?,
           duration_seconds = MAX(0, CAST((? - joined_at) / 1000 AS INTEGER)),
           leave_reason = ?,
           extra_json = ?,
           updated_at = ?
       WHERE id = ? AND left_at IS NULL`,
    )
    .run(leftAt, leftAt, reason, stringifyJson(extra), Date.now(), userRecordId);
}

export function closeOpenListenTogetherUserRecordsForRoom(
  roomRecordId: string,
  leftAt: number,
  reason: ListenTogetherRecordReason,
  extra: Record<string, unknown> = {},
): void {
  getAppDb()
    .prepare(
      `UPDATE listen_together_user_records
       SET left_at = ?,
           duration_seconds = MAX(0, CAST((? - joined_at) / 1000 AS INTEGER)),
           leave_reason = ?,
           extra_json = ?,
           updated_at = ?
       WHERE room_record_id = ? AND left_at IS NULL`,
    )
    .run(leftAt, leftAt, reason, stringifyJson(extra), Date.now(), roomRecordId);
}

export function repairOpenListenTogetherRecords(): void {
  const now = Date.now();
  const db = getAppDb();
  db.prepare(
    `UPDATE listen_together_user_records
     SET left_at = ?,
         duration_seconds = MAX(0, CAST((? - joined_at) / 1000 AS INTEGER)),
         leave_reason = 'server_restart',
         updated_at = ?
     WHERE left_at IS NULL`,
  ).run(now, now, now);
  db.prepare(
    `UPDATE listen_together_room_records
     SET ended_at = ?,
         duration_seconds = MAX(0, CAST((? - started_at) / 1000 AS INTEGER)),
         end_reason = 'server_restart',
         updated_at = ?
     WHERE ended_at IS NULL`,
  ).run(now, now, now);
}
