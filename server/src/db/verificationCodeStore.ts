import { randomUUID } from "node:crypto";
import { getAppDb } from "./appDb";
import { toPublicUser, type PublicUser, type UserRecord } from "./userStore";

export type VerificationCodeChannel = "email" | "phone";
export type VerificationCodePurpose = "register" | "login" | "profile_email" | "profile_phone" | "reset_password";
export type VerificationCodeStatus = "sent" | "verified" | "expired" | "failed";

export type VerificationCodeRecord = {
  id: string;
  channel: VerificationCodeChannel;
  target: string;
  purpose: VerificationCodePurpose;
  code: string;
  userId: string | null;
  user: PublicUser | null;
  deviceId: string;
  clientIp: string;
  userAgent: string;
  status: VerificationCodeStatus;
  errorMessage: string;
  createdAt: number;
  expiresAt: number;
  verifiedAt: number | null;
};

export type InsertVerificationCodeInput = {
  id?: string;
  channel: VerificationCodeChannel;
  target: string;
  purpose: VerificationCodePurpose;
  code: string;
  userId?: string | null;
  deviceId?: string;
  clientIp?: string;
  userAgent?: string;
  status?: VerificationCodeStatus;
  errorMessage?: string;
  createdAt?: number;
  expiresAt: number;
};

export type VerificationCodeQuery = {
  channel?: string;
  purpose?: string;
  status?: string;
  keyword?: string;
  offset?: number;
  limit?: number;
};

export type VerificationCodePage = {
  items: VerificationCodeRecord[];
  total: number;
  offset: number;
  limit: number;
};

type VerificationCodeRow = {
  id: string;
  channel: VerificationCodeChannel;
  target: string;
  purpose: VerificationCodePurpose;
  code: string;
  user_id: string | null;
  device_id: string;
  client_ip: string;
  user_agent: string;
  status: VerificationCodeStatus;
  error_message: string;
  created_at: number;
  expires_at: number;
  verified_at: number | null;
  // user join fields
  u_email: string | null;
  u_phone: string | null;
  u_username: string | null;
  u_avatar: string | null;
  u_avatar_key: string | null;
  u_vip_enabled: number | null;
  u_vip_expires_at: number | null;
  u_sync_version: number | null;
  u_created_at: number | null;
  u_updated_at: number | null;
  u_last_login_at: number | null;
};

function normalizeText(value: unknown, max = 256): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizePagination(offset: unknown, limit: unknown): { offset: number; limit: number } {
  return {
    offset: Math.max(0, Math.trunc(Number(offset) || 0)),
    limit: Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20))),
  };
}

function mapRowToRecord(row: VerificationCodeRow): VerificationCodeRecord {
  let user: PublicUser | null = null;
  if (row.user_id && row.u_username) {
    const userRecord: UserRecord = {
      id: row.user_id,
      email: row.u_email || "",
      phone: row.u_phone || null,
      username: row.u_username,
      passwordHash: "",
      avatar: row.u_avatar || "",
      avatarKey: (row.u_avatar_key as any) || "default",
      vipEnabled: row.u_vip_enabled === 1,
      vipExpiresAt: row.u_vip_expires_at,
      syncVersion: row.u_sync_version || 0,
      createdAt: row.u_created_at || 0,
      updatedAt: row.u_updated_at || 0,
      lastLoginAt: row.u_last_login_at,
    };
    user = toPublicUser(userRecord);
  }

  // 计算动态状态：如果是 sent 且已经过了 expires_at，则视为 expired
  let status = row.status;
  if (status === "sent" && row.expires_at <= Date.now()) {
    status = "expired";
  }

  return {
    id: row.id,
    channel: row.channel,
    target: row.target,
    purpose: row.purpose,
    code: row.code,
    userId: row.user_id,
    user,
    deviceId: row.device_id,
    clientIp: row.client_ip,
    userAgent: row.user_agent,
    status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at,
  };
}

export function insertVerificationCodeRecord(input: InsertVerificationCodeInput): string {
  const db = getAppDb();
  const id = input.id || randomUUID();
  const now = input.createdAt || Date.now();
  const status = input.status || "sent";
  const errorMessage = input.errorMessage || "";
  const deviceId = normalizeText(input.deviceId, 128);
  const clientIp = normalizeText(input.clientIp, 64);
  const userAgent = normalizeText(input.userAgent, 512);
  const userId = input.userId || null;

  db.prepare(
    `INSERT INTO verification_code_records (
      id, channel, target, purpose, code, user_id, device_id, client_ip, user_agent,
      status, error_message, created_at, expires_at, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    id,
    input.channel,
    input.target,
    input.purpose,
    input.code,
    userId,
    deviceId,
    clientIp,
    userAgent,
    status,
    errorMessage,
    now,
    input.expiresAt,
  );
  return id;
}

export function markVerificationCodeVerified(
  channel: VerificationCodeChannel,
  target: string,
  purpose: VerificationCodePurpose,
  code: string,
): boolean {
  const db = getAppDb();
  const now = Date.now();
  // 查找最近一条未过期且状态为 sent 的匹配记录
  const row = db.prepare(
    `SELECT id FROM verification_code_records
     WHERE channel = ? AND target = ? AND purpose = ? AND code = ? AND status = 'sent' AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`,
  ).get(channel, target, purpose, code, now) as { id: string } | undefined;

  if (!row) return false;

  const result = db.prepare(
    `UPDATE verification_code_records
     SET status = 'verified', verified_at = ?
     WHERE id = ?`,
  ).run(now, row.id);

  return result.changes > 0;
}

export function listVerificationCodeRecords(query: VerificationCodeQuery): VerificationCodePage {
  const db = getAppDb();
  const { offset, limit } = normalizePagination(query.offset, query.limit);

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.channel && query.channel !== "all") {
    conditions.push("v.channel = ?");
    params.push(query.channel);
  }

  if (query.purpose && query.purpose !== "all") {
    conditions.push("v.purpose = ?");
    params.push(query.purpose);
  }

  if (query.status && query.status !== "all") {
    const now = Date.now();
    if (query.status === "verified") {
      conditions.push("v.status = 'verified'");
    } else if (query.status === "failed") {
      conditions.push("v.status = 'failed'");
    } else if (query.status === "expired") {
      conditions.push("(v.status = 'expired' OR (v.status = 'sent' AND v.expires_at <= ?))");
      params.push(now);
    } else if (query.status === "sent") {
      conditions.push("v.status = 'sent' AND v.expires_at > ?");
      params.push(now);
    }
  }

  if (query.keyword) {
    const term = `%${query.keyword.trim()}%`;
    conditions.push(
      "(v.target LIKE ? OR v.device_id LIKE ? OR v.client_ip LIKE ? OR v.code LIKE ? OR u.username LIKE ? OR u.id LIKE ?)",
    );
    params.push(term, term, term, term, term, term);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = db.prepare(
    `SELECT COUNT(*) AS total
     FROM verification_code_records v
     LEFT JOIN users u ON u.id = v.user_id
     ${whereSql}`,
  ).get(...params) as { total: number };

  const rows = db.prepare(
    `SELECT
       v.*,
       u.email AS u_email, u.phone AS u_phone, u.username AS u_username,
       u.avatar AS u_avatar, u.avatar_key AS u_avatar_key,
       u.vip_enabled AS u_vip_enabled, u.vip_expires_at AS u_vip_expires_at,
       u.sync_version AS u_sync_version, u.created_at AS u_created_at,
       u.updated_at AS u_updated_at, u.last_login_at AS u_last_login_at
     FROM verification_code_records v
     LEFT JOIN users u ON u.id = v.user_id
     ${whereSql}
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset) as VerificationCodeRow[];

  return {
    items: rows.map(mapRowToRecord),
    total: countRow.total,
    offset,
    limit,
  };
}

export function deleteVerificationCodeRecord(id: string): boolean {
  const result = getAppDb().prepare("DELETE FROM verification_code_records WHERE id = ?").run(id);
  return result.changes > 0;
}
