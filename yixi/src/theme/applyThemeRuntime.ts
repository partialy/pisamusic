import type { ThemeRuntimeProfile } from "./types";

export interface ApplyThemeRuntimeOptions {
  profile: ThemeRuntimeProfile;
  accentColor: string;
  gradientDirection: string;
  gradientColors: string[];
  backgroundCss?: string;
  backgroundImage?: string;
  backgroundBlur?: number;
  backgroundBrightness?: number;
}

export function applyThemeRuntime(options: ApplyThemeRuntimeOptions): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const {
    profile,
    accentColor,
    gradientDirection,
    gradientColors,
    backgroundCss,
    backgroundImage,
    backgroundBlur = 0,
    backgroundBrightness = 100,
  } = options;

  // 1. 设置根标签数据属性
  root.dataset.bgMode = profile.backgroundMode;
  root.dataset.theme = profile.colorScheme;
  root.dataset.activeStyle = profile.activeStyle;
  root.dataset.imageTone = profile.imageTone;

  // 2. 品牌主色及按键交互变量
  root.style.setProperty("--color-primary", accentColor);
  root.style.setProperty("--color-text-primary", accentColor);
  root.style.setProperty(
    "--color-primary-hover",
    mixColor(accentColor, "#ffffff", 0.18)
  );
  root.style.setProperty(
    "--color-primary-pressed",
    mixColor(accentColor, "#000000", 0.16)
  );
  root.style.setProperty(
    "--color-text-primary-hover",
    mixColor(accentColor, "#000000", 0.16)
  );

  // 3. 颜色模式轨道背景渐变色
  root.style.setProperty(
    "--color-bg-track",
    backgroundCss || `linear-gradient(${gradientDirection}, ${gradientColors.join(", ")})`
  );

  // 4. 图片壁纸背景变量
  if (profile.backgroundMode === "image" && backgroundImage) {
    root.style.setProperty("--app-bg-image", `url("${backgroundImage}")`);
  } else {
    root.style.setProperty("--app-bg-image", "none");
  }

  const blurVal = Math.max(0, Math.min(100, backgroundBlur));
  const brightnessVal = Math.max(0, Math.min(100, backgroundBrightness));
  root.style.setProperty("--app-bg-blur", `${blurVal}`);
  root.style.setProperty("--app-bg-blur-px", `${(blurVal * 0.4).toFixed(1)}px`);
  root.style.setProperty("--app-bg-brightness", `${brightnessVal}`);
  root.style.setProperty(
    "--app-bg-brightness-factor",
    `${(brightnessVal / 100).toFixed(2)}`
  );
}

function mixColor(color1: string, color2: string, weight: number): string {
  const w = Math.max(0, Math.min(1, weight));
  const c1 = parseHex(color1);
  const c2 = parseHex(color2);
  const r = Math.round(c1.r * (1 - w) + c2.r * w);
  const g = Math.round(c1.g * (1 - w) + c2.g * w);
  const b = Math.round(c1.b * (1 - w) + c2.b * w);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}
