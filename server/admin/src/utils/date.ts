export function formatDateTimeLocal(timestamp: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateTimeLocal(dtString: string): number {
  if (!dtString) return 0;
  return new Date(dtString).getTime();
}

/** 当前 +8 区时间字符串 YYYY-MM-DD HH:mm */
export function getCurrentPlus8Time(): string {
  const now = new Date();
  const plus8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return plus8Time.toISOString().slice(0, 16).replace("T", " ");
}

/** 格式化毫秒时间戳为 YYYY-MM-DD HH:mm */
export function formatTimestamp(ms: number | null): string {
  if (!ms) return "N/A";
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
