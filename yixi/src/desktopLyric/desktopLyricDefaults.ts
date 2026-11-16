import type {
  DesktopLyricBounds,
  DesktopLyricParticleDensity,
  DesktopLyricSettingPatch,
  DesktopLyricSettingV2,
  DesktopLyricStyleConfigMap,
  DesktopLyricStyleId,
} from "../types/desktopLyric";

export const DESKTOP_LYRIC_BOUNDS_LIMITS = {
  minWidth: 500,
  maxWidth: 1600,
  minHeight: 100,
  maxHeight: 200,
} as const;

export const DESKTOP_LYRIC_STYLE_IDS: readonly DesktopLyricStyleId[] = [
  "default",
  "typewriter",
  "ink",
  "bounce",
  "spotlight",
  "neon",
  "particle",
] as const;

export const DESKTOP_LYRIC_STYLE_OPTIONS: ReadonlyArray<{
  value: DesktopLyricStyleId;
  label: string;
  description: string;
}> = [
  {
    value: "default",
    label: "默认（经典歌词）",
    description: "经典逐字填充与放大高亮样式，支持开关过渡动画。",
  },
  {
    value: "typewriter",
    label: "打字机逐现",
    description: "逐字按时间敲出；逐行歌词按设定时长匀速打出并附带闪烁光标。",
  },
  {
    value: "ink",
    label: "水墨流光",
    description: "渐进羽化扫光浸润文字，当前唱到的字轻微上浮。",
  },
  {
    value: "bounce",
    label: "律动弹跳",
    description: "字符围绕字心弹性跃起并高亮，逐行歌词呈现级联波浪轻弹。",
  },
  {
    value: "spotlight",
    label: "聚光灯聚焦",
    description: "切句柔焦清晰转场，当前字呈现强聚光灯外发光高亮。",
  },
  {
    value: "neon",
    label: "流彩星尘霓虹",
    description: "多段极光流彩渐变填充并带扫描前沿高光锋。",
  },
  {
    value: "particle",
    label: "粒子聚散星尘",
    description: "新句由星尘粒子汇聚成型，句末随风涣散为粒子消逝。",
  },
] as const;

export const DESKTOP_LYRIC_STYLE_LIMITS = {
  typewriterRevealMs: { min: 150, max: 1500, step: 50 },
  inkFeatherWidth: { min: 6, max: 36, step: 2 },
  inkLiftOffset: { min: 0, max: 8, step: 0.5 },
  inkSweepMs: { min: 200, max: 2000, step: 50 },
  bounceJumpHeight: { min: 2, max: 16, step: 1 },
  bounceJumpScale: { min: 1, max: 1.3, step: 0.02 },
  spotlightBlur: { min: 0, max: 8, step: 0.5 },
  spotlightScale: { min: 1, max: 1.25, step: 0.01 },
  neonRevealMs: { min: 150, max: 1500, step: 50 },
  neonFlowSpeed: { min: 0, max: 2, step: 0.1 },
  particleGatherMs: { min: 250, max: 1000, step: 20 },
  particleDisperseMs: { min: 250, max: 1000, step: 20 },
} as const;

export function getDefaultDesktopLyricStyleSettings(): DesktopLyricStyleConfigMap {
  return {
    default: {
      textColor: "#f5f7fb",
      highlightColor: "#2897ff",
      animationEnabled: true,
      wordScaleEnabled: true,
    },
    typewriter: {
      textColor: "#38bdf8",
      latestGlowColor: "#7dd3fc",
      lineRevealDurationMs: 600,
      showCursor: true,
    },
    ink: {
      unlitColor: "rgba(241, 245, 249, 0.36)",
      highlightStartColor: "#2897ff",
      highlightTipColor: "#67e8f9",
      featherWidth: 16,
      liftOffset: 2.5,
      lineSweepDurationMs: 950,
    },
    bounce: {
      unlitColor: "rgba(241, 245, 249, 0.36)",
      sungColor: "#20b46b",
      activeColor: "#34d399",
      jumpHeight: 7,
      jumpScale: 1.14,
    },
    spotlight: {
      unlitColor: "rgba(241, 245, 249, 0.34)",
      sungColor: "#f8fafc",
      activeColor: "#ffffff",
      glowColor: "rgba(56, 189, 248, 0.92)",
      blurIntensity: 4,
      activeScale: 1.07,
    },
    neon: {
      unlitColor: "rgba(241, 245, 249, 0.34)",
      colorStart: "#20b46b",
      colorMid: "#38bdf8",
      colorEnd: "#a78bfa",
      lineRevealDurationMs: 650,
      flowSpeed: 1,
    },
    particle: {
      unlitColor: "rgba(241, 245, 249, 0.34)",
      colorStart: "#34d399",
      colorEnd: "#38bdf8",
      gatherDurationMs: 560,
      disperseDurationMs: 460,
      particleDensity: "balanced",
      showAmbientSparks: true,
    },
  };
}

export const DEFAULT_DESKTOP_LYRIC_SETTING: DesktopLyricSettingV2 = {
  enabled: false,
  locked: false,
  overlayTaskbar: false,
  bounds: { x: null, y: null, width: 800, height: 120 },
  fontSize: 40,
  fontFamily: "Microsoft YaHei UI",
  fontWeight: 600,
  autoOutline: true,
  style: "default",
  styles: getDefaultDesktopLyricStyleSettings(),
  textColor: "#f5f7fb",
  highlightColor: "#2897ff",
  animationEnabled: true,
  wordScaleEnabled: true,
};

export function getDefaultDesktopLyricSetting(): DesktopLyricSettingV2 {
  const styles = getDefaultDesktopLyricStyleSettings();
  return {
    ...DEFAULT_DESKTOP_LYRIC_SETTING,
    bounds: { ...DEFAULT_DESKTOP_LYRIC_SETTING.bounds },
    styles,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isValidCssColor(color: unknown): color is string {
  if (!color || typeof color !== "string") return false;
  const trimmed = color.trim();
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) return true;
  if (/^(rgb|rgba|hsl|hsla)\([^)]+\)$/.test(trimmed)) return true;
  return false;
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  roundInt = false,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const clamped = Math.max(min, Math.min(max, value));
  return roundInt ? Math.round(clamped) : Math.round(clamped * 100) / 100;
}

function pickColor(value: unknown, fallback: string): string {
  return isValidCssColor(value) ? value.trim() : fallback;
}

export function normalizeLyricStyleColor(value: unknown, fallback: string): string {
  return pickColor(value, fallback);
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function isDesktopLyricStyleId(value: unknown): value is DesktopLyricStyleId {
  return (
    typeof value === "string" &&
    (DESKTOP_LYRIC_STYLE_IDS as readonly string[]).includes(value)
  );
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

  const width = clampNumber(
    bounds.width,
    defaults.width,
    DESKTOP_LYRIC_BOUNDS_LIMITS.minWidth,
    DESKTOP_LYRIC_BOUNDS_LIMITS.maxWidth,
    true,
  );
  const height = clampNumber(
    bounds.height,
    defaults.height,
    DESKTOP_LYRIC_BOUNDS_LIMITS.minHeight,
    DESKTOP_LYRIC_BOUNDS_LIMITS.maxHeight,
    true,
  );

  return { x, y, width, height };
}

export function normalizeDesktopLyricStyleSettings(
  input: unknown,
  legacy: unknown = {},
): DesktopLyricStyleConfigMap {
  const rawStyles = asRecord(input);
  const rawRoot = asRecord(legacy);
  const defaults = getDefaultDesktopLyricStyleSettings();
  const hasExplicitDefault =
    rawStyles.default && typeof rawStyles.default === "object" && !Array.isArray(rawStyles.default);
  const def = asRecord(rawStyles.default);
  const tw = asRecord(rawStyles.typewriter);
  const ink = asRecord(rawStyles.ink);
  const bounce = asRecord(rawStyles.bounce);
  const spotlight = asRecord(rawStyles.spotlight);
  const neon = asRecord(rawStyles.neon);
  const particle = asRecord(rawStyles.particle);
  const limits = DESKTOP_LYRIC_STYLE_LIMITS;

  // 旧版本升级迁移：无 styles.default 时从顶层兼容字段读取默认值。
  const defaultStyle = {
    textColor: pickColor(
      hasExplicitDefault ? def.textColor : rawRoot.textColor,
      defaults.default.textColor,
    ),
    highlightColor: pickColor(
      hasExplicitDefault ? def.highlightColor : rawRoot.highlightColor,
      defaults.default.highlightColor,
    ),
    animationEnabled: pickBool(
      hasExplicitDefault ? def.animationEnabled : rawRoot.animationEnabled,
      defaults.default.animationEnabled,
    ),
    wordScaleEnabled: pickBool(
      hasExplicitDefault ? def.wordScaleEnabled : rawRoot.wordScaleEnabled,
      defaults.default.wordScaleEnabled,
    ),
  };

  const density: DesktopLyricParticleDensity =
    particle.particleDensity === "fine" ||
    particle.particleDensity === "balanced" ||
    particle.particleDensity === "light"
      ? particle.particleDensity
      : defaults.particle.particleDensity;

  return {
    default: defaultStyle,
    typewriter: {
      textColor: pickColor(tw.textColor, defaults.typewriter.textColor),
      latestGlowColor: pickColor(tw.latestGlowColor, defaults.typewriter.latestGlowColor),
      lineRevealDurationMs: clampNumber(
        tw.lineRevealDurationMs,
        defaults.typewriter.lineRevealDurationMs,
        limits.typewriterRevealMs.min,
        limits.typewriterRevealMs.max,
        true,
      ),
      showCursor: pickBool(tw.showCursor, defaults.typewriter.showCursor),
    },
    ink: {
      unlitColor: pickColor(ink.unlitColor, defaults.ink.unlitColor),
      highlightStartColor: pickColor(ink.highlightStartColor, defaults.ink.highlightStartColor),
      highlightTipColor: pickColor(ink.highlightTipColor, defaults.ink.highlightTipColor),
      featherWidth: clampNumber(
        ink.featherWidth,
        defaults.ink.featherWidth,
        limits.inkFeatherWidth.min,
        limits.inkFeatherWidth.max,
        true,
      ),
      liftOffset: clampNumber(
        ink.liftOffset,
        defaults.ink.liftOffset,
        limits.inkLiftOffset.min,
        limits.inkLiftOffset.max,
      ),
      lineSweepDurationMs: clampNumber(
        ink.lineSweepDurationMs,
        defaults.ink.lineSweepDurationMs,
        limits.inkSweepMs.min,
        limits.inkSweepMs.max,
        true,
      ),
    },
    bounce: {
      unlitColor: pickColor(bounce.unlitColor, defaults.bounce.unlitColor),
      sungColor: pickColor(bounce.sungColor, defaults.bounce.sungColor),
      activeColor: pickColor(bounce.activeColor, defaults.bounce.activeColor),
      jumpHeight: clampNumber(
        bounce.jumpHeight,
        defaults.bounce.jumpHeight,
        limits.bounceJumpHeight.min,
        limits.bounceJumpHeight.max,
        true,
      ),
      jumpScale: clampNumber(
        bounce.jumpScale,
        defaults.bounce.jumpScale,
        limits.bounceJumpScale.min,
        limits.bounceJumpScale.max,
      ),
    },
    spotlight: {
      unlitColor: pickColor(spotlight.unlitColor, defaults.spotlight.unlitColor),
      sungColor: pickColor(spotlight.sungColor, defaults.spotlight.sungColor),
      activeColor: pickColor(spotlight.activeColor, defaults.spotlight.activeColor),
      glowColor: pickColor(spotlight.glowColor, defaults.spotlight.glowColor),
      blurIntensity: clampNumber(
        spotlight.blurIntensity,
        defaults.spotlight.blurIntensity,
        limits.spotlightBlur.min,
        limits.spotlightBlur.max,
      ),
      activeScale: clampNumber(
        spotlight.activeScale,
        defaults.spotlight.activeScale,
        limits.spotlightScale.min,
        limits.spotlightScale.max,
      ),
    },
    neon: {
      unlitColor: pickColor(neon.unlitColor, defaults.neon.unlitColor),
      colorStart: pickColor(neon.colorStart, defaults.neon.colorStart),
      colorMid: pickColor(neon.colorMid, defaults.neon.colorMid),
      colorEnd: pickColor(neon.colorEnd, defaults.neon.colorEnd),
      lineRevealDurationMs: clampNumber(
        neon.lineRevealDurationMs,
        defaults.neon.lineRevealDurationMs,
        limits.neonRevealMs.min,
        limits.neonRevealMs.max,
        true,
      ),
      flowSpeed: clampNumber(
        neon.flowSpeed,
        defaults.neon.flowSpeed,
        limits.neonFlowSpeed.min,
        limits.neonFlowSpeed.max,
      ),
    },
    particle: {
      unlitColor: pickColor(particle.unlitColor, defaults.particle.unlitColor),
      colorStart: pickColor(particle.colorStart, defaults.particle.colorStart),
      colorEnd: pickColor(particle.colorEnd, defaults.particle.colorEnd),
      gatherDurationMs: clampNumber(
        particle.gatherDurationMs,
        defaults.particle.gatherDurationMs,
        limits.particleGatherMs.min,
        limits.particleGatherMs.max,
        true,
      ),
      disperseDurationMs: clampNumber(
        particle.disperseDurationMs,
        defaults.particle.disperseDurationMs,
        limits.particleDisperseMs.min,
        limits.particleDisperseMs.max,
        true,
      ),
      particleDensity: density,
      showAmbientSparks: pickBool(
        particle.showAmbientSparks,
        defaults.particle.showAmbientSparks,
      ),
    },
  };
}

export function normalizeDesktopLyricSetting(input: unknown): DesktopLyricSettingV2 {
  if (!input || typeof input !== "object") {
    return getDefaultDesktopLyricSetting();
  }
  const raw = input as Record<string, unknown>;
  const rawStyles = asRecord(raw.styles);
  const styles = normalizeDesktopLyricStyleSettings(rawStyles, raw);

  const enabled = pickBool(raw.enabled, DEFAULT_DESKTOP_LYRIC_SETTING.enabled);
  const locked = pickBool(raw.locked, DEFAULT_DESKTOP_LYRIC_SETTING.locked);
  const overlayTaskbar = pickBool(
    raw.overlayTaskbar,
    DEFAULT_DESKTOP_LYRIC_SETTING.overlayTaskbar,
  );
  const fontSize = clampNumber(raw.fontSize, DEFAULT_DESKTOP_LYRIC_SETTING.fontSize, 10, 64, true);
  const fontFamily =
    typeof raw.fontFamily === "string" && raw.fontFamily.trim().length > 0
      ? raw.fontFamily.trim()
      : DEFAULT_DESKTOP_LYRIC_SETTING.fontFamily;
  const fontWeight = clampNumber(
    raw.fontWeight,
    DEFAULT_DESKTOP_LYRIC_SETTING.fontWeight,
    100,
    900,
    true,
  );
  const autoOutline = pickBool(raw.autoOutline, DEFAULT_DESKTOP_LYRIC_SETTING.autoOutline);
  const style: DesktopLyricStyleId = isDesktopLyricStyleId(raw.style) ? raw.style : "default";
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
    autoOutline,
    style,
    styles,
    textColor: styles.default.textColor,
    highlightColor: styles.default.highlightColor,
    animationEnabled: styles.default.animationEnabled,
    wordScaleEnabled: styles.default.wordScaleEnabled,
  };
}

export function mergeDesktopLyricSetting(
  baseInput: unknown,
  patch: DesktopLyricSettingPatch,
): DesktopLyricSettingV2 {
  const base = normalizeDesktopLyricSetting(baseInput);
  const rawPatch = asRecord(patch);
  const patchStyles = asRecord(patch.styles);

  // 支持旧版顶层默认样式字段 patch 自动映射进 styles.default
  const compatDefaultPatch: Record<string, unknown> = {};
  for (const key of [
    "textColor",
    "highlightColor",
    "animationEnabled",
    "wordScaleEnabled",
  ] as const) {
    if (key in rawPatch && rawPatch[key] !== undefined) {
      compatDefaultPatch[key] = rawPatch[key];
    }
  }

  const mergedStyles: Record<string, unknown> = {};
  for (const id of DESKTOP_LYRIC_STYLE_IDS) {
    mergedStyles[id] = {
      ...base.styles[id],
      ...(id === "default" ? compatDefaultPatch : {}),
      ...asRecord(patchStyles[id]),
    };
  }

  const mergedBounds = patch.bounds
    ? { ...base.bounds, ...patch.bounds }
    : base.bounds;

  return normalizeDesktopLyricSetting({
    ...base,
    ...patch,
    bounds: mergedBounds,
    styles: mergedStyles,
  });
}
