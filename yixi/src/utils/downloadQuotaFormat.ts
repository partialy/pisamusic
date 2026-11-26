import type { SongDownloadQuotaSnapshot } from "@/types/download";

export function formatQuotaExceededLines(quota: SongDownloadQuotaSnapshot): string[] {
  const lines: string[] = [];
  if (quota.daily.limit !== null) {
    lines.push(`${quota.daily.remaining ?? 0} / ${quota.daily.limit}（次/天，0点刷新）`);
  }
  if (quota.weekly.limit !== null) {
    lines.push(`${quota.weekly.remaining ?? 0} / ${quota.weekly.limit}（次/周，周一0点刷新）`);
  }
  if (quota.monthly.limit !== null) {
    lines.push(`${quota.monthly.remaining ?? 0} / ${quota.monthly.limit}（次/月，1号0点刷新）`);
  }
  if (quota.total.limit !== null) {
    lines.push(`${quota.total.remaining ?? 0} / ${quota.total.limit}（总数）`);
  }
  if ((quota.extraRemaining ?? 0) > 0) {
    lines.push(`额外可用次数：${quota.extraRemaining} 次（常规配额不足时自动抵扣）`);
  }
  return lines;
}
