import { getDefaultBackgroundConfig, normalizeBackgroundConfig, type PlayerBackgroundConfig } from "@/playerBackground/backgroundConfig";
import { getDefaultPlayerLyricStyles, isPlayerLyricStyle, normalizePlayerLyricStyles, type PlayerLyricStyleId, type PlayerLyricStyleConfigMap } from "@/lyricStyles/playerLyricConfig";
export interface LyricSetting {
  style: PlayerLyricStyleId;
  styles: PlayerLyricStyleConfigMap;
  useKRC: boolean;
  alignPosition: number;
  alignAnchor: "top" | "center" | "bottom";
  pureLyricMode: boolean;
  immersiveMode: boolean;
  autoCollapsePlayQueue: boolean;
  lyricFontSize: number;
  lyricFont: string;
  lyricFontWeight: boolean;
  lyricFontOpacity: number;
  lyricFontShadow: boolean;
  showTime: boolean;
  background: PlayerBackgroundConfig;
}

export const LYRIC_SETTING_RANGES = {
  fontSize: { min: 12, max: 60, step: 1 },
  opacity: { min: 0.01, max: 1, step: 0.01 },
  alignPosition: { min: 0, max: 1, step: 0.05 },
} as const;

export const getDefaultLyricSetting = (): LyricSetting => ({
  style: "amlyric",
  styles: getDefaultPlayerLyricStyles(),
  useKRC: true,
  pureLyricMode: false,
  immersiveMode: false,
  autoCollapsePlayQueue: false,
  alignPosition: 0.5,
  alignAnchor: "center",
  lyricFontSize: 40,
  lyricFont: "Microsoft YaHei",
  lyricFontWeight: true,
  lyricFontOpacity: 1,
  lyricFontShadow: true,
  showTime: true,
  background: getDefaultBackgroundConfig(),
});

export function normalizeLyricSetting(input: unknown): LyricSetting {
  const defaults = getDefaultLyricSetting();
  if (!input || typeof input !== "object" || Array.isArray(input)) return defaults;
  const source = input as Record<string, unknown>;
  const setting = { ...defaults };

  for (const key of Object.keys(defaults) as (keyof LyricSetting)[]) {
    if (typeof defaults[key] === "boolean" && typeof source[key] === "boolean") {
      (setting as unknown as Record<string, unknown>)[key] = source[key];
    }
  }
  for (const key of ["lyricFont"] as const) {
    // 保留系统字体名称，未安装时由渲染器回退。
    const value = source[key];
    if (typeof value === "string" && value.trim()) setting[key] = value;
  }
  setting.style = isPlayerLyricStyle(source.style) ? source.style : source.useAMLyric === false ? "default" : "amlyric";
  setting.styles = normalizePlayerLyricStyles(source.styles, source);
  setting.background = normalizeBackgroundConfig(source.background, source);
  if (source.alignAnchor === "top" || source.alignAnchor === "center" || source.alignAnchor === "bottom") {
    setting.alignAnchor = source.alignAnchor;
  }
  setting.lyricFontSize = normalizeNumber(source.lyricFontSize, defaults.lyricFontSize, LYRIC_SETTING_RANGES.fontSize);
  setting.lyricFontOpacity = normalizeNumber(source.lyricFontOpacity, defaults.lyricFontOpacity, LYRIC_SETTING_RANGES.opacity);
  setting.alignPosition = normalizeNumber(source.alignPosition, defaults.alignPosition, LYRIC_SETTING_RANGES.alignPosition);
  return setting;
}

function normalizeNumber(value: unknown, fallback: number, range: { min: number; max: number; step: number }) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(range.min, Math.min(range.max, value));
}
