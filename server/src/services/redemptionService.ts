import {
  batchUpdateRedemptionCodeStatus,
  createRedemptionCodes,
  deleteRedemptionCodes,
  listRedemptionBatches,
  listRedemptionCodes,
  listRedemptionLogs,
  redeemCodeForUserTx,
  renameRedemptionBatch,
  setRedemptionCodeEnabled,
  type RedemptionRewardType,
} from "../db/redemptionStore";

export class RedemptionValidationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "RedemptionValidationError";
    this.statusCode = statusCode;
  }
}

const CODE_RE = /^[A-Z0-9_-]{4,32}$/;
const PREFIX_RE = /^[A-Z0-9_-]{1,12}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeIds(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) throw new RedemptionValidationError("ids 必须是数组");
  const ids = [...new Set(raw.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))];
  if (ids.length === 0 || ids.length > 500) {
    throw new RedemptionValidationError("ids 数量必须在 1~500 之间");
  }
  return ids;
}

export async function createAdminRedemptionCodes(body: unknown, adminUsername: string) {
  if (!isRecord(body)) throw new RedemptionValidationError("请求体必须是对象");

  const mode = body.mode === "shared" ? "shared" : "single_batch";
  const batchName = typeof body.batchName === "string" ? body.batchName.trim().slice(0, 80) : "";
  const rewardTypeRaw = body.rewardType;
  if (rewardTypeRaw !== "extra_downloads" && rewardTypeRaw !== "vip") {
    throw new RedemptionValidationError("rewardType 必须是 extra_downloads 或 vip");
  }
  const rewardType: RedemptionRewardType = rewardTypeRaw;

  const rewardAmount = Number(body.rewardAmount);
  if (
    !Number.isInteger(rewardAmount) ||
    rewardAmount < 1 ||
    rewardAmount > (rewardType === "vip" ? 36500 : 1000000)
  ) {
    throw new RedemptionValidationError(
      rewardType === "vip" ? "VIP 天数必须是 1~36500 的整数" : "额外下载次数必须是 1~1000000 的整数",
    );
  }

  let vipLevel = 1;
  if (rewardType === "vip") {
    vipLevel = Number(body.vipLevel ?? 1);
    if (!Number.isInteger(vipLevel) || vipLevel < 1 || vipLevel > 1000) {
      throw new RedemptionValidationError("VIP 等级必须是 1~1000 的整数");
    }
  }

  let expiresAt: number | null = null;
  if (body.expiresAt !== undefined && body.expiresAt !== null) {
    const exp = Number(body.expiresAt);
    if (!Number.isFinite(exp) || !Number.isInteger(exp) || exp <= Date.now()) {
      throw new RedemptionValidationError("兑换码过期时间必须晚于当前时间");
    }
    expiresAt = exp;
  }

  const remark = typeof body.remark === "string" ? body.remark.trim().slice(0, 200) : "";

  if (mode === "shared") {
    const customCode = typeof body.customCode === "string" ? body.customCode.trim().toUpperCase() : "";
    if (!CODE_RE.test(customCode)) {
      throw new RedemptionValidationError("通用兑换码必须为 4~32 位字母、数字、下划线或短横线");
    }
    const maxUses = Number(body.maxUses ?? 1);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000000) {
      throw new RedemptionValidationError("通用兑换码最大兑换次数必须是 1~10000000 的整数");
    }
    try {
      return await createRedemptionCodes({
        mode: "shared",
        batchName,
        customCode,
        rewardType,
        rewardAmount,
        vipLevel,
        maxUses,
        expiresAt,
        remark,
        createdBy: adminUsername,
      });
    } catch (e) {
      throw new RedemptionValidationError(e instanceof Error ? e.message : "创建兑换码失败", 400);
    }
  }

  const count = Number(body.count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    throw new RedemptionValidationError("单次批量生成数量必须在 1~500 之间");
  }
  const prefix = typeof body.prefix === "string" ? body.prefix.trim().toUpperCase() : "";
  if (prefix && !PREFIX_RE.test(prefix)) {
    throw new RedemptionValidationError("兑换码前缀仅支持 1~12 位字母、数字、下划线或短横线");
  }

  return createRedemptionCodes({
    mode: "single_batch",
    batchName,
    count,
    prefix,
    rewardType,
    rewardAmount,
    vipLevel,
    expiresAt,
    remark,
    createdBy: adminUsername,
  });
}

export async function getAdminRedemptionBatches(query: Record<string, unknown>) {
  return listRedemptionBatches({
    keyword: typeof query.keyword === "string" ? query.keyword.trim() : "",
    rewardType: typeof query.rewardType === "string" ? query.rewardType : "",
    offset: query.offset,
    limit: query.limit,
  });
}

export async function renameAdminRedemptionBatch(batchId: string, body: unknown) {
  if (!isRecord(body) || typeof body.batchName !== "string") {
    throw new RedemptionValidationError("batchName 必须是字符串");
  }
  const cleanBatchId = batchId.trim();
  if (!cleanBatchId) throw new RedemptionValidationError("batchId 不能为空");
  const cleanName = body.batchName.trim().slice(0, 80);
  if (!cleanName) throw new RedemptionValidationError("批次名称不能为空");
  const updated = await renameRedemptionBatch(cleanBatchId, cleanName);
  if (!updated) throw new RedemptionValidationError("批次不存在", 404);
  return updated;
}

export async function getAdminRedemptionCodes(query: Record<string, unknown>) {
  return listRedemptionCodes({
    keyword: typeof query.keyword === "string" ? query.keyword.trim() : "",
    batchId: typeof query.batchId === "string" ? query.batchId.trim() : "",
    rewardType: typeof query.rewardType === "string" ? query.rewardType : "",
    enabled: typeof query.enabled === "string" ? query.enabled : "",
    usageStatus: typeof query.usageStatus === "string" ? query.usageStatus : "",
    offset: query.offset,
    limit: query.limit,
  });
}

export async function updateAdminRedemptionCodeStatus(id: string, body: unknown) {
  if (!isRecord(body) || typeof body.enabled !== "boolean") {
    throw new RedemptionValidationError("enabled 必须是布尔值");
  }
  try {
    const updated = await setRedemptionCodeEnabled(id.trim(), body.enabled);
    if (!updated) throw new RedemptionValidationError("兑换码不存在", 404);
    return updated;
  } catch (e) {
    if (e instanceof RedemptionValidationError) throw e;
    throw new RedemptionValidationError(e instanceof Error ? e.message : "更新兑换码状态失败", 400);
  }
}

export async function batchUpdateAdminRedemptionCodeStatus(body: unknown) {
  if (!isRecord(body) || typeof body.enabled !== "boolean") {
    throw new RedemptionValidationError("enabled 必须是布尔值");
  }
  const ids = normalizeIds(body.ids);
  const batchId = typeof body.batchId === "string" ? body.batchId.trim() : undefined;
  if (!ids && !batchId) {
    throw new RedemptionValidationError("必须指定 ids 或 batchId");
  }
  const onlyUnused = body.onlyUnused === true;
  try {
    return await batchUpdateRedemptionCodeStatus({
      ids,
      batchId,
      enabled: body.enabled,
      onlyUnused,
    });
  } catch (e) {
    throw new RedemptionValidationError(e instanceof Error ? e.message : "批量更新状态失败", 400);
  }
}

export async function deleteAdminRedemptionCodeById(id: string) {
  try {
    return await deleteRedemptionCodes({ ids: [id.trim()] });
  } catch (e) {
    throw new RedemptionValidationError(e instanceof Error ? e.message : "删除兑换码失败", 400);
  }
}

export async function batchDeleteAdminRedemptionCodes(body: unknown) {
  if (!isRecord(body)) throw new RedemptionValidationError("请求体必须是对象");
  const ids = normalizeIds(body.ids);
  const batchId = typeof body.batchId === "string" ? body.batchId.trim() : undefined;
  if (!ids && !batchId) {
    throw new RedemptionValidationError("必须指定 ids 或 batchId");
  }
  const onlyUnused = body.onlyUnused === true;
  try {
    return await deleteRedemptionCodes({ ids, batchId, onlyUnused });
  } catch (e) {
    throw new RedemptionValidationError(e instanceof Error ? e.message : "批量删除兑换码失败", 400);
  }
}

export async function getAdminRedemptionLogs(query: Record<string, unknown>) {
  return listRedemptionLogs({
    keyword: typeof query.keyword === "string" ? query.keyword.trim() : "",
    userId: typeof query.userId === "string" ? query.userId.trim() : "",
    offset: query.offset,
    limit: query.limit,
  });
}

export async function redeemCodeForUser(userId: string, body: unknown) {
  if (!isRecord(body)) throw new RedemptionValidationError("请求体必须是对象");
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!CODE_RE.test(code)) {
    throw new RedemptionValidationError("兑换码格式不正确");
  }
  try {
    return await redeemCodeForUserTx(userId, code);
  } catch (e) {
    throw new RedemptionValidationError(e instanceof Error ? e.message : "兑换失败", 400);
  }
}
