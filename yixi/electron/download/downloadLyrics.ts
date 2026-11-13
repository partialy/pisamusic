import { LyricParser } from "../../src/utils/common/LyricParser";
import type { LyricLine } from "../../src/utils/common/LyricParser";
import type { DownloadLyricsMode } from "../../src/utils/downloadSettings";

export type DownloadLyricAsset = { format: "krc" | "yrc" | "lrc"; text: string };
export function buildDownloadLyrics(source: string, input: { krc?: string; lrc?: string }, fallback: { krc?: string; lyric?: string } = {}) {
  const assets: DownloadLyricAsset[] = [];
  // 按实际语法识别，不把 WY 返回的 krc 字段名当作格式。
  for (const text of [input.krc, fallback.krc, input.lrc, fallback.lyric]) {
    if (!text?.trim()) continue;
    const format = /\[\d+,\d+\]<\d+,\d+,\d+>/.test(text) ? "krc"
      : /\[\d+,\d+\]\(\d+,\d+,\d+\)/.test(text) ? "yrc" : "lrc";
    const lines = parse(format, text);
    if (!lines.length || assets.some(asset => asset.format === format)) continue;
    if (format !== "lrc" && source !== "kg" && source !== "wy") continue;
    assets.push({ format, text: text.trim() });
  }
  const line = assets.find(asset => asset.format === "lrc");
  const word = assets.find(asset => asset.format !== "lrc");
  const standardLrc = line ? toLrc(parse("lrc", line.text)) : word ? toLrc(parse(word.format, word.text)) : "";
  if (!line && standardLrc) assets.push({ format: "lrc", text: standardLrc });
  return { assets, standardLrc };
}
export function selectDownloadLyrics(assets: DownloadLyricAsset[], mode: DownloadLyricsMode) {
  if (mode === "off") return [];
  if (mode === "all") return assets;
  const selected = mode === "word" ? assets.find(asset => asset.format !== "lrc") ?? assets.find(asset => asset.format === "lrc")
    : assets.find(asset => asset.format === "lrc");
  return selected ? [selected] : [];
}
function parse(format: DownloadLyricAsset["format"], text: string) {
  return format === "krc" ? LyricParser.parseKrc(text) : format === "yrc" ? LyricParser.parseYrc(text) : LyricParser.parseLrc(text);
}
function toLrc(lines: LyricLine[]) {
  return lines.map(line => {
    const ms = Math.max(0, Math.round(line.startTime));
    return `[${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}]${line.words.map(word => word.word).join("")}`;
  }).join("\n");
}
