import type { CloudMusicBatchDraftItem } from "../types/cloudMusic";
import { TimestampFormat, type IAudioMetadata } from "music-metadata";

export function detectLyricsFormat(text: string): "lrc" | "txt" {
  return /\[\d+:[0-5]\d(?:[.:]\d{1,3})?\]/.test(text) ? "lrc" : "txt";
}

function formatLrcTimestamp(milliseconds: number): string {
  const ms = Math.round(milliseconds);
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}]`;
}

/** 原始 LRC 优先，保留 offset、多时间标签；其次使用明确标注毫秒的同步标签，最后才使用纯文本。 */
export function extractEmbeddedLyrics(metadata: IAudioMetadata): string {
  const candidates: unknown[] = [];
  const lyricTagIds = new Set(["USLT", "ULT", "SYLT", "LYRICS", "UNSYNCEDLYRICS", "©LYR", "WM/LYRICS"]);
  for (const tags of Object.values(metadata.native ?? {})) {
    for (const tag of tags) {
      if (lyricTagIds.has(tag.id.toUpperCase())) candidates.push(tag.value);
    }
  }
  candidates.push(...(metadata.common.lyrics ?? []));
  const plain: string[] = [];
  const synchronized: string[] = [];
  for (const candidate of candidates) {
    const value = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : null;
    const text = typeof candidate === "string" ? candidate : typeof value?.text === "string" ? value.text : "";
    if (text.trim()) {
      if (detectLyricsFormat(text) === "lrc") return text.replace(/^\uFEFF/, "");
      plain.push(text.replace(/^\uFEFF/, ""));
    }
    if (!Array.isArray(value?.syncText)) continue;
    const lines = value.syncText as Array<{ text?: unknown; timestamp?: unknown }>;
    // ID3 SYLT 也可能使用 MPEG 帧编号，不能猜测为秒或毫秒。
    if (value.timeStampFormat === TimestampFormat.milliseconds && lines.length > 0 && lines.every(
      (line) => typeof line.timestamp === "number" && Number.isFinite(line.timestamp) && line.timestamp >= 0,
    )) {
      synchronized.push(lines.map((line) => `${formatLrcTimestamp(line.timestamp as number)}${typeof line.text === "string" ? line.text : ""}`).join("\n"));
    } else if (!text.trim()) {
      const content = lines.map((line) => typeof line.text === "string" ? line.text : "").join("\n");
      if (content.trim()) plain.push(content);
    }
  }
  return synchronized[0] ?? plain[0] ?? "";
}

export function buildLyricsFileFromDraft(draft: CloudMusicBatchDraftItem): File | undefined {
  const content = draft.lyricsText.trim();
  if (!content) return undefined;
  const ext = detectLyricsFormat(content);
  const safeBaseName = (draft.title.trim() || "lyrics").replace(/[\\/:*?"<>|]+/g, "_");
  const fileName = draft.lyricsFileName?.trim()
    ? draft.lyricsFileName.replace(/\.(lrc|txt)$/i, "") + `.${ext}`
    : `${safeBaseName}.${ext}`;
  return new File([content], fileName, { type: "text/plain;charset=utf-8" });
}

