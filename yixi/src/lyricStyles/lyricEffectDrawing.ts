import type { EffectFont, EffectGlyph, LyricStyleEffectFrame } from "./lyricStyleEffects";

export function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function smoothProgress(value: number): number {
  const t = clampProgress(value);
  return t * t * (3 - 2 * t);
}

/** 使用音频绝对时间计算包络，暂停、跳转后无需继承上一帧状态。 */
export function highlightWeight(timeMs: number, startMs: number, endMs: number, attackMs = 90, releaseMs = 140): number {
  const attack = Math.max(1, Math.min(attackMs, (endMs - startMs) / 2));
  return smoothProgress((timeMs - startMs) / attack) * (1 - smoothProgress((timeMs - endMs) / Math.max(1, releaseMs)));
}

export function glyphProgress(glyph: EffectGlyph, positionMs: number): number {
  return clampProgress((positionMs - glyph.startTimeMs) / Math.max(1, glyph.endTimeMs - glyph.startTimeMs));
}

function luminance(color: string): number {
  const hex = color.trim().match(/^#([0-9a-f]{6}|[0-9a-f]{3})(?:[0-9a-f]{2})?$/i)?.[1];
  const channels = hex
    ? (hex.length === 3 ? Array.from(hex, (digit) => digit + digit) : hex.match(/../g)!).map((part) => parseInt(part, 16))
    : color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)?.slice(1).map(Number);
  if (!channels) return 1;
  return (0.299 * channels[0] + 0.587 * channels[1] + 0.114 * channels[2]) / 255;
}

export function strokeEffectOutline(
  ctx: CanvasRenderingContext2D,
  font: EffectFont,
  color: string,
  text: string,
  x: number,
  y: number,
): void {
  if (!font.autoOutline) return;
  ctx.strokeStyle = luminance(color) > 0.5 ? "rgba(0, 0, 0, 0.62)" : "rgba(255, 255, 255, 0.52)";
  ctx.lineWidth = Math.max(1.5, Math.min(3, font.fontSize * 0.05));
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeText(text, x, y);
}

export function applyEffectShadow(ctx: CanvasRenderingContext2D, font: EffectFont, color?: string, blur = 4): void {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  if (!color && (!font.shadowEnabled || font.autoOutline)) return;
  ctx.shadowColor = color ?? "rgba(0, 0, 0, 0.36)";
  ctx.shadowBlur = color ? blur : 4;
  ctx.shadowOffsetY = color ? 0 : 2;
}

/** 通过绘制层交叉淡化，保留任意 CSS 颜色及其 Alpha，不限制为十六进制色。 */
export function drawHighlightLayers(
  frame: LyricStyleEffectFrame,
  text: string,
  x: number,
  y: number,
  baseColor: string,
  sungColor: string,
  activeColor: string,
  sung: number,
  active: number,
  glowColor: string,
  glowBlur: number,
): void {
  const { ctx, font } = frame;
  const layers = [
    { color: baseColor, weight: (1 - sung) * (1 - active), glow: false },
    { color: sungColor, weight: sung * (1 - active), glow: false },
    { color: activeColor, weight: active, glow: true },
  ];
  for (const layer of layers) {
    if (layer.weight <= 0) continue;
    ctx.save();
    ctx.globalAlpha *= layer.weight;
    strokeEffectOutline(ctx, font, layer.color, text, x, y);
    applyEffectShadow(ctx, font, layer.glow ? glowColor : undefined, glowBlur);
    ctx.fillStyle = layer.color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}

export function colorWithAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const trimmed = color.trim();
  const hex = trimmed.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  if (hex) {
    let r: number;
    let g: number;
    let b: number;
    let baseA = 1;
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
      if (hex.length === 4) baseA = parseInt(hex[3] + hex[3], 16) / 255;
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
      if (hex.length === 8) baseA = parseInt(hex.slice(6, 8), 16) / 255;
    }
    return `rgba(${r}, ${g}, ${b}, ${(baseA * a).toFixed(3)})`;
  }
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i,
  );
  if (rgbMatch) {
    const baseA = rgbMatch[4]
      ? rgbMatch[4].endsWith("%")
        ? parseFloat(rgbMatch[4]) / 100
        : parseFloat(rgbMatch[4])
      : 1;
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${(baseA * a).toFixed(3)})`;
  }
  const hslMatch = trimmed.match(
    /^hsla?\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^,)]+)(?:\s*,\s*([\d.]+%?))?\s*\)$/i,
  );
  if (hslMatch) {
    const baseA = hslMatch[4]
      ? hslMatch[4].endsWith("%")
        ? parseFloat(hslMatch[4]) / 100
        : parseFloat(hslMatch[4])
      : 1;
    return `hsla(${hslMatch[1]}, ${hslMatch[2]}, ${hslMatch[3]}, ${(baseA * a).toFixed(3)})`;
  }
  return `rgba(56, 189, 248, ${a.toFixed(3)})`;
}
