import { fetchWithAuth, parseJson } from "./client";
import type { PaginatedListData } from "../types/config";

export type RedemptionRewardType = "extra_downloads" | "vip";

export type RedemptionCodeItem = {
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

export type RedemptionLogItem = {
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

export type CreateRedemptionCodesPayload = {
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
};

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = await parseJson<T>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchRedemptionBatches(params: {
  keyword?: string;
  rewardType?: string;
  offset?: number;
  limit?: number;
}): Promise<PaginatedListData<RedemptionBatchSummary>> {
  const res = await fetchWithAuth(`/api/admin/redemption-codes/batches${buildQuery(params)}`);
  return unwrap(res);
}

export async function renameRedemptionBatch(
  batchId: string,
  batchName: string,
): Promise<{ batchId: string; batchName: string }> {
  const res = await fetchWithAuth(`/api/admin/redemption-codes/batches/${encodeURIComponent(batchId)}`, {
    method: "PATCH",
    body: JSON.stringify({ batchName }),
  });
  return unwrap(res);
}

export async function fetchRedemptionCodes(params: {
  keyword?: string;
  batchId?: string;
  rewardType?: string;
  enabled?: string;
  usageStatus?: string;
  offset?: number;
  limit?: number;
}): Promise<PaginatedListData<RedemptionCodeItem>> {
  const res = await fetchWithAuth(`/api/admin/redemption-codes${buildQuery(params)}`);
  return unwrap(res);
}

export async function createRedemptionCodesBatch(
  payload: CreateRedemptionCodesPayload,
): Promise<{ batchId: string; batchName: string; items: RedemptionCodeItem[] }> {
  const res = await fetchWithAuth("/api/admin/redemption-codes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap(res);
}

export async function toggleRedemptionCodeStatus(
  id: string,
  enabled: boolean,
): Promise<RedemptionCodeItem> {
  const res = await fetchWithAuth(`/api/admin/redemption-codes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
  return unwrap(res);
}

export async function batchUpdateRedemptionCodeStatus(payload: {
  ids?: string[];
  batchId?: string;
  enabled: boolean;
  onlyUnused?: boolean;
}): Promise<{ updatedCount: number; skippedUsedCount: number }> {
  const res = await fetchWithAuth("/api/admin/redemption-codes/batch-status", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap(res);
}

export async function deleteRedemptionCode(id: string): Promise<{ deletedCount: number }> {
  const res = await fetchWithAuth(`/api/admin/redemption-codes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return unwrap(res);
}

export async function batchDeleteRedemptionCodes(payload: {
  ids?: string[];
  batchId?: string;
  onlyUnused?: boolean;
}): Promise<{ deletedCount: number; skippedUsedCount: number }> {
  const res = await fetchWithAuth("/api/admin/redemption-codes/batch-delete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap(res);
}

export async function fetchRedemptionLogs(params: {
  keyword?: string;
  userId?: string;
  offset?: number;
  limit?: number;
}): Promise<PaginatedListData<RedemptionLogItem>> {
  const res = await fetchWithAuth(`/api/admin/redemption-codes/logs${buildQuery(params)}`);
  return unwrap(res);
}
