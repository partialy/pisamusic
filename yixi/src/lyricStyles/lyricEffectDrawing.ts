import type { EffectFont, EffectGlyph } from "./lyricStyleEffects";

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
