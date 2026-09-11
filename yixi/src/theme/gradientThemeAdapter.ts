import type { GradientDirection, ResolvedColorScheme } from "./types";

export interface ResolveColorBackgroundInput {
  autoBackground: boolean;
  accentColor: string;
  customColors: string[];
  direction: GradientDirection;
  colorScheme: ResolvedColorScheme;
}

export interface ResolvedColorBackground {
  colors: string[];
  backgroundCss: string;
}

export const DEFAULT_LIGHT_GRADIENT_COLORS = ["#edf4ff", "#f7fbff", "#f5f5f5"];
export const DEFAULT_DARK_GRADIENT_COLORS = ["#121826", "#151b2b", "#10131d"];
export const DEFAULT_ACCENT_COLOR = "#2897ff";
export const DEFAULT_GRADIENT_DIRECTION: GradientDirection = "to bottom";
export const MAX_GRADIENT_COLOR_COUNT = 5;

const DARK_BACKGROUND_MAX_LUMINANCE = 0.12;
const DARK_LIGHTNESS_MIN = 10;
const DARK_LIGHTNESS_MAX = 20;
const DARK_SATURATION_MAX = 58;
const DARK_NEUTRAL_ANCHOR = "#0b1220";

export function normalizeHexColor(value: unknown, fallback = DEFAULT_ACCENT_COLOR): string {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
}

export function isGradientDirection(value: unknown): value is GradientDirection {
  return value === "to bottom" || value === "to right" || value === "135deg" || value === "45deg";
}

export function normalizeGradientColors(
  value: unknown,
  fallback = DEFAULT_LIGHT_GRADIENT_COLORS
): string[] {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;
  const colors = source
    .slice(0, MAX_GRADIENT_COLOR_COUNT)
    .map((color) => normalizeHexColor(color, ""))
    .filter(Boolean);
  const normalized = colors.length >= 2 ? colors : fallback;
  return normalized.map((color) => normalizeHexColor(color, DEFAULT_ACCENT_COLOR));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex, DEFAULT_ACCENT_COLOR).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function rgbToHex(color: { r: number; g: number; b: number }): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const hex = [clamp(color.r), clamp(color.g), clamp(color.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

export function mixColor(baseColor: string, mixWith: string, weight: number): string {
  const base = hexToRgb(baseColor);
  const mix = hexToRgb(mixWith);
  const ratio = Math.min(Math.max(weight, 0), 1);
  return rgbToHex({
    r: Math.round(base.r * (1 - ratio) + mix.r * ratio),
    g: Math.round(base.g * (1 - ratio) + mix.g * ratio),
    b: Math.round(base.b * (1 - ratio) + mix.b * ratio),
  });
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = (h % 360) / 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function getRelativeLuminance(r: number, g: number, b: number): number {
  const transform = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

export function generateGradientColors(
  accent: string,
  colorScheme: ResolvedColorScheme
): string[] {
  const normalized = normalizeHexColor(accent, DEFAULT_ACCENT_COLOR);
  if (colorScheme === "dark") {
    return [
      mixColor(normalized, "#101826", 0.72),
      mixColor(normalized, "#151b2b", 0.82),
      mixColor(normalized, "#10131d", 0.9),
    ];
  }
  return [
    mixColor(normalized, "#ffffff", 0.82),
    mixColor(normalized, "#ffffff", 0.92),
    mixColor(normalized, "#f5f5f5", 0.96),
  ];
}

export function deriveDarkGradientColors(customColors: string[]): string[] {
  const normalized = normalizeGradientColors(customColors, DEFAULT_DARK_GRADIENT_COLORS);

  return normalized.map((hex) => {
    const rgb = hexToRgb(hex);
    const lum = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // 如果本身已经是合格的深色背景（亮度足够低且明度适中），尽量保留
    if (lum <= 0.08 && hsl.l <= 22) {
      return hex;
    }

    // 压制明度至安全深色区间 10% ~ 20%
    let targetL = Math.max(DARK_LIGHTNESS_MIN, Math.min(DARK_LIGHTNESS_MAX, Math.round(hsl.l * 0.22)));
    // 约束饱和度，防止深色大面积背景过艳
    let targetS = Math.min(hsl.s, DARK_SATURATION_MAX);

    let adjustedRgb = hslToRgb(hsl.h, targetS, targetL);
    let adjustedLum = getRelativeLuminance(adjustedRgb.r, adjustedRgb.g, adjustedRgb.b);

    let resultHex = rgbToHex(adjustedRgb);

    // 如果因黄色/绿色敏感通道依然偏亮，向深色锚点收敛
    let guard = 0;
    while (adjustedLum > DARK_BACKGROUND_MAX_LUMINANCE && guard < 5) {
      resultHex = mixColor(resultHex, DARK_NEUTRAL_ANCHOR, 0.4);
      const tempRgb = hexToRgb(resultHex);
      adjustedLum = getRelativeLuminance(tempRgb.r, tempRgb.g, tempRgb.b);
      guard++;
    }

    return resultHex;
  });
}

export function resolveColorBackground(
  input: ResolveColorBackgroundInput
): ResolvedColorBackground {
  const { autoBackground, accentColor, customColors, direction, colorScheme } = input;
  const safeDirection = isGradientDirection(direction) ? direction : DEFAULT_GRADIENT_DIRECTION;

  let colors: string[];
  if (autoBackground) {
    colors = generateGradientColors(accentColor, colorScheme);
  } else if (colorScheme === "dark") {
    colors = deriveDarkGradientColors(customColors);
  } else {
    colors = normalizeGradientColors(customColors, DEFAULT_LIGHT_GRADIENT_COLORS);
  }

  const backgroundCss = `linear-gradient(${safeDirection}, ${colors.join(", ")})`;

  return {
    colors,
    backgroundCss,
  };
}
