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

/** 格式化毫秒时间戳为 YYYY-MM-DD HH:mm:ss */
export function formatTimestampFull(ms: number | null): string {
  if (!ms) return "N/A";
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 格式化秒数为 mm:ss 或 hh:mm:ss */
export function formatSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return "00:00";
  const sec = Math.floor(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/** 格式化毫秒时长为人类可读文本，例如 "1小时20分" 或 "45秒" */
export function formatDurationHuman(ms: number): string {
  if (!ms || ms <= 0) return "0秒";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}小时`);
  if (m > 0) parts.push(`${m}分`);
  if (s > 0 || parts.length === 0) parts.push(`${s}秒`);
  return parts.join("");
}
