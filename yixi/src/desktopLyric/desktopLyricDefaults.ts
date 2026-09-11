import type { DesktopLyricBounds, DesktopLyricSettingV2 } from "../types/desktopLyric";

export const DESKTOP_LYRIC_BOUNDS_LIMITS = {
  minWidth: 500,
  maxWidth: 1600,
  minHeight: 100,
  maxHeight: 200,
} as const;

export const DEFAULT_DESKTOP_LYRIC_SETTING: DesktopLyricSettingV2 = {
  enabled: false,
  locked: false,
  overlayTaskbar: false,
  bounds: { x: null, y: null, width: 800, height: 120 },
  fontSize: 40,
  fontFamily: "Microsoft YaHei UI",
  fontWeight: 600,
  textColor: "#f5f7fb",
  highlightColor: "#2897ff",
  animationEnabled: true,
  wordScaleEnabled: true,
  autoOutline: true,
};

export function getDefaultDesktopLyricSetting(): DesktopLyricSettingV2 {
  return {
    ...DEFAULT_DESKTOP_LYRIC_SETTING,
    bounds: { ...DEFAULT_DESKTOP_LYRIC_SETTING.bounds },
  };
}


function isValidCssColor(color: string): boolean {
  if (!color || typeof color !== "string") return false;
  const trimmed = color.trim();
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) return true;
  if (/^(rgb|rgba|hsl|hsla)\([^)]+\)$/.test(trimmed)) return true;
  return false;
}

export function normalizeDesktopLyricBounds(
  bounds: Partial<DesktopLyricBounds> | null | undefined,
): DesktopLyricBounds {
  const defaults = DEFAULT_DESKTOP_LYRIC_SETTING.bounds;
  if (!bounds || typeof bounds !== "object") {
    return { ...defaults };
  }

  const x = typeof bounds.x === "number" && Number.isFinite(bounds.x) ? Math.round(bounds.x) : null;
  const y = typeof bounds.y === "number" && Number.isFinite(bounds.y) ? Math.round(bounds.y) : null;

  const rawWidth =
    typeof bounds.width === "number" && Number.isFinite(bounds.width)
      ? Math.round(bounds.width)
      : defaults.width;
  const width = Math.max(
    DESKTOP_LYRIC_BOUNDS_LIMITS.minWidth,
    Math.min(DESKTOP_LYRIC_BOUNDS_LIMITS.maxWidth, rawWidth),
  );

  const rawHeight =
    typeof bounds.height === "number" && Number.isFinite(bounds.height)
      ? Math.round(bounds.height)
      : defaults.height;
  const height = Math.max(
    DESKTOP_LYRIC_BOUNDS_LIMITS.minHeight,
    Math.min(DESKTOP_LYRIC_BOUNDS_LIMITS.maxHeight, rawHeight),
  );

  return { x, y, width, height };
}

export function normalizeDesktopLyricSetting(input: unknown): DesktopLyricSettingV2 {
  if (!input || typeof input !== "object") {
    return {
      ...DEFAULT_DESKTOP_LYRIC_SETTING,
      bounds: { ...DEFAULT_DESKTOP_LYRIC_SETTING.bounds },
    };
  }
  const raw = input as Record<string, unknown>;

  const enabled =
    typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_DESKTOP_LYRIC_SETTING.enabled;
  const locked =
    typeof raw.locked === "boolean" ? raw.locked : DEFAULT_DESKTOP_LYRIC_SETTING.locked;
  const overlayTaskbar =
    typeof raw.overlayTaskbar === "boolean"
      ? raw.overlayTaskbar
      : DEFAULT_DESKTOP_LYRIC_SETTING.overlayTaskbar;

  const rawFontSize =
    typeof raw.fontSize === "number" && Number.isFinite(raw.fontSize)
      ? Math.round(raw.fontSize)
      : DEFAULT_DESKTOP_LYRIC_SETTING.fontSize;
  const fontSize = Math.max(10, Math.min(64, rawFontSize));

  const fontFamily =
    typeof raw.fontFamily === "string" && raw.fontFamily.trim().length > 0
      ? raw.fontFamily.trim()
      : DEFAULT_DESKTOP_LYRIC_SETTING.fontFamily;

  const rawFontWeight =
    typeof raw.fontWeight === "number" && Number.isFinite(raw.fontWeight)
      ? Math.round(raw.fontWeight)
      : DEFAULT_DESKTOP_LYRIC_SETTING.fontWeight;
  const fontWeight = Math.max(100, Math.min(900, rawFontWeight));

  const textColor =
    typeof raw.textColor === "string" && isValidCssColor(raw.textColor)
      ? raw.textColor.trim()
      : DEFAULT_DESKTOP_LYRIC_SETTING.textColor;
  const highlightColor =
    typeof raw.highlightColor === "string" && isValidCssColor(raw.highlightColor)
      ? raw.highlightColor.trim()
      : DEFAULT_DESKTOP_LYRIC_SETTING.highlightColor;

  const animationEnabled =
    typeof raw.animationEnabled === "boolean"
      ? raw.animationEnabled
      : DEFAULT_DESKTOP_LYRIC_SETTING.animationEnabled;
  const wordScaleEnabled =
    typeof raw.wordScaleEnabled === "boolean"
      ? raw.wordScaleEnabled
      : DEFAULT_DESKTOP_LYRIC_SETTING.wordScaleEnabled;
  const autoOutline =
    typeof raw.autoOutline === "boolean"
      ? raw.autoOutline
      : DEFAULT_DESKTOP_LYRIC_SETTING.autoOutline;

  const bounds = normalizeDesktopLyricBounds(
    raw.bounds as Partial<DesktopLyricBounds> | undefined,
  );

  return {
    enabled,
    locked,
    overlayTaskbar,
    bounds,
    fontSize,
    fontFamily,
    fontWeight,
    textColor,
    highlightColor,
    animationEnabled,
    wordScaleEnabled,
    autoOutline,
  };
}
