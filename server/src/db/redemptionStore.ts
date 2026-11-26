import { randomBytes, randomUUID } from "node:crypto";
import type { PaginatedListData } from "../types/response";
import { buildPaginatedList, normalizePagination } from "../utils/pagination";
import { getAppDb } from "./appDb";
import { adjustExtraQuotaInTx } from "./songDownloadStore";
import { applyVipGrantInTx } from "./userStore";

export type RedemptionRewardType = "extra_downloads" | "vip";

export type RedemptionCodeRecord = {
  id: string;
  code: string;
  batchId: string;
  batchName: string;
  rewardType: RedemptionRewardType;
  rewardAmount: number;
  vipLevel: number;
  maxUses: number;
  usedCount: number;
  expiresAt: number | null;
  enabled: boolean;
  remark: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type RedemptionBatchSummary = {
  batchId: string;
  batchName: string;
  rewardType: RedemptionRewardType;
  rewardAmount: number;
  vipLevel: number;
  expiresAt: number | null;
  remark: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  totalCount: number;
  enabledCount: number;
  usedCodeCount: number;
  unusedEnabledCount: number;
  totalUsedCount: number;
  totalMaxUses: number;
  isSharedMode: boolean;
};

export type RedemptionLogRecord = {
  id: string;
  codeId: string;
  code: string;
  userId: string;
  username: string | null;
  userEmail: string | null;
  rewardType: RedemptionRewardType;
  rewardAmount: number;
  vipLevel: number;
  createdAt: number;
};

export type RedeemSuccessResult = {
  code: string;
  rewardType: RedemptionRewardType;
  rewardAmount: number;
  vipLevel: number | null;
  extraBalance: number | null;
  vipExpiresAt: number | null;
};

type CodeRow = {
  id: string;
  code: string;
  batch_id: string;
  batch_name: string | null;
  reward_type: string;
  reward_amount: number;
  vip_level: number;
  max_uses: number;
  used_count: number;
  expires_at: number | null;
  enabled: number;
  remark: string;
  created_by: string;
  created_at: number;
  updated_at: number;
};

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateRandomCode(prefix: string): string {
  const bytes = randomBytes(8);
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += ALPHABET[bytes[i]! % ALPHABET.length];
    if (i === 3) body += "-";
  }
  return prefix ? `${prefix}-${body}` : `PM-${body}`;
}

function mapCodeRow(row: CodeRow): RedemptionCodeRecord {
  return {
    id: row.id,
    code: row.code,
    batchId: row.batch_id,
    batchName: row.batch_name ?? "",
    rewardType: row.reward_type === "vip" ? "vip" : "extra_downloads",
    rewardAmount: Number(row.reward_amount) || 0,
    vipLevel: Math.max(1, Number(row.vip_level) || 1),
    maxUses: Math.max(1, Number(row.max_uses) || 1),
    usedCount: Math.max(0, Number(row.used_count) || 0),
    expiresAt: row.expires_at === null ? null : Number(row.expires_at),
    enabled: Number(row.enabled) === 1,
    remark: row.remark ?? "",
    createdBy: row.created_by ?? "",
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
  };
}

export async function createRedemptionCodes(input: {
  mode: "single_batch" | "shared";
  batchName?: string;
  count?: number;
  prefix?: string;
  customCode?: string;
  rewardType: RedemptionRewardType;
  rewardAmount: number;
  vipLevel: number;
  maxUses?: number;
  expiresAt: number | null;
  remark: string;
  createdBy: string;
}): Promise<{ batchId: string; batchName: string; items: RedemptionCodeRecord[] }> {
  const db = getAppDb();
  const now = Date.now();
  const batchId = randomUUID();
  const batchName = (input.batchName ?? "").trim().slice(0, 80);

  return db.transaction(async (tx) => {
    const items: RedemptionCodeRecord[] = [];
    if (input.mode === "shared") {
      const code = input.customCode!.trim().toUpperCase();
      const dup = await tx.queryOne<{ id: string }>("SELECT id FROM redemption_codes WHERE code = ?", [code]);
      if (dup) throw new Error(`兑换码 ${code} 已存在`);
      const id = randomUUID();
      const maxUses = Math.max(1, Math.trunc(input.maxUses ?? 1));
      await tx.execute(
        `INSERT INTO redemption_codes (
          id, code, batch_id, batch_name, reward_type, reward_amount, vip_level, max_uses, used_count, expires_at, enabled, remark, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?, ?, ?, ?)`,
        [
          id,
          code,
          batchId,
          batchName,
          input.rewardType,
          input.rewardAmount,
          input.vipLevel,
          maxUses,
          input.expiresAt,
          input.remark,
          input.createdBy,
          now,
          now,
        ],
      );
      items.push({
        id,
        code,
        batchId,
        batchName,
        rewardType: input.rewardType,
        rewardAmount: input.rewardAmount,
        vipLevel: input.vipLevel,
        maxUses,
        usedCount: 0,
        expiresAt: input.expiresAt,
        enabled: true,
        remark: input.remark,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const count = Math.min(500, Math.max(1, Math.trunc(input.count ?? 1)));
      const prefix = (input.prefix ?? "").trim().toUpperCase();
      const seen = new Set<string>();
      for (let i = 0; i < count; i++) {
        let code = "";
        for (let attempt = 0; attempt < 20; attempt++) {
          const candidate = generateRandomCode(prefix);
          if (seen.has(candidate)) continue;
          const dup = await tx.queryOne<{ id: string }>("SELECT id FROM redemption_codes WHERE code = ?", [candidate]);
          if (!dup) {
            code = candidate;
            break;
          }
        }
        if (!code) throw new Error("生成唯一兑换码失败，请重试");
        seen.add(code);
        const id = randomUUID();
        await tx.execute(
          `INSERT INTO redemption_codes (
            id, code, batch_id, batch_name, reward_type, reward_amount, vip_level, max_uses, used_count, expires_at, enabled, remark, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, 1, ?, ?, ?, ?)`,
          [
            id,
            code,
            batchId,
            batchName,
            input.rewardType,
            input.rewardAmount,
            input.vipLevel,
            input.expiresAt,
            input.remark,
            input.createdBy,
            now,
            now,
          ],
        );
        items.push({
          id,
          code,
          batchId,
          batchName,
          rewardType: input.rewardType,
          rewardAmount: input.rewardAmount,
          vipLevel: input.vipLevel,
          maxUses: 1,
          usedCount: 0,
          expiresAt: input.expiresAt,
          enabled: true,
          remark: input.remark,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return { batchId, batchName, items };
  });
}

export async function listRedemptionBatches(query: {
  keyword?: string;
  rewardType?: string;
  offset: unknown;
  limit: unknown;
}): Promise<PaginatedListData<RedemptionBatchSummary>> {
  const db = getAppDb();
  const { offset, limit } = normalizePagination(query.offset, query.limit);
  const subWhere: string[] = [];
  const args: Array<string | number> = [];

  if (query.keyword) {
    const term = `%${query.keyword.toUpperCase()}%`;
    const rawTerm = `%${query.keyword}%`;
    subWhere.push("(code LIKE ? OR batch_id LIKE ? OR batch_name LIKE ? OR remark LIKE ?)");
    args.push(term, rawTerm, rawTerm, rawTerm);
  }
  if (query.rewardType === "extra_downloads" || query.rewardType === "vip") {
    subWhere.push("reward_type = ?");
    args.push(query.rewardType);
  }

  const filterSql = subWhere.length
    ? `WHERE batch_id IN (SELECT DISTINCT batch_id FROM redemption_codes WHERE ${subWhere.join(" AND ")})`
    : "";

  const totalRow = (await db.queryOne<{ total: number }>(
    `SELECT COUNT(DISTINCT batch_id) AS total FROM redemption_codes ${filterSql}`,
    args,
  )) ?? { total: 0 };

  const rows = await db.query<{
    batch_id: string;
    batch_name: string | null;
    reward_type: string;
    reward_amount: number;
    vip_level: number;
    expires_at: number | null;
    remark: string;
    created_by: string;
    created_at: number;
    updated_at: number;
    total_count: number;
    enabled_count: number;
    used_code_count: number;
    unused_enabled_count: number;
    total_used_count: number;
    total_max_uses: number;
    is_shared_mode: number;
  }>(
    `SELECT
      batch_id,
      MAX(batch_name) AS batch_name,
      MAX(reward_type) AS reward_type,
      MAX(reward_amount) AS reward_amount,
      MAX(vip_level) AS vip_level,
      MAX(expires_at) AS expires_at,
      MAX(remark) AS remark,
      MAX(created_by) AS created_by,
      MIN(created_at) AS created_at,
      MAX(updated_at) AS updated_at,
      COUNT(*) AS total_count,
      SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled_count,
      SUM(CASE WHEN used_count > 0 THEN 1 ELSE 0 END) AS used_code_count,
      SUM(CASE WHEN enabled = 1 AND used_count = 0 THEN 1 ELSE 0 END) AS unused_enabled_count,
      SUM(used_count) AS total_used_count,
      SUM(max_uses) AS total_max_uses,
      MAX(CASE WHEN max_uses > 1 THEN 1 ELSE 0 END) AS is_shared_mode
     FROM redemption_codes
     ${filterSql}
     GROUP BY batch_id
     ORDER BY MIN(created_at) DESC, batch_id DESC
     LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );

  return buildPaginatedList(
    rows.map((r) => ({
      batchId: r.batch_id,
      batchName: r.batch_name ?? "",
      rewardType: r.reward_type === "vip" ? "vip" : "extra_downloads",
      rewardAmount: Number(r.reward_amount) || 0,
      vipLevel: Math.max(1, Number(r.vip_level) || 1),
      expiresAt: r.expires_at === null ? null : Number(r.expires_at),
      remark: r.remark ?? "",
      createdBy: r.created_by ?? "",
      createdAt: Number(r.created_at) || 0,
      updatedAt: Number(r.updated_at) || 0,
      totalCount: Number(r.total_count) || 0,
      enabledCount: Number(r.enabled_count) || 0,
      usedCodeCount: Number(r.used_code_count) || 0,
      unusedEnabledCount: Number(r.unused_enabled_count) || 0,
      totalUsedCount: Number(r.total_used_count) || 0,
      totalMaxUses: Number(r.total_max_uses) || 0,
      isSharedMode: Number(r.is_shared_mode) === 1,
    })),
    Number(totalRow.total) || 0,
    offset,
    limit,
  );
}

export async function renameRedemptionBatch(batchId: string, batchName: string): Promise<{ batchId: string; batchName: string } | null> {
  const db = getAppDb();
  const now = Date.now();
  const cleanName = batchName.trim().slice(0, 80);
  const res = await db.execute(
    "UPDATE redemption_codes SET batch_name = ?, updated_at = ? WHERE batch_id = ?",
    [cleanName, now, batchId],
  );
  if (res.affectedRows === 0) return null;
  return { batchId, batchName: cleanName };
}

export async function listRedemptionCodes(query: {
  keyword?: string;
  batchId?: string;
  rewardType?: string;
  enabled?: string;
  usageStatus?: string;
  offset: unknown;
  limit: unknown;
}): Promise<PaginatedListData<RedemptionCodeRecord>> {
  const db = getAppDb();
  const { offset, limit } = normalizePagination(query.offset, query.limit);
  const where: string[] = [];
  const args: Array<string | number> = [];

  if (query.batchId) {
    where.push("batch_id = ?");
    args.push(query.batchId);
  }
  if (query.keyword) {
    const term = `%${query.keyword.toUpperCase()}%`;
    const rawTerm = `%${query.keyword}%`;
    where.push("(code LIKE ? OR batch_id LIKE ? OR batch_name LIKE ? OR remark LIKE ?)");
    args.push(term, rawTerm, rawTerm, rawTerm);
  }
  if (query.rewardType === "extra_downloads" || query.rewardType === "vip") {
    where.push("reward_type = ?");
    args.push(query.rewardType);
  }
  if (query.enabled === "1" || query.enabled === "true") {
    where.push("enabled = 1");
  } else if (query.enabled === "0" || query.enabled === "false") {
    where.push("enabled = 0");
  }
  if (query.usageStatus === "unused") {
    where.push("used_count = 0");
  } else if (query.usageStatus === "used") {
    where.push("used_count > 0");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = (await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM redemption_codes ${whereSql}`,
    args,
  )) ?? { total: 0 };
  const rows = await db.query<CodeRow>(
    `SELECT * FROM redemption_codes ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );
  return buildPaginatedList(rows.map(mapCodeRow), totalRow.total, offset, limit);
}

/** 校验单码是否允许变更启用状态：已全部用完的码（含已用一次性码）锁定状态。 */
function canChangeCodeStatus(row: { max_uses: number; used_count: number }): boolean {
  return Number(row.used_count) < Number(row.max_uses);
}

export async function setRedemptionCodeEnabled(id: string, enabled: boolean): Promise<RedemptionCodeRecord | null> {
  const db = getAppDb();
  const now = Date.now();
  const row = await db.queryOne<CodeRow>("SELECT * FROM redemption_codes WHERE id = ?", [id]);
  if (!row) return null;
  if (!canChangeCodeStatus(row)) {
    throw new Error("已核销完成的兑换码不允许停用或启用");
  }
  await db.execute(
    "UPDATE redemption_codes SET enabled = ?, updated_at = ? WHERE id = ?",
    [enabled ? 1 : 0, now, id],
  );
  const updated = await db.queryOne<CodeRow>("SELECT * FROM redemption_codes WHERE id = ?", [id]);
  return updated ? mapCodeRow(updated) : null;
}

export async function batchUpdateRedemptionCodeStatus(params: {
  ids?: string[];
  batchId?: string;
  enabled: boolean;
  onlyUnused?: boolean;
}): Promise<{ updatedCount: number; skippedUsedCount: number }> {
  const db = getAppDb();
  const now = Date.now();
  const enabledInt = params.enabled ? 1 : 0;

  return db.transaction(async (tx) => {
    if (params.batchId) {
      const rows = await tx.query<{ id: string; max_uses: number; used_count: number }>(
        "SELECT id, max_uses, used_count FROM redemption_codes WHERE batch_id = ?",
        [params.batchId],
      );
      if (rows.length === 0) throw new Error("批次不存在");
      const targetRows = params.onlyUnused
        ? rows.filter((r) => Number(r.used_count) === 0)
        : rows.filter(canChangeCodeStatus);
      const skippedUsedCount = rows.length - targetRows.length;
      if (targetRows.length === 0) {
        throw new Error(params.onlyUnused ? "该批次没有未使用的兑换码" : "该批次没有可变更状态的兑换码");
      }
      if (params.onlyUnused) {
        const res = await tx.execute(
          "UPDATE redemption_codes SET enabled = ?, updated_at = ? WHERE batch_id = ? AND used_count = 0",
          [enabledInt, now, params.batchId],
        );
        return { updatedCount: res.affectedRows, skippedUsedCount };
      }
      const res = await tx.execute(
        "UPDATE redemption_codes SET enabled = ?, updated_at = ? WHERE batch_id = ? AND used_count < max_uses",
        [enabledInt, now, params.batchId],
      );
      return { updatedCount: res.affectedRows, skippedUsedCount };
    }

    const ids = [...new Set((params.ids ?? []).map((s) => s.trim()).filter(Boolean))];
    if (ids.length === 0) throw new Error("请至少选择一条兑换码");
    const placeholders = ids.map(() => "?").join(",");
    const rows = await tx.query<{ id: string; max_uses: number; used_count: number }>(
      `SELECT id, max_uses, used_count FROM redemption_codes WHERE id IN (${placeholders})`,
      ids,
    );
    if (rows.length === 0) throw new Error("所选兑换码不存在");

    if (params.onlyUnused) {
      const eligibleIds = rows.filter((r) => Number(r.used_count) === 0).map((r) => r.id);
      const skippedUsedCount = rows.length - eligibleIds.length;
      if (eligibleIds.length === 0) {
        throw new Error("所选兑换码均已使用，无法执行仅未使用操作");
      }
      const p2 = eligibleIds.map(() => "?").join(",");
      const res = await tx.execute(
        `UPDATE redemption_codes SET enabled = ?, updated_at = ? WHERE id IN (${p2}) AND used_count = 0`,
        [enabledInt, now, ...eligibleIds],
      );
      return { updatedCount: res.affectedRows, skippedUsedCount };
    }

    const blocked = rows.filter((r) => !canChangeCodeStatus(r));
    if (blocked.length > 0) {
      throw new Error(`选中的兑换码包含 ${blocked.length} 个已核销完成的记录，不可变更状态`);
    }
    const res = await tx.execute(
      `UPDATE redemption_codes SET enabled = ?, updated_at = ? WHERE id IN (${placeholders}) AND used_count < max_uses`,
      [enabledInt, now, ...ids],
    );
    return { updatedCount: res.affectedRows, skippedUsedCount: 0 };
  });
}

export async function deleteRedemptionCodes(params: {
  ids?: string[];
  batchId?: string;
  onlyUnused?: boolean;
}): Promise<{ deletedCount: number; skippedUsedCount: number }> {
  const db = getAppDb();

  return db.transaction(async (tx) => {
    if (params.batchId) {
      const rows = await tx.query<{ id: string; used_count: number }>(
        "SELECT id, used_count FROM redemption_codes WHERE batch_id = ?",
        [params.batchId],
      );
      if (rows.length === 0) throw new Error("批次不存在");
      const usedRows = rows.filter((r) => Number(r.used_count) > 0);
      if (usedRows.length > 0 && !params.onlyUnused) {
        throw new Error(`该批次中有 ${usedRows.length} 个已使用的兑换码，不允许整体删除，请仅清理未使用码`);
      }
      const unusedCount = rows.length - usedRows.length;
      if (unusedCount === 0) {
        throw new Error("该批次中没有未使用的兑换码可删除");
      }
      const res = await tx.execute(
        `DELETE FROM redemption_codes
         WHERE batch_id = ? AND used_count = 0
           AND id NOT IN (SELECT code_id FROM redemption_logs)`,
        [params.batchId],
      );
      return { deletedCount: res.affectedRows, skippedUsedCount: usedRows.length };
    }

    const ids = [...new Set((params.ids ?? []).map((s) => s.trim()).filter(Boolean))];
    if (ids.length === 0) throw new Error("请至少选择一条兑换码");
    const placeholders = ids.map(() => "?").join(",");
    const rows = await tx.query<{ id: string; used_count: number }>(
      `SELECT id, used_count FROM redemption_codes WHERE id IN (${placeholders})`,
      ids,
    );
    if (rows.length === 0) throw new Error("所选兑换码不存在");

    const usedRows = rows.filter((r) => Number(r.used_count) > 0);
    if (usedRows.length > 0 && !params.onlyUnused) {
      throw new Error(`包含 ${usedRows.length} 个已使用的兑换码，已核销记录不允许删除`);
    }
    const unusedIds = rows.filter((r) => Number(r.used_count) === 0).map((r) => r.id);
    if (unusedIds.length === 0) {
      throw new Error("所选兑换码均已使用，不允许删除");
    }
    const p2 = unusedIds.map(() => "?").join(",");
    const res = await tx.execute(
      `DELETE FROM redemption_codes
       WHERE id IN (${p2}) AND used_count = 0
         AND id NOT IN (SELECT code_id FROM redemption_logs)`,
      unusedIds,
    );
    return { deletedCount: res.affectedRows, skippedUsedCount: usedRows.length };
  });
}

export async function listRedemptionLogs(query: {
  keyword?: string;
  userId?: string;
  offset: unknown;
  limit: unknown;
}): Promise<PaginatedListData<RedemptionLogRecord>> {
  const db = getAppDb();
  const { offset, limit } = normalizePagination(query.offset, query.limit);
  const where: string[] = [];
  const args: Array<string | number> = [];

  if (query.userId) {
    where.push("l.user_id = ?");
    args.push(query.userId);
  }
  if (query.keyword) {
    const term = `%${query.keyword}%`;
    where.push("(l.code LIKE ? OR l.user_id LIKE ? OR u.username LIKE ? OR u.email LIKE ?)");
    args.push(term.toUpperCase(), term, term, term);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = (await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM redemption_logs l LEFT JOIN users u ON u.id = l.user_id ${whereSql}`,
    args,
  )) ?? { total: 0 };

  const rows = await db.query<{
    id: string;
    code_id: string;
    code: string;
    user_id: string;
    username: string | null;
    email: string | null;
    reward_type: string;
    reward_amount: number;
    vip_level: number;
    created_at: number;
  }>(
    `SELECT l.*, u.username, u.email
     FROM redemption_logs l
     LEFT JOIN users u ON u.id = l.user_id
     ${whereSql}
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );

  return buildPaginatedList(
    rows.map((r) => ({
      id: r.id,
      codeId: r.code_id,
      code: r.code,
      userId: r.user_id,
      username: r.username,
      userEmail: r.email,
      rewardType: r.reward_type === "vip" ? "vip" : "extra_downloads",
      rewardAmount: Number(r.reward_amount) || 0,
      vipLevel: Math.max(1, Number(r.vip_level) || 1),
      createdAt: Number(r.created_at) || 0,
    })),
    totalRow.total,
    offset,
    limit,
  );
}

export async function redeemCodeForUserTx(userId: string, rawCode: string): Promise<RedeemSuccessResult> {
  const db = getAppDb();
  const code = rawCode.trim().toUpperCase();
  const now = Date.now();

  return db.transaction(async (tx) => {
    const row = await tx.queryOne<CodeRow>(
      `SELECT * FROM redemption_codes WHERE code = ?${tx.dialect === "mysql" ? " FOR UPDATE" : ""}`,
      [code],
    );
    if (!row) throw new Error("兑换码不存在或已失效");
    if (Number(row.enabled) !== 1) throw new Error("该兑换码已被停用");
    if (row.expires_at !== null && Number(row.expires_at) <= now) {
      throw new Error("该兑换码已过期");
    }
    if (Number(row.used_count) >= Number(row.max_uses)) {
      throw new Error("该兑换码已被兑换完");
    }

    const existingLog = await tx.queryOne<{ id: string }>(
      "SELECT id FROM redemption_logs WHERE code_id = ? AND user_id = ?",
      [row.id, userId],
    );
    if (existingLog) {
      throw new Error("您已兑换过该兑换码");
    }

    const updated = await tx.execute(
      "UPDATE redemption_codes SET used_count = used_count + 1, updated_at = ? WHERE id = ? AND used_count < max_uses",
      [now, row.id],
    );
    if (updated.affectedRows === 0) {
      throw new Error("该兑换码已被兑换完");
    }

    await tx.execute(
      `INSERT INTO redemption_logs (id, code_id, code, user_id, reward_type, reward_amount, vip_level, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), row.id, row.code, userId, row.reward_type, row.reward_amount, row.vip_level, now],
    );

    const rewardAmount = Number(row.reward_amount) || 0;
    if (row.reward_type === "vip") {
      const vipResult = await applyVipGrantInTx(tx, {
        userId,
        vipLevel: Number(row.vip_level) || 1,
        durationDays: rewardAmount,
        nowMs: now,
      });
      return {
        code: row.code,
        rewardType: "vip",
        rewardAmount,
        vipLevel: null,
        extraBalance: null,
        vipExpiresAt: vipResult.vipExpiresAt,
      };
    }

    const extraBalance = await adjustExtraQuotaInTx(tx, {
      subjectType: "user",
      subjectKey: userId,
      delta: rewardAmount,
      sourceType: "redeem_code",
      refId: row.id,
      remark: `兑换码 ${row.code}`,
      nowMs: now,
    });
    return {
      code: row.code,
      rewardType: "extra_downloads",
      rewardAmount,
      vipLevel: null,
      extraBalance,
      vipExpiresAt: null,
    };
  });
}
