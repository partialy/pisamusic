/** 规范化歌曲封面 URL（将 KG 模板中的 {size} / %7Bsize%7D 替换为指定分辨率，默认 240）。 */
export function resolveSongCoverUrl(url?: string | null, size = 240): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\{size\}|%7Bsize%7D/gi, String(size));
}

export function formatDurationMs(durationMs?: number | null): string {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) {
    return "-";
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
}
