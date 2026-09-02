import { DatabaseSync } from "node:sqlite";
import {
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
  syncVersion: number;
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

export type AdminUserLibraryKind = "favoriteSongs" | "favoritePlaylists" | "userPlaylists" | "listeningHistory";

export type AdminUserLibraryPage = {
  items: AdminUserLibraryItem[];
  total: number;
  offset: number;
  limit: number;
};

export type AdminUserListResult = {
  users: AdminUserListItem[];
  total: number;
  offset: number;
  limit: number;
};

export type AdminUserUpdateInput = {
  username?: string;
  email?: string;
  avatarKey?: AccountAvatarKey;
  vipEnabled?: boolean;
  vipExpiresAt?: number | null;
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
  sync_version: number;
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
  client_updated_at: string;
  server_updated_at: number;
};

function normalizeKeyword(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePagination(offset: unknown, limit: unknown): { offset: number; limit: number } {
  return {
    offset: Math.max(0, Math.trunc(Number(offset) || 0)),
    limit: Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20))),
  };
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
    syncVersion: user.syncVersion,
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
      u.vip_enabled, u.vip_expires_at, u.sync_version, u.created_at, u.updated_at, u.last_login_at,
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
      u.vip_enabled, u.vip_expires_at, u.sync_version, u.created_at, u.updated_at, u.last_login_at
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

export function listAdminUsers(rawKeyword: unknown, rawOffset: unknown, rawLimit: unknown): AdminUserListResult {
  const db = getAppDb();
  const keyword = normalizeKeyword(rawKeyword);
  const { offset, limit } = normalizePagination(rawOffset, rawLimit);
  const where = buildUserWhere(keyword);
  const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM users u ${where.sql}`).get(...where.params) as { total: number };
  const rows = db
    .prepare(`${userStatsSelect(where.sql)} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`)
    .all(...where.params, limit, offset) as UserStatsRow[];
  return {
    users: rows.map(mapUserRow),
    total: totalRow.total,
    offset,
    limit,
  };
}

export function readAdminUserDetail(id: string): AdminUserDetail | null {
  const db = getAppDb();
  const row = db.prepare(`${userStatsSelect("WHERE u.id = ?")} LIMIT 1`).get(id) as UserStatsRow | undefined;
  if (!row) return null;
  return mapUserRow(row);
}

export function listAdminUserLibraryItems(
  userId: string,
  kind: AdminUserLibraryKind,
  rawOffset: unknown,
  rawLimit: unknown,
): AdminUserLibraryPage | null {
  if (!readUserById(userId)) return null;
  const db = getAppDb();
  const { offset, limit } = normalizePagination(rawOffset, rawLimit ?? 30);

  if (kind === "listeningHistory") {
    const trackPage = listTrackStats(userId, { sort: "lastListenedAt", offset, limit });
    return {
      items: trackPage.items.map((track) => ({
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
      total: trackPage.total,
      offset: trackPage.offset,
      limit: trackPage.limit,
    };
  }

  const itemType = itemTypeForKind(kind);
  const totalRow = db
    .prepare("SELECT COUNT(*) AS total FROM user_sync_items WHERE user_id = ? AND item_type = ? AND deleted = 0")
    .get(userId, itemType) as { total: number };
  return {
    items: listUserSyncItems(db, userId, itemType, offset, limit),
    total: totalRow.total,
    offset,
    limit,
  };
}

export function updateAdminUser(id: string, input: AdminUserUpdateInput): AdminUserListItem | null {
  const current = readUserById(id);
  if (!current) return null;
  if (input.email && input.email !== current.email) {
    const existing = readUserByEmail(input.email);
    if (existing && existing.id !== id) throw new Error("该邮箱已被注册");
  }
  if (input.username && input.username !== current.username) {
    const existing = readUserByUsername(input.username);
    if (existing && existing.id !== id) throw new Error("该用户名已被使用");
  }
  const hasProfileUpdate = input.username !== undefined || input.email !== undefined || input.avatarKey !== undefined;
  const hasVipUpdate = input.vipEnabled !== undefined || input.vipExpiresAt !== undefined;
  if (hasProfileUpdate) {
    updateUserProfile(id, input);
  }
  if (hasVipUpdate) {
    updateUserVip(
      id,
      input.vipEnabled ?? current.vipEnabled,
      input.vipExpiresAt !== undefined ? input.vipExpiresAt : current.vipExpiresAt,
    );
  }
  const detail = readAdminUserDetail(id);
  if (!detail) throw new Error("用户资料更新失败");
  return detail;
}

export function deleteAdminUser(id: string): boolean {
  const result = getAppDb().prepare("DELETE FROM users WHERE id = ?").run(id);
  return result.changes > 0;
}

export function normalizeAdminAvatarKey(value: string): AccountAvatarKey | null {
  return isAccountAvatarKey(value) ? value : null;
}

function itemTypeForKind(kind: AdminUserLibraryKind): string {
  if (kind === "favoritePlaylists") return "favorite_playlist";
  if (kind === "userPlaylists") return "user_playlist";
  return "favorite_song";
}

function listUserSyncItems(db: DatabaseSync, userId: string, itemType: string, offset: number, limit: number): AdminUserLibraryItem[] {
  const rows = db
    .prepare(
      `SELECT item_key, payload_json, client_updated_at, server_updated_at
       FROM user_sync_items
       WHERE user_id = ? AND item_type = ? AND deleted = 0
       ORDER BY server_updated_at DESC, item_key ASC
       LIMIT ? OFFSET ?`,
    )
    .all(userId, itemType, limit, offset) as SyncItemRow[];
  return rows.map((row) => mapSyncItem(row, itemType));
}

function mapSyncItem(row: SyncItemRow, itemType: string): AdminUserLibraryItem {
  const payload = parsePayload(row.payload_json);
  const source = stringField(payload.source) || sourceFromKey(row.item_key);
  const itemId = stringField(payload.id) || idFromKey(row.item_key);
  const name = stringField(payload.name) || stringField(payload.title) || row.item_key;
  const subtitle = itemType === "favorite_song"
    ? stringField(payload.singer) || stringField(payload.artist) || stringField(payload.album)
    : stringField(payload.desc) || stringField(payload.intro) || tagsText(payload.tags);
  return {
    itemKey: row.item_key,
    itemId,
    source,
    name,
    subtitle,
    cover: stringField(payload.cover) || stringField(payload.coverUrl),
    serverUpdatedAt: row.server_updated_at,
    clientUpdatedAt: row.client_updated_at,
  };
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
