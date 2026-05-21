import type { LyricLine } from "@/utils/common/LyricParser";

export const EMPTY_LYRIC_TEXT = "暂无歌词";

export function getLyricLineText(line?: LyricLine | null) {
  if (!line?.words?.length) return "";
  return line.words.map((word) => word.word).join("");
}

export function normalizePlaybackTimeToMs(time: number) {
  if (!Number.isFinite(time)) return 0;
  return time > 1000 ? Math.floor(time) : Math.floor(time * 1000);
}

export function getLyricLineEndTime(lines: LyricLine[], index: number) {
  const line = lines[index];
  if (!line) return 0;
  if (line.endTime > line.startTime) return line.endTime;
  return lines[index + 1]?.startTime ?? line.startTime + 5000;
}

export function findLyricLineIndex(lines: LyricLine[], timeMs: number) {
  if (!lines.length) return -1;
  if (timeMs < lines[0].startTime) return 0;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line || timeMs < line.startTime) continue;
    const endTime = getLyricLineEndTime(lines, index);
    if (timeMs <= endTime || timeMs < (lines[index + 1]?.startTime ?? Infinity) || index === lines.length - 1) {
      return index;
    }
  }

  return 0;
}
