import {
  DESKTOP_LYRIC_STYLE_OPTIONS,
  getDefaultDesktopLyricStyleSettings,
  normalizeDesktopLyricStyleSettings,
  normalizeLyricStyleColor,
} from "../desktopLyric/desktopLyricDefaults";
import type { DesktopLyricStyleConfigMap } from "../types/desktopLyric";

export const PLAYER_EFFECT_STYLE_IDS = ["typewriter", "ink", "bounce", "spotlight", "neon", "ocean"] as const;
export type PlayerEffectStyleId = typeof PLAYER_EFFECT_STYLE_IDS[number];
export type PlayerLyricStyleId = "default" | "amlyric" | PlayerEffectStyleId;

export interface PlayerLyricStyleConfigMap extends Pick<DesktopLyricStyleConfigMap, PlayerEffectStyleId> {
  default: { textColor: string; highlightColor: string };
  amlyric: { textColor: string; spring: boolean; scale: boolean; blur: boolean; hidePassedLines: boolean };
}

export const PLAYER_LYRIC_STYLE_OPTIONS: ReadonlyArray<{
  value: PlayerLyricStyleId; label: string; description: string;
}> = [
  { value: "default", label: "默认", description: "经典多行歌词，保留现有逐字填充和当前行高亮。" },
  { value: "amlyric", label: "AMLyric", description: "Apple Music 风格的弹簧滚动、缩放和背景行柔焦。" },
  ...DESKTOP_LYRIC_STYLE_OPTIONS.filter(
    (item): item is typeof item & { value: PlayerEffectStyleId } => isPlayerEffectStyle(item.value),
  ),
];

export function isPlayerEffectStyle(value: unknown): value is PlayerEffectStyleId {
  return (PLAYER_EFFECT_STYLE_IDS as readonly unknown[]).includes(value);
}

export function isPlayerLyricStyle(value: unknown): value is PlayerLyricStyleId {
  return value === "default" || value === "amlyric" || isPlayerEffectStyle(value);
}

export function getDefaultPlayerLyricStyles(): PlayerLyricStyleConfigMap {
  const shared = getDefaultDesktopLyricStyleSettings();
  return {
    default: { textColor: "#ffffff", highlightColor: "#ffffff" },
    amlyric: { textColor: "#ffffff", spring: true, scale: true, blur: true, hidePassedLines: false },
    typewriter: shared.typewriter,
    ink: shared.ink,
    bounce: shared.bounce,
    spotlight: shared.spotlight,
    neon: shared.neon,
    ocean: shared.ocean,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizePlayerLyricStyles(input: unknown, legacy: Record<string, unknown>): PlayerLyricStyleConfigMap {
  const raw = asRecord(input);
  const defaults = getDefaultPlayerLyricStyles();
  const def = asRecord(raw.default);
  const am = asRecord(raw.amlyric);
  // 复用颜色与五款参数归一规则，不把桌面窗口、锁定等字段带入播放页配置。
  const shared = normalizeDesktopLyricStyleSettings(raw);
  const boolean = (value: unknown, oldValue: unknown, fallback: boolean) =>
    typeof value === "boolean" ? value : typeof oldValue === "boolean" ? oldValue : fallback;
  return {
    default: {
      textColor: normalizeLyricStyleColor(def.textColor ?? legacy.lyricFontColor, defaults.default.textColor),
      highlightColor: normalizeLyricStyleColor(def.highlightColor ?? legacy.currentLyricColor, defaults.default.highlightColor),
    },
    amlyric: {
      textColor: normalizeLyricStyleColor(am.textColor ?? legacy.lyricFontColor, defaults.amlyric.textColor),
      spring: boolean(am.spring, legacy.useAMSpring, defaults.amlyric.spring),
      scale: boolean(am.scale, legacy.useAMScale, defaults.amlyric.scale),
      blur: boolean(am.blur, legacy.useAMBlur, defaults.amlyric.blur),
      hidePassedLines: boolean(am.hidePassedLines, legacy.hidePassedLines, defaults.amlyric.hidePassedLines),
    },
    typewriter: shared.typewriter, ink: shared.ink, bounce: shared.bounce,
    spotlight: shared.spotlight, neon: shared.neon, ocean: shared.ocean,
  };
}

export function getPlayerStyleTextColor(style: PlayerLyricStyleId, styles: PlayerLyricStyleConfigMap): string {
  if (style === "typewriter" || style === "default" || style === "amlyric") return styles[style].textColor;
  return styles[style].unlitColor;
}
