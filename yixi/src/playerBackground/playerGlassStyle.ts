import { hexToRgb, mixColor, rgbToHex, rgbToHsl } from "@/theme/gradientThemeAdapter";
import type { CSSProperties } from "vue";

const DEFAULT_BASE_COLOR = "#2897ff";

/** 将 #hex 或 rgb()/rgba() 颜色统一转为 #rrggbb */
export function normalizeToHex(color: string, fallback = DEFAULT_BASE_COLOR): string {
  const trimmed = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return rgbToHex({
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    });
  }
  return /^#[0-9a-f]{6}$/i.test(fallback) ? fallback.toLowerCase() : DEFAULT_BASE_COLOR;
}

/**
 * 基于播放背景主色构建暗色模糊玻璃抽屉样式及高对比度高亮变量
 */
export function buildPlayerQueueDrawerStyle(
  rawColor: string,
  fallbackHex = DEFAULT_BASE_COLOR
): CSSProperties & Record<string, string> {
  const baseHex = normalizeToHex(rawColor, fallbackHex);
  const topRgb = hexToRgb(mixColor("#10131a", baseHex, 0.26));
  const bottomRgb = hexToRgb(mixColor("#0a0c12", baseHex, 0.14));

  const baseRgb = hexToRgb(baseHex);
  const { l } = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
  // 确保暗底上的高亮文字拥有足够对比度
  const accentHex =
    l < 0.68
      ? mixColor(baseHex, "#ffffff", Math.min(0.76, 0.68 - l + 0.26))
      : baseHex;
  const accentRgb = hexToRgb(accentHex);

  return {
    "--n-color": "transparent",
    "--queue-accent-color": accentHex,
    "--queue-accent-bg": `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.18)`,
    "--queue-accent-border": `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.34)`,
    background: `linear-gradient(165deg, rgba(${topRgb.r}, ${topRgb.g}, ${topRgb.b}, 0.78) 0%, rgba(${bottomRgb.r}, ${bottomRgb.g}, ${bottomRgb.b}, 0.86) 100%)`,
    backdropFilter: "blur(28px) saturate(150%)",
    WebkitBackdropFilter: "blur(28px) saturate(150%)",
    borderLeft: "1px solid rgba(255, 255, 255, 0.12)",
    boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.48)",
  };
}
