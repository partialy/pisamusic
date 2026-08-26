const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function toShanghaiDay(timestamp: number): string {
  return new Date(timestamp + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

export function shanghaiDayStart(day: string): number {
  return Date.parse(`${day}T00:00:00+08:00`);
}

export function buildShanghaiDayRange(
  days: 7 | 30 | 90,
  now = Date.now(),
): { startAt: number; dates: string[] } {
  const currentDay = toShanghaiDay(now);
  const currentStart = shanghaiDayStart(currentDay);
  const dates: string[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const timestamp = currentStart - i * ONE_DAY_MS;
    dates.push(toShanghaiDay(timestamp));
  }

  const firstDate = dates[0] ?? currentDay;
  const startAt = shanghaiDayStart(firstDate);

  return { startAt, dates };
}
