import type { DesktopLyricStyleConfigMap } from "../types/desktopLyric";
import { applyEffectShadow, clampProgress, glyphProgress, highlightWeight, smoothProgress, strokeEffectOutline } from "./lyricEffectDrawing";

export type EffectStyleId = "typewriter" | "ink" | "bounce" | "spotlight" | "neon";
export type EffectStyleConfigMap = Pick<DesktopLyricStyleConfigMap, EffectStyleId>;

export interface EffectGlyph {
  text: string;
  x: number;
  /** 当前视觉行的文字基线。 */
  y: number;
  width: number;
  /** 整句未换行前的累计横坐标，保证换行不重启扫光。 */
  logicalX: number;
  startTimeMs: number;
  endTimeMs: number;
}

export interface EffectLineLayout {
  glyphs: EffectGlyph[];
  /** 必须在视觉行边界拆开，不能让一个 run 跨越换行。 */
  runs: EffectGlyph[];
  totalWidth: number;
  width: number;
  height: number;
}

export interface EffectFont {
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  shadowEnabled: boolean;
  autoOutline: boolean;
}

export interface LyricStyleEffectFrame {
  ctx: CanvasRenderingContext2D;
  layout: EffectLineLayout;
  font: EffectFont;
  positionMs: number;
  elapsedMs: number;
  durationMs: number;
  wordMode: boolean;
  viewportWidth: number;
  variant: "desktop" | "player";
}

/** Canvas 调用方负责布局、留白、时钟与动画调度，本模块只绘制当前帧。 */
export function drawLyricStyleEffect<K extends EffectStyleId>(
  id: K,
  config: EffectStyleConfigMap[K],
  frame: LyricStyleEffectFrame,
): void {
  if (!frame.layout.glyphs.length) return;
  const { ctx, font } = frame;
  ctx.save();
  ctx.font = `${font.fontWeight} ${font.fontSize}px "${font.fontFamily}", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  try {
    switch (id) {
      case "typewriter": drawTypewriter(config as EffectStyleConfigMap["typewriter"], frame); break;
      case "ink": drawInk(config as EffectStyleConfigMap["ink"], frame); break;
      case "bounce": drawBounce(config as EffectStyleConfigMap["bounce"], frame); break;
      case "spotlight": drawSpotlight(config as EffectStyleConfigMap["spotlight"], frame); break;
      case "neon": drawNeon(config as EffectStyleConfigMap["neon"], frame); break;
    }
  } finally {
    ctx.restore();
  }
}

/** 放大、跳跃、描边与光晕均可能越过文字排版边界。 */
export function getLyricStyleEffectPadding<K extends EffectStyleId>(
  id: K,
  config: EffectStyleConfigMap[K],
  fontSize: number,
): number {
  if (id === "bounce") {
    const style = config as EffectStyleConfigMap["bounce"];
    return Math.ceil(32 + style.jumpHeight + fontSize * Math.max(0, style.jumpScale - 1));
  }
  if (id === "spotlight") {
    const style = config as EffectStyleConfigMap["spotlight"];
    return Math.ceil(36 + style.blurIntensity * 3 + fontSize * Math.max(0, style.activeScale - 1));
  }
  if (id === "ink") return Math.ceil(24 + (config as EffectStyleConfigMap["ink"]).liftOffset);
  return 32;
}

function drawGlyph(frame: LyricStyleEffectFrame, glyph: EffectGlyph, color: string): void {
  const { ctx, font } = frame;
  strokeEffectOutline(ctx, font, color, glyph.text, glyph.x, glyph.y);
  applyEffectShadow(ctx, font);
  ctx.fillStyle = color;
  ctx.fillText(glyph.text, glyph.x, glyph.y);
}

/** 通过绘制层交叉淡化，保留任意 CSS 颜色及其 Alpha，不限制为十六进制色。 */
function drawHighlightLayers(frame: LyricStyleEffectFrame, text: string, x: number, y: number,
  baseColor: string, sungColor: string, activeColor: string, sung: number, active: number, glowColor: string, glowBlur: number): void {
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

function drawTypewriter(style: EffectStyleConfigMap["typewriter"], frame: LyricStyleEffectFrame): void {
  const { ctx, layout, font, positionMs, elapsedMs, wordMode, viewportWidth, variant } = frame;
  const chars = layout.glyphs;
  const revealMs = Math.max(100, style.lineRevealDurationMs);
  const elapsed = chars.map((glyph, index) => wordMode
    ? positionMs - glyph.startTimeMs
    : elapsedMs - index * revealMs / chars.length);
  let latestIndex = -1;
  elapsed.forEach((value, index) => { if (value >= 0) latestIndex = index; });
  const timeline = wordMode ? positionMs : elapsedMs;
  const finishAt = wordMode ? chars[chars.length - 1].endTimeMs + 140 : revealMs + 320;
  const cursorFade = 1 - smoothProgress((timeline - finishAt) / 140);
  const shownWidth = chars.slice(0, latestIndex + 1).reduce((sum, glyph) => sum + glyph.width, 0);
  const rightPadding = style.showCursor ? 24 : 12;
  const desktopOffset = shownWidth + rightPadding <= viewportWidth
    ? (viewportWidth - shownWidth) / 2
    : viewportWidth - shownWidth - rightPadding;
  const midHeight = font.fontSize * 0.35;
  for (let index = 0; index <= latestIndex; index++) {
    const glyph = chars[index];
    const pop = 1 - Math.pow(1 - clampProgress(elapsed[index] / 140), 3);
    const startAt = wordMode ? glyph.startTimeMs : index * revealMs / chars.length;
    const nextAt = index + 1 < chars.length
      ? wordMode ? chars[index + 1].startTimeMs : (index + 1) * revealMs / chars.length
      : finishAt;
    const active = highlightWeight(timeline, startAt, Math.max(startAt + 1, nextAt), 60, 140);
    ctx.save();
    ctx.translate(glyph.x + glyph.width / 2 + (variant === "desktop" ? desktopOffset : 0), glyph.y - midHeight + (1 - pop) * 5);
    ctx.scale(0.88 + 0.12 * pop, 0.88 + 0.12 * pop);
    ctx.globalAlpha *= pop;
    drawHighlightLayers(frame, glyph.text, -glyph.width / 2, midHeight,
      style.textColor, style.textColor, style.latestGlowColor, 1, active, style.latestGlowColor, 14);
    ctx.restore();
  }
  if (style.showCursor && cursorFade > 0) {
    const latest = chars[latestIndex];
    // 下一视觉行尚未开始时，光标仍跟随最后已经显现的字。
    const cursorX = latest ? latest.x + latest.width : chars[0].x;
    const cursorH = Math.max(14, Math.round(font.fontSize * 0.85));
    ctx.save();
    ctx.globalAlpha *= cursorFade * (0.25 + 0.75 * (0.5 + 0.5 * Math.cos(elapsedMs / 750 * Math.PI * 2)));
    applyEffectShadow(ctx, font, style.latestGlowColor, 10);
    ctx.fillStyle = style.latestGlowColor;
    ctx.fillRect(cursorX + 5 + (variant === "desktop" ? desktopOffset : 0), Math.round((latest?.y ?? chars[0].y) - cursorH * 0.84), 2.5, cursorH);
    ctx.restore();
  }
}

function getScan(frame: LyricStyleEffectFrame, before: number, after: number): { x: number; active: EffectGlyph | undefined; progress: number } {
  let x = before;
  let started = false;
  for (const run of frame.layout.runs) {
    const progress = glyphProgress(run, frame.positionMs);
    if (progress <= 0) return { x, active: undefined, progress: 0 };
    started = true;
    x = run.logicalX + run.width * progress;
    if (progress < 1) return { x, active: run, progress };
  }
  return { x: started ? after : before, active: undefined, progress: 0 };
}

function drawInk(style: EffectStyleConfigMap["ink"], frame: LyricStyleEffectFrame): void {
  const { ctx, layout, font, elapsedMs, wordMode } = frame;
  const feather = style.featherWidth;
  const scan = wordMode
    ? getScan(frame, -feather, layout.totalWidth + feather)
    : { x: -feather + (layout.totalWidth + feather * 2) * clampProgress(elapsedMs / Math.max(150, style.lineSweepDurationMs)), active: undefined, progress: 0 };
  for (const run of layout.runs) {
    const x = run.x + scan.x - run.logicalX;
    const gradient = ctx.createLinearGradient(x - feather, 0, Math.max(x - feather + 1, x + feather), 0);
    gradient.addColorStop(0, style.highlightStartColor);
    gradient.addColorStop(0.52, style.highlightTipColor);
    gradient.addColorStop(1, style.unlitColor);
    const y = run.y + (run === scan.active && style.liftOffset > 0 ? -style.liftOffset * Math.sin(Math.PI * scan.progress) : 0);
    ctx.save();
    strokeEffectOutline(ctx, font, style.highlightStartColor, run.text, run.x, y);
    applyEffectShadow(ctx, font);
    ctx.fillStyle = gradient;
    ctx.fillText(run.text, run.x, y);
    ctx.restore();
  }
}

function drawBounce(style: EffectStyleConfigMap["bounce"], frame: LyricStyleEffectFrame): void {
  const { ctx, layout, font, elapsedMs, positionMs, wordMode } = frame;
  const midHeight = font.fontSize * 0.35;
  layout.glyphs.forEach((glyph, index) => {
    let offsetY = 0;
    let scale = 1;
    let sung = 1;
    let active = 0;
    if (wordMode) {
      const progress = glyphProgress(glyph, positionMs);
      sung = smoothProgress(progress);
      if (progress > 0 && progress < 1) {
        const arc = Math.sin(Math.PI * progress);
        offsetY = -style.jumpHeight * arc;
        scale = 1 + (style.jumpScale - 1) * arc;
        active = arc * arc;
      }
    } else {
      const local = elapsedMs - index * 32;
      if (local > 0 && local < 420) {
        const arc = Math.sin(Math.PI * local / 420);
        offsetY = -style.jumpHeight * 0.85 * arc;
        scale = 1 + (style.jumpScale - 1) * 0.65 * arc;
        active = arc * arc;
      }
    }
    ctx.save();
    ctx.translate(glyph.x + glyph.width / 2, glyph.y - midHeight + offsetY);
    ctx.scale(scale, scale);
    drawHighlightLayers(frame, glyph.text, -glyph.width / 2, midHeight,
      style.unlitColor, style.sungColor, style.activeColor, sung, active, style.activeColor, 16);
    ctx.restore();
  });
}

function drawSpotlight(style: EffectStyleConfigMap["spotlight"], frame: LyricStyleEffectFrame): void {
  const { ctx, layout, font, elapsedMs, positionMs, wordMode } = frame;
  const focusIn = smoothProgress(elapsedMs / 340);
  // 句尾可能早于下一句；当前句保持清晰，由宿主切句时替换，不能按唱词结束时间退焦。
  const clarity = focusIn;
  const blurAlpha = style.blurIntensity > 0.05 ? (1 - clarity) * 0.9 : 0;
  if (blurAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha *= blurAlpha;
    ctx.filter = `blur(${style.blurIntensity}px)`;
    ctx.fillStyle = style.unlitColor;
    for (const run of layout.runs) ctx.fillText(run.text, run.x, run.y);
    ctx.restore();
  }
  if (clarity <= 0.02) return;
  const midHeight = font.fontSize * 0.35;
  const spread = layout.width > frame.viewportWidth * 0.85 ? 0 : (1 - focusIn) * 5;
  const rows = new Map<number, EffectGlyph[]>();
  for (const glyph of layout.glyphs) {
    const row = rows.get(glyph.y);
    if (row) row.push(glyph); else rows.set(glyph.y, [glyph]);
  }
  for (const chars of rows.values()) {
    const middleIndex = (chars.length - 1) / 2;
    const rowSpread = frame.variant === "player" ? Math.min(spread, 48 / Math.max(1, chars.length - 1)) : spread;
    chars.forEach((glyph, index) => {
      const progress = wordMode ? glyphProgress(glyph, positionMs) : 0;
      const active = wordMode
        ? highlightWeight(positionMs, glyph.startTimeMs, Math.max(glyph.startTimeMs + 1, glyph.endTimeMs))
        : highlightWeight(elapsedMs, 120, 720, 120, 180);
      const sung = wordMode ? smoothProgress(progress) : smoothProgress((elapsedMs - 120) / 220);
      const scale = 1 + (style.activeScale - 1) * active;
      ctx.save();
      ctx.translate(glyph.x + glyph.width / 2 + (index - middleIndex) * rowSpread, glyph.y - midHeight);
      ctx.scale(scale, scale);
      ctx.globalAlpha *= clarity * (1 - sung * (1 - active) * 0.1);
      drawHighlightLayers(frame, glyph.text, -glyph.width / 2, midHeight,
        style.unlitColor, style.sungColor, style.activeColor, sung, active, style.glowColor, 22);
      ctx.restore();
    });
  }
}

function drawNeon(style: EffectStyleConfigMap["neon"], frame: LyricStyleEffectFrame): void {
  const { ctx, layout, font, elapsedMs, wordMode } = frame;
  const revealMs = Math.max(120, style.lineRevealDurationMs);
  const progress = clampProgress(elapsedMs / revealMs);
  const scanX = wordMode ? getScan(frame, 0, layout.totalWidth).x : layout.totalWidth * progress;
  const flowShift = wordMode ? elapsedMs * 0.06 * style.flowSpeed : progress >= 1 ? (elapsedMs - revealMs) * 0.12 * style.flowSpeed : 0;
  for (const run of layout.runs) {
    ctx.save();
    drawGlyph(frame, run, style.unlitColor);
    ctx.restore();
    const sungWidth = Math.min(run.width, scanX - run.logicalX);
    if (sungWidth <= 0.5) continue;
    const originX = run.x - run.logicalX;
    const cycleWidth = Math.max(180, layout.totalWidth);
    const startX = originX - flowShift % cycleWidth;
    const gradient = ctx.createLinearGradient(startX, 0, startX + cycleWidth * 2, 0);
    [style.colorStart, style.colorMid, style.colorEnd, style.colorStart, style.colorMid, style.colorEnd, style.colorStart]
      .forEach((color, index) => gradient.addColorStop([0, 0.166, 0.333, 0.5, 0.666, 0.833, 1][index], color));
    ctx.save();
    ctx.beginPath();
    // 按视觉行片段裁剪，下一行的 x 重新开始但其时序与色带继续使用 logicalX。
    ctx.rect(run.x - 12, run.y - font.fontSize * 2, sungWidth + 12, font.fontSize * 3);
    ctx.clip();
    strokeEffectOutline(ctx, font, style.colorMid, run.text, run.x, run.y);
    applyEffectShadow(ctx, font, style.colorMid, 14);
    ctx.fillStyle = gradient;
    ctx.fillText(run.text, run.x, run.y);
    if (scanX < layout.totalWidth - 2 && scanX >= run.logicalX && scanX <= run.logicalX + run.width) {
      const tipX = originX + scanX;
      const tip = ctx.createLinearGradient(tipX - 18, 0, tipX + 2, 0);
      tip.addColorStop(0, "rgba(255, 255, 255, 0)");
      tip.addColorStop(1, "rgba(255, 255, 255, 0.92)");
      ctx.fillStyle = tip;
      ctx.fillText(run.text, run.x, run.y);
    }
    ctx.restore();
  }
}
