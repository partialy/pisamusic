import type { Song } from "@/types/song";

export type QualitySource = "kg" | "wy" | "kw";

export type MusicQualityOption = {
  key: string;
  source: QualitySource;
  label: string;
  shortLabel: string;
  kind: "kg" | "wy-br" | "wy-level" | "kw";
  quality?: string;
  br?: number;
  level?: string;
};

export type PlaybackQualityPreference = Partial<Record<QualitySource, string>>;

export const PLAYBACK_QUALITY_SETTING_KEY = "playback-quality-preference";

const kgOptions: MusicQualityOption[] = [
  { key: "kg:128", source: "kg", label: "128 kbps MP3", shortLabel: "128", kind: "kg", quality: "128" },
  { key: "kg:320", source: "kg", label: "320 kbps MP3", shortLabel: "320", kind: "kg", quality: "320" },
  { key: "kg:flac", source: "kg", label: "FLAC", shortLabel: "FLAC", kind: "kg", quality: "flac" },
  { key: "kg:high", source: "kg", label: "无损 (high)", shortLabel: "HQ", kind: "kg", quality: "high" },
  { key: "kg:viper_atmos", source: "kg", label: "蝰蛇全景声", shortLabel: "VIPER", kind: "kg", quality: "viper_atmos" },
  { key: "kg:viper_clear", source: "kg", label: "蝰蛇超清音质", shortLabel: "CLEAR", kind: "kg", quality: "viper_clear" },
];

const wyOptions: MusicQualityOption[] = [
  { key: "wy-br:128000", source: "wy", label: "[码率] 128 kbps", shortLabel: "128", kind: "wy-br", br: 128000 },
  { key: "wy-br:320000", source: "wy", label: "[码率] 320 kbps", shortLabel: "320", kind: "wy-br", br: 320000 },
  { key: "wy-br:999000", source: "wy", label: "[码率] 999000（最大）", shortLabel: "SQ", kind: "wy-br", br: 999000 },
  { key: "wy-level:standard", source: "wy", label: "[音质等级] 标准 standard", shortLabel: "STD", kind: "wy-level", level: "standard" },
  { key: "wy-level:higher", source: "wy", label: "[音质等级] 较高 higher", shortLabel: "HQ", kind: "wy-level", level: "higher" },
  { key: "wy-level:exhigh", source: "wy", label: "[音质等级] 极高 exhigh", shortLabel: "SQ", kind: "wy-level", level: "exhigh" },
  { key: "wy-level:lossless", source: "wy", label: "[音质等级] 无损 lossless", shortLabel: "FLAC", kind: "wy-level", level: "lossless" },
  { key: "wy-level:hires", source: "wy", label: "[音质等级] Hi-Res", shortLabel: "RES", kind: "wy-level", level: "hires" },
  { key: "wy-level:jyeffect", source: "wy", label: "[音质等级] 高清环绕声", shortLabel: "HQ", kind: "wy-level", level: "jyeffect" },
  { key: "wy-level:sky", source: "wy", label: "[音质等级] 沉浸环绕声", shortLabel: "SKY", kind: "wy-level", level: "sky" },
  { key: "wy-level:dolby", source: "wy", label: "[音质等级] 杜比全景声", shortLabel: "DOLBY", kind: "wy-level", level: "dolby" },
  { key: "wy-level:jymaster", source: "wy", label: "[音质等级] 超清母带", shortLabel: "CLEAR", kind: "wy-level", level: "jymaster" },
];

const kwOptions: MusicQualityOption[] = [
  { key: "kw:standard", source: "kw", label: "标准 standard", shortLabel: "STD", kind: "kw", quality: "standard" },
  { key: "kw:exhigh", source: "kw", label: "极高 exhigh", shortLabel: "SQ", kind: "kw", quality: "exhigh" },
  { key: "kw:lossless", source: "kw", label: "无损 lossless", shortLabel: "FLAC", kind: "kw", quality: "lossless" },
];

const optionMap = new Map([...kgOptions, ...wyOptions, ...kwOptions].map((option) => [option.key, option]));

export function getQualityOptionsForSong(song?: Pick<Song, "source"> | null) {
  if (!song) return [];
  switch (song.source) {
    case "kg":
      return kgOptions;
    case "wy":
      return wyOptions;
    case "kw":
      return kwOptions;
    default:
      return [];
  }
}

export function getQualityOption(key?: string | null) {
  return key ? optionMap.get(key) ?? null : null;
}

export function getDefaultQualityKey(source: QualitySource) {
  switch (source) {
    case "kg":
      return "kg:320";
    case "wy":
      return "wy-level:exhigh";
    case "kw":
      return "kw:exhigh";
  }
}

export function isQualitySource(source: Song["source"]): source is QualitySource {
  return source === "kg" || source === "wy" || source === "kw";
}
