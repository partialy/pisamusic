export type StartupAnimationStyle =
  | "default"
  | "aurora-sweep"
  | "vinyl-wave"
  | "fluid-aurora"
  | "star-orbit"
  | "ripple-field"
  | "aurora-horizon";

export interface StartupAnimationOptionMeta {
  value: StartupAnimationStyle;
  label: string;
  description: string;
  cardless: boolean;
}

export const STARTUP_ANIMATION_OPTIONS: ReadonlyArray<StartupAnimationOptionMeta> = [
  {
    value: "default",
    label: "默认",
    description: "经典亮白圆角卡片与渐亮文字动画。",
    cardless: false,
  },
  {
    value: "aurora-sweep",
    label: "极光扫光",
    description: "Logo 极光旋转细环配合从左向右的标题扫光与光晕。",
    cardless: false,
  },
  {
    value: "vinyl-wave",
    label: "黑胶声波",
    description: "暗夜玻璃卡片、黑胶旋转声波涟漪与动态均衡器。",
    cardless: false,
  },
  {
    value: "fluid-aurora",
    label: "流体极光",
    description: "流体极光慢漂背景、静止图标与逐字波浪高亮。",
    cardless: false,
  },
  {
    value: "star-orbit",
    label: "星轨极光",
    description: "无背景卡片直接悬浮，双层 3D 倾斜星轨环绕扫光。",
    cardless: true,
  },
  {
    value: "ripple-field",
    label: "声场波动",
    description: "无背景卡片直接悬浮，居中图标向外扩散多层声场涟漪。",
    cardless: true,
  },
  {
    value: "aurora-horizon",
    label: "跃动极光",
    description: "无背景卡片直接悬浮，两端渐隐纯色彩流光地平线。",
    cardless: true,
  },
] as const;

export const DEFAULT_STARTUP_ANIMATION_STYLE: StartupAnimationStyle = "default";

const VALID_STYLE_SET = new Set<string>(STARTUP_ANIMATION_OPTIONS.map((item) => item.value));

export function isStartupAnimationStyle(value: unknown): value is StartupAnimationStyle {
  return typeof value === "string" && VALID_STYLE_SET.has(value);
}

export function normalizeStartupAnimationStyle(value: unknown): StartupAnimationStyle {
  return isStartupAnimationStyle(value) ? value : DEFAULT_STARTUP_ANIMATION_STYLE;
}

export function isCardlessStartupStyle(style: StartupAnimationStyle): boolean {
  return Boolean(STARTUP_ANIMATION_OPTIONS.find((item) => item.value === style)?.cardless);
}

export function getStartupAnimationMeta(style: StartupAnimationStyle): StartupAnimationOptionMeta {
  return (
    STARTUP_ANIMATION_OPTIONS.find((item) => item.value === style) ??
    STARTUP_ANIMATION_OPTIONS[0]
  );
}
