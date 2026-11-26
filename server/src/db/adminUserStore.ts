import { detachDeletedUserCovers } from "./playlistCoverStore";
import { deleteSubjectQuotaState } from "./songDownloadStore";
import { lockSyncUser } from "./syncStore";
import { type DbClient as DatabaseSync } from "./core/types";
import {
  applyVipGrantInTx,
  isAccountAvatarKey,
  readUserByEmail,
  readUserById,
  readUserByUsername,
  toPublicUser,
  updateUserProfile,
  updateUserVip,
  type AccountAvatarKey,
  type UserRecord,
} from "./userStore";
import { getAppDb } from "./appDb";
import { listTrackStats } from "./listeningStore";
import type { PaginatedListData } from "../types/response";
import { buildPaginatedList, normalizePagination } from "../utils/pagination";

export type AdminUserStats = {
  favoriteSongs: number;
  favoritePlaylists: number;
  userPlaylists: number;
  listeningTracks: number;
  listeningTotalMs: number;
};

export type AdminUserListItem = {
  id: string;
  email: string;
  username: string;
  avatar: string;
  avatarKey: string;
  avatarUrl: string;
  vipEnabled: boolean;
  vip: boolean;
  vipExpiresAt: number | null;
  vipLevel: number;
  syncVersion: number;
  syncLogFloor: number;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
  stats: AdminUserStats;
};

export type AdminUserLibraryItem = {
  itemKey: string;
  itemId: string;
  source: string;
  name: string;
  subtitle: string;
  cover: string;
  serverUpdatedAt: number;
  clientUpdatedAt: string;
  deleted?: boolean;
  serverVersion?: number;
  lastDeviceId?: string;
  lastOpId?: string;
  playlistId?: string;
  sortOrder?: number | null;
  durationMs?: number | null;
  listenedMs?: number;
  playCount?: number;
  completedCount?: number;
  firstListenedAt?: number;
  lastListenedAt?: number;
};

export type AdminUserDetail = AdminUserListItem & {
  library?: never;
};

export type AdminUserLibraryKind = "favoriteSongs" | "favoritePlaylists" | "userPlaylists" | "playlistTracks" | "listeningHistory";
export type AdminUserLibraryStatus = "active" | "deleted" | "all";

export type AdminUserLibraryPage = PaginatedListData<AdminUserLibraryItem>;

export type AdminUserSyncLogItem = {
  version: number;
  opId: string;
  deviceId: string;
  itemType: string;
  itemKey: string;
  action: string;
  summary: string;
  payloadJson: string;
  clientUpdatedAt: string;
  serverUpdatedAt: number;
};

export type AdminUserSyncLogsPage = PaginatedListData<AdminUserSyncLogItem> & {
  syncVersion: number;
  syncLogFloor: number;
};

export type AdminUserListResult = PaginatedListData<AdminUserListItem>;

export type AdminUserUpdateInput = {
  username?: string;
  email?: string;
  avatarKey?: AccountAvatarKey;
  vipEnabled?: boolean;
  vipExpiresAt?: number | null;
  vipLevel?: number;
};

export type AdminVipResolvedUser = {
  id: string;
  username: string;
  email: string;
  vipEnabled: boolean;
  vip: boolean;
  vipExpiresAt: number | null;
  vipLevel: number;
};

type UserStatsRow = {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  avatar: string;
  avatar_key: string;
  vip_enabled: number;
  vip_expires_at: number | null;
  vip_level: number;
  sync_version: number;
  sync_log_floor: number;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
  favorite_songs: number;
  favorite_playlists: number;
  user_playlists: number;
  listening_tracks: number;
  listening_total_ms: number;
};

type SyncItemRow = {
  item_key: string;
  payload_json: string;
  deleted: number;
  last_op_id: string;
  last_device_id: string;
  client_updated_at: string;
  server_version: number;
  server_updated_at: number;
};

type SyncLogQueryRow = {
  version: number;
  op_id: string;
  device_id: string;
  item_type: string;
  item_key: string;
  action: string;
  payload_json: string;
  client_updated_at: string;
  server_updated_at: number;
};

function normalizeKeyword(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function rowToUserRecord(row: UserStatsRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    phone: null,
    username: row.username,
    passwordHash: row.password_hash,
    avatar: row.avatar,
    avatarKey: row.avatar_key || "default",
    vipEnabled: row.vip_enabled === 1,
    vipExpiresAt: row.vip_expires_at,
    vipLevel: Math.max(1, Number(row.vip_level) || 1),
    syncVersion: row.sync_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

function mapUserRow(row: UserStatsRow): AdminUserListItem {
  const user = rowToUserRecord(row);
  const publicUser = toPublicUser(user);
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar: publicUser.avatar,
    avatarKey: publicUser.avatarKey,
    avatarUrl: publicUser.avatarUrl,
    vipEnabled: user.vipEnabled,
    vip: publicUser.vip,
    vipExpiresAt: publicUser.vipExpiresAt,
    vipLevel: user.vipLevel,
    syncVersion: user.syncVersion,
    syncLogFloor: Number(row.sync_log_floor) || 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    stats: {
      favoriteSongs: Number(row.favorite_songs) || 0,
      favoritePlaylists: Number(row.favorite_playlists) || 0,
      userPlaylists: Number(row.user_playlists) || 0,
      listeningTracks: Number(row.listening_tracks) || 0,
      listeningTotalMs: Number(row.listening_total_ms) || 0,
    },
  };
}

function userStatsSelect(whereSql: string): string {
  return `
    SELECT
      u.id, u.email, u.username, u.password_hash, u.avatar, u.avatar_key,
      u.vip_enabled, u.vip_expires_at, u.vip_level, u.sync_version, u.sync_log_floor, u.created_at, u.updated_at, u.last_login_at,
      COALESCE(SUM(CASE WHEN s.item_type = 'favorite_song' THEN 1 ELSE 0 END), 0) AS favorite_songs,
      COALESCE(SUM(CASE WHEN s.item_type = 'favorite_playlist' THEN 1 ELSE 0 END), 0) AS favorite_playlists,
      COALESCE(SUM(CASE WHEN s.item_type = 'user_playlist' THEN 1 ELSE 0 END), 0) AS user_playlists,
      COALESCE((SELECT COUNT(*) FROM user_track_stats t WHERE t.user_id = u.id), 0) AS listening_tracks,
      COALESCE((SELECT total_ms FROM user_listening_stats l WHERE l.user_id = u.id), 0) AS listening_total_ms
    FROM users u
    LEFT JOIN user_sync_items s ON s.user_id = u.id AND s.deleted = 0
    ${whereSql}
    GROUP BY
      u.id, u.email, u.username, u.password_hash, u.avatar, u.avatar_key,
      u.vip_enabled, u.vip_expires_at, u.vip_level, u.sync_version, u.sync_log_floor, u.created_at, u.updated_at, u.last_login_at
  `;
}

function buildUserWhere(keyword: string): { sql: string; params: string[] } {
  if (!keyword) return { sql: "", params: [] };
  const term = `%${keyword}%`;
  return {
    sql: "WHERE u.id LIKE ? OR u.email LIKE ? OR u.username LIKE ?",
    params: [term, term, term],
  };
}

export async function listAdminUsers(rawKeyword: unknown, rawOffset: unknown, rawLimit: unknown): Promise<AdminUserListResult> {
  const db = getAppDb();
  const keyword = normalizeKeyword(rawKeyword);
  const { offset, limit } = normalizePagination(rawOffset, rawLimit);
  const where = buildUserWhere(keyword);
  const totalRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM users u ${where.sql}`, [...where.params])) as { total: number };
  const rows = (await db.query(`${userStatsSelect(where.sql)} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, [...where.params, limit, offset])) as UserStatsRow[];
  return buildPaginatedList(rows.map(mapUserRow), totalRow.total, offset, limit);
}

export async function readAdminUserDetail(id: string): Promise<AdminUserDetail | null> {
  const db = getAppDb();
  const row = (await db.queryOne(`${userStatsSelect("WHERE u.id = ?")} LIMIT 1`, [id])) as UserStatsRow | undefined;
  if (!row) return null;
  return mapUserRow(row);
}

export async function listAdminUserLibraryItems(
  userId: string,
  kind: AdminUserLibraryKind,
  rawOffset: unknown,
  rawLimit: unknown,
  options: { status?: AdminUserLibraryStatus; playlistId?: string } = {},
): Promise<AdminUserLibraryPage | null> {
  if (!(await readUserById(userId))) return null;
  const db = getAppDb();
  const { offset, limit } = normalizePagination(rawOffset, rawLimit, { defaultLimit: 30 });

  if (kind === "listeningHistory") {
    const trackPage = (await listTrackStats(userId, { sort: "lastListenedAt", offset, limit }));
    return buildPaginatedList(
      trackPage.list.map((track) => ({
        itemKey: `${track.source}:${track.songId}`,
        itemId: track.songId,
        source: track.source,
        name: track.title || "未命名歌曲",
        subtitle: track.artist ? (track.album ? `${track.artist} · ${track.album}` : track.artist) : (track.album || "-"),
        cover: "",
        serverUpdatedAt: track.lastListenedAt,
        clientUpdatedAt: "",
        durationMs: track.durationMs,
        listenedMs: track.listenedMs,
        playCount: track.playCount,
        completedCount: track.completedCount,
        firstListenedAt: track.firstListenedAt,
        lastListenedAt: track.lastListenedAt,
      })),
      trackPage.total,
      trackPage.offset,
      trackPage.limit,
    );
  }

  const itemType = itemTypeForKind(kind);
  const status = options.status ?? "active";
  const playlistId = kind === "playlistTracks" ? normalizeKeyword(options.playlistId) : "";
  const conditions = ["user_id = ?", "item_type = ?"];
  const params: Array<string | number> = [userId, itemType];
  if (status === "active") conditions.push("deleted = 0");
  else if (status === "deleted") conditions.push("deleted = 1");
  if (playlistId) {
    const prefix = `${playlistId}|`;
    conditions.push(db.dialect === "mysql" ? "LEFT(item_key, ?) = ?" : "substr(item_key, 1, ?) = ?");
    params.push(Array.from(prefix).length, prefix);
  }
  const whereSql = conditions.join(" AND ");
  const totalRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM user_sync_items WHERE ${whereSql}`, params)) as { total: number };
  const list = await listUserSyncItems(db, whereSql, params, itemType, offset, limit);
  return buildPaginatedList(list, totalRow.total, offset, limit);
}

export async function listAdminUserSyncLogs(
  userId: string,
  query: { offset?: unknown; limit?: unknown; itemType?: unknown; action?: unknown; deviceId?: unknown; keyword?: unknown },
): Promise<AdminUserSyncLogsPage | null> {
  const db = getAppDb();
  const userRow = (await db.queryOne("SELECT sync_version, sync_log_floor FROM users WHERE id = ?", [userId])) as { sync_version: number; sync_log_floor: number } | undefined;
  if (!userRow) return null;
  const { offset, limit } = normalizePagination(query.offset, query.limit, { defaultLimit: 30 });
  const conditions = ["user_id = ?"];
  const params: Array<string | number> = [userId];
  const itemType = normalizeKeyword(query.itemType);
  if (itemType && itemType !== "all") {
    conditions.push("item_type = ?");
    params.push(itemType);
  }
  const action = normalizeKeyword(query.action);
  if (action && action !== "all") {
    conditions.push("action = ?");
    params.push(action);
  }
  const deviceId = normalizeKeyword(query.deviceId);
  if (deviceId) {
    conditions.push("device_id LIKE ?");
    params.push(`%${deviceId}%`);
  }
  const keyword = normalizeKeyword(query.keyword);
  if (keyword) {
    conditions.push("(item_key LIKE ? OR op_id LIKE ?)");
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  const whereSql = conditions.join(" AND ");
  const totalRow = (await db.queryOne(`SELECT COUNT(*) AS total FROM user_sync_change_log WHERE ${whereSql}`, params)) as { total: number };
  const rows = (await db.query(
    `SELECT version, op_id, device_id, item_type, item_key, action, payload_json, client_updated_at, server_updated_at
     FROM user_sync_change_log
     WHERE ${whereSql}
     ORDER BY version DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )) as SyncLogQueryRow[];
  const list = rows.map((row) => ({
    version: Number(row.version),
    opId: row.op_id,
    deviceId: row.device_id,
    itemType: row.item_type,
    itemKey: row.item_key,
    action: row.action,
    summary: summarizeSyncPayload(row.item_type, row.item_key, row.action, row.payload_json),
    payloadJson: row.payload_json,
    clientUpdatedAt: row.client_updated_at,
    serverUpdatedAt: Number(row.server_updated_at),
  }));
  return {
    ...buildPaginatedList(list, totalRow.total, offset, limit),
    syncVersion: Number(userRow.sync_version) || 0,
    syncLogFloor: Number(userRow.sync_log_floor) || 0,
  };
}

export async function updateAdminUser(id: string, input: AdminUserUpdateInput): Promise<AdminUserListItem | null> {
  const current = (await readUserById(id));
  if (!current) return null;
  if (input.email && input.email !== current.email) {
    const existing = (await readUserByEmail(input.email));
    if (existing && existing.id !== id) throw new Error("该邮箱已被注册");
  }
  if (input.username && input.username !== current.username) {
    const existing = (await readUserByUsername(input.username));
    if (existing && existing.id !== id) throw new Error("该用户名已被使用");
  }
  const hasProfileUpdate = input.username !== undefined || input.email !== undefined || input.avatarKey !== undefined;
  const hasVipUpdate =
    input.vipEnabled !== undefined || input.vipExpiresAt !== undefined || input.vipLevel !== undefined;
  if (hasProfileUpdate) {
    (await updateUserProfile(id, input));
  }
  if (hasVipUpdate) {
    (await updateUserVip(
      id,
      input.vipEnabled ?? current.vipEnabled,
      input.vipExpiresAt !== undefined ? input.vipExpiresAt : current.vipExpiresAt,
      input.vipLevel,
    ));
  }
  const detail = (await readAdminUserDetail(id));
  if (!detail) throw new Error("用户资料更新失败");
  return detail;
}

export async function resolveAdminUsersByIdentifiers(
  identifiers: string[],
): Promise<{ matched: AdminVipResolvedUser[]; notFound: string[] }> {
  const matchedMap = new Map<string, AdminVipResolvedUser>();
  const notFound: string[] = [];
  const seenInputs = new Set<string>();
  const now = Date.now();

  for (const raw of identifiers) {
    const clean = raw.trim();
    if (!clean) continue;
    const normKey = clean.includes("@") ? clean.toLowerCase() : clean;
    if (seenInputs.has(normKey)) continue;
    seenInputs.add(normKey);

    const user = clean.includes("@")
      ? await readUserByEmail(clean.toLowerCase())
      : (await readUserById(clean)) ?? (await readUserByEmail(clean.toLowerCase()));
    if (!user) {
      notFound.push(clean);
      continue;
    }
    if (!matchedMap.has(user.id)) {
      matchedMap.set(user.id, {
        id: user.id,
        username: user.username,
        email: user.email.endsWith("@phone.invalid") ? "" : user.email,
        vipEnabled: user.vipEnabled,
        vip: user.vipEnabled && user.vipExpiresAt !== null && user.vipExpiresAt > now,
        vipExpiresAt: user.vipExpiresAt,
        vipLevel: user.vipLevel,
      });
    }
  }
  return { matched: [...matchedMap.values()], notFound };
}

export async function batchAssignUserVip(params: {
  userIds: string[];
  action: "grant" | "revoke";
  vipLevel?: number;
  durationDays?: number;
  expiresAt?: number;
}): Promise<{ updatedCount: number; skippedIds: string[] }> {
  const db = getAppDb();
  const now = Date.now();
  const dedupedIds = [...new Set(params.userIds.map((s) => s.trim()).filter(Boolean))];
  let updatedCount = 0;
  const skippedIds: string[] = [];

  await db.transaction(async (tx) => {
    for (const userId of dedupedIds) {
      const exists = await tx.queryOne<{ id: string }>("SELECT id FROM users WHERE id = ?", [userId]);
      if (!exists) {
        skippedIds.push(userId);
        continue;
      }
      if (params.action === "revoke") {
        await tx.execute(
          "UPDATE users SET vip_enabled = 0, vip_expires_at = NULL, updated_at = ? WHERE id = ?",
          [now, userId],
        );
      } else {
        await applyVipGrantInTx(tx, {
          userId,
          vipLevel: params.vipLevel ?? 1,
          durationDays: params.durationDays,
          expiresAt: params.expiresAt,
          nowMs: now,
        });
      }
      updatedCount++;
    }
  });

  return { updatedCount, skippedIds };
}

export async function deleteAdminUser(id: string): Promise<boolean> {
  return getAppDb().transaction(async tx => {
    const user = await tx.queryOne(`SELECT id FROM users WHERE id=?${tx.dialect === "mysql" ? " FOR UPDATE" : ""}`, [id]);
    if (!user) return false;
    await lockSyncUser(tx,id);
    await detachDeletedUserCovers(tx,id);
    await deleteSubjectQuotaState(tx, "user", id);
    const result = await tx.execute("DELETE FROM users WHERE id=?", [id]);
    return result.affectedRows > 0;
  });
}

export function normalizeAdminAvatarKey(value: string): AccountAvatarKey | null {
  return isAccountAvatarKey(value) ? value : null;
}

function itemTypeForKind(kind: AdminUserLibraryKind): string {
  if (kind === "favoritePlaylists") return "favorite_playlist";
  if (kind === "userPlaylists") return "user_playlist";
  if (kind === "playlistTracks") return "playlist_track";
  return "favorite_song";
}

async function listUserSyncItems(
  db: DatabaseSync,
  whereSql: string,
  params: Array<string | number>,
  itemType: string,
  offset: number,
  limit: number,
): Promise<AdminUserLibraryItem[]> {
  const rows = (await db.query(`SELECT item_key, payload_json, deleted, last_op_id, last_device_id, client_updated_at, server_version, server_updated_at
       FROM user_sync_items
       WHERE ${whereSql}
       ORDER BY server_updated_at DESC, item_key ASC
       LIMIT ? OFFSET ?`, [...params, limit, offset])) as SyncItemRow[];
  return rows.map((row) => mapSyncItem(row, itemType));
}

function mapSyncItem(row: SyncItemRow, itemType: string): AdminUserLibraryItem {
  const payload = parsePayload(row.payload_json);
  const deleted = Number(row.deleted) === 1;
  const separatorIndex = itemType === "playlist_track" ? row.item_key.indexOf("|") : -1;
  const playlistId = separatorIndex > 0 ? row.item_key.slice(0, separatorIndex) : undefined;
  const trackKey = separatorIndex > 0 ? row.item_key.slice(separatorIndex + 1) : row.item_key;
  const source = stringField(payload.source) || sourceFromKey(trackKey);
  const itemId = stringField(payload.id) || idFromKey(trackKey);
  const name = stringField(payload.name) || stringField(payload.title) || (deleted ? "已删除墓碑记录" : trackKey);
  const subtitle = itemType === "favorite_song" || itemType === "playlist_track"
    ? stringField(payload.singer) || stringField(payload.artist) || stringField(payload.album)
    : stringField(payload.desc) || stringField(payload.intro) || tagsText(payload.tags);
  const sortOrder = typeof payload.sortOrder === "number" && Number.isSafeInteger(payload.sortOrder) ? payload.sortOrder : null;
  return {
    itemKey: row.item_key,
    itemId,
    source,
    name,
    subtitle,
    cover: stringField(payload.cover) || stringField(payload.coverUrl),
    serverUpdatedAt: Number(row.server_updated_at),
    clientUpdatedAt: row.client_updated_at,
    deleted,
    serverVersion: Number(row.server_version),
    lastDeviceId: row.last_device_id,
    lastOpId: row.last_op_id,
    ...(playlistId ? { playlistId } : {}),
    ...(itemType === "playlist_track" ? { sortOrder } : {}),
  };
}

function summarizeSyncPayload(itemType: string, itemKey: string, action: string, payloadJson: string): string {
  if (action === "delete") return "墓碑删除";
  const payload = parsePayload(payloadJson);
  const name = stringField(payload.name) || stringField(payload.title) || itemKey;
  if (itemType === "favorite_song" || itemType === "playlist_track") {
    const singer = stringField(payload.singer) || stringField(payload.artist);
    return singer ? `${name} - ${singer}` : name;
  }
  return name;
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function stringField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function sourceFromKey(key: string): string {
  const index = key.indexOf(":");
  return index > 0 ? key.slice(0, index) : "";
}

function idFromKey(key: string): string {
  const index = key.indexOf(":");
  return index >= 0 ? key.slice(index + 1) : key;
}

function tagsText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "name" in item) return stringField((item as { name?: unknown }).name);
      return "";
    })
    .filter(Boolean)
    .join(" / ");
}
