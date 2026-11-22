import type { PaginatedListData } from "../types/response";

export type NormalizePaginationOptions = {
  defaultLimit?: number;
  maxLimit?: number;
};

/**
 * 统一归一化 offset / limit 分页参数，防止非法值、负数或过大 limit。
 */
export function normalizePagination(
  rawOffset: unknown,
  rawLimit: unknown,
  options: NormalizePaginationOptions = {},
): { offset: number; limit: number } {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;

  const parsedOffset = Number(rawOffset);
  const offset = Number.isFinite(parsedOffset) ? Math.max(0, Math.trunc(parsedOffset)) : 0;

  const hasLimitInput =
    rawLimit !== undefined && rawLimit !== null && String(rawLimit).trim() !== "";
  const parsedLimit = hasLimitInput ? Number(rawLimit) : defaultLimit;
  const fallbackLimit = Number.isFinite(parsedLimit) && Math.trunc(parsedLimit) > 0
    ? Math.trunc(parsedLimit)
    : defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, fallbackLimit));

  return { offset, limit };
}

/**
 * 统一构建标准分页响应对象 `{ list, total, offset, limit, hasMore }`。
 */
export function buildPaginatedList<T>(
  list: T[],
  rawTotal: unknown,
  offset: number,
  limit: number,
): PaginatedListData<T> {
  const total = Math.max(0, Number(rawTotal) || 0);
  return {
    list,
    total,
    offset,
    limit,
    hasMore: offset + list.length < total,
  };
}
