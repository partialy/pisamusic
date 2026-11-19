const BEIJING_OFFSET_MS = 8 * 3600_000;

export type BeijingPeriodKeys = {
  dayKey: string;
  weekKey: string;
  monthKey: string;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * 按北京时间（UTC+8）计算当前周期标识：
 * - dayKey: YYYY-MM-DD（每日 00:00 刷新）
 * - weekKey: 本周一 YYYY-MM-DD（每周一 00:00 刷新）
 * - monthKey: YYYY-MM（每月 1 号 00:00 刷新）
 */
export function getBeijingPeriodKeys(timestampMs: number = Date.now()): BeijingPeriodKeys {
  const shifted = new Date(timestampMs + BEIJING_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const date = shifted.getUTCDate();
  const dayOfWeek = shifted.getUTCDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  const mondayDiff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayDate = new Date(Date.UTC(year, month - 1, date - mondayDiff));

  return {
    dayKey: `${year}-${pad2(month)}-${pad2(date)}`,
    weekKey: `${mondayDate.getUTCFullYear()}-${pad2(mondayDate.getUTCMonth() + 1)}-${pad2(mondayDate.getUTCDate())}`,
    monthKey: `${year}-${pad2(month)}`,
  };
}

/** 返回近 N 天的北京时间 YYYY-MM-DD 升序列表（含今天）。 */
export function listRecentBeijingDays(days: number, nowMs: number = Date.now()): string[] {
  const count = Math.max(1, Math.trunc(days));
  const shifted = new Date(nowMs + BEIJING_OFFSET_MS);
  const endUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const list: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(endUtc - i * 86_400_000);
    list.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`);
  }
  return list;
}
