import type { DesktopLyricOceanStyleConfig } from "../types/desktopLyric";
import type { EffectGlyph, LyricStyleEffectFrame } from "./lyricStyleEffects";
import {
  clampProgress,
  colorWithAlpha,
  drawHighlightLayers,
  glyphProgress,
} from "./lyricEffectDrawing";

interface VisualRow {
  rowOffset: number;
  glyphs: EffectGlyph[];
  y: number;
  left: number;
  right: number;
}

/** 半径为 2 的平滑余弦波包络：波峰 d=0 为 1.0，紧邻两侧 d=±1 精确为 0.5。 */
export function getOceanWaveHeight(distance: number): number {
  const absD = Math.abs(distance);
  if (absD >= 2) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * absD) / 2));
}

export function getOceanEffectPadding(
  style: DesktopLyricOceanStyleConfig,
  fontSize: number,
): number {
  return Math.ceil(32 + style.jumpHeight + fontSize * 0.14);
}

function computeWaveState(
  glyphs: EffectGlyph[],
  positionMs: number,
  elapsedMs: number,
  wordMode: boolean,
): { waveIndex: number; lineModeLitLimit: number } {
  const n = glyphs.length;
  if (n === 0) return { waveIndex: -3, lineModeLitLimit: -3 };

  if (!wordMode) {
    const sweepMs = Math.max(1100, n * 125);
    const cycleMs = sweepMs + 520;
    const phase = elapsedMs % cycleMs;
    const waveIndex =
      phase <= sweepMs ? -2 + (n + 3.5) * (phase / sweepMs) : n + 2;
    const lineModeLitLimit =
      elapsedMs >= sweepMs ? n + 2 : -2 + (n + 3.5) * (elapsedMs / sweepMs);
    return { waveIndex, lineModeLitLimit };
  }

  const firstStart = glyphs[0].startTimeMs;
  const lastEnd = glyphs[n - 1].endTimeMs;
  const lineStartMs = positionMs - elapsedMs;
  let waveIndex = -3;

  if (positionMs < firstStart) {
    const leadIn = Math.min(260, Math.max(80, firstStart - lineStartMs));
    if (positionMs >= firstStart - leadIn) {
      const u = (positionMs - (firstStart - leadIn)) / leadIn;
      waveIndex = -2 + 1.5 * u;
    }
  } else if (positionMs >= lastEnd) {
    const u = clampProgress((positionMs - lastEnd) / 280);
    waveIndex = n - 0.5 + 2.0 * u;
  } else {
    for (let i = 0; i < n; i++) {
      const glyph = glyphs[i];
      if (positionMs < glyph.startTimeMs) {
        waveIndex = i - 0.5;
        break;
      }
      if (positionMs < glyph.endTimeMs) {
        waveIndex = i + (glyphProgress(glyph, positionMs) - 0.5);
        break;
      }
    }
  }

  return { waveIndex, lineModeLitLimit: n + 2 };
}

function groupVisualRows(glyphs: EffectGlyph[]): VisualRow[] {
  const rows: VisualRow[] = [];
  let current: VisualRow | null = null;

  glyphs.forEach((glyph, index) => {
    if (!current || Math.abs(glyph.y - current.y) > 0.5) {
      current = {
        rowOffset: index,
        glyphs: [glyph],
        y: glyph.y,
        left: glyph.x,
        right: glyph.x + glyph.width,
      };
      rows.push(current);
      return;
    }
    current.glyphs.push(glyph);
    current.left = Math.min(current.left, glyph.x);
    current.right = Math.max(current.right, glyph.x + glyph.width);
  });

  return rows;
}

function getRowCrestX(rowGlyphs: EffectGlyph[], localWaveIndex: number): number {
  const n = rowGlyphs.length;
  if (n === 0) return 0;
  if (localWaveIndex <= 0) {
    const first = rowGlyphs[0];
    return first.x + first.width / 2 + localWaveIndex * Math.max(18, first.width);
  }
  if (localWaveIndex >= n - 1) {
    const last = rowGlyphs[n - 1];
    return last.x + last.width / 2 + (localWaveIndex - (n - 1)) * Math.max(18, last.width);
  }
  const lo = Math.floor(localWaveIndex);
  const frac = localWaveIndex - lo;
  const g0 = rowGlyphs[lo];
  const g1 = rowGlyphs[lo + 1];
  const c0 = g0.x + g0.width / 2;
  const c1 = g1.x + g1.width / 2;
  return c0 * (1 - frac) + c1 * frac;
}

function drawRowWaveRibbon(
  style: DesktopLyricOceanStyleConfig,
  frame: LyricStyleEffectFrame,
  row: VisualRow,
  waveIndex: number,
): void {
  const { ctx, font, elapsedMs } = frame;
  const localWaveIndex = waveIndex - row.rowOffset;
  const rowCount = row.glyphs.length;
  const rowWaveActive = localWaveIndex > -2 && localWaveIndex < rowCount + 1.5;
  const crestX = getRowCrestX(row.glyphs, localWaveIndex);
  const avgCharW = Math.max(16, (row.right - row.left) / Math.max(1, rowCount));
  const ribbonLeft = row.left - 14;
  const ribbonRight = row.right + 14;
  const ribbonBaseY = row.y + Math.max(8, font.fontSize * 0.24);
  const ribbonLift = Math.min(8, style.jumpHeight * 0.58);

  ctx.save();
  const grad = ctx.createLinearGradient(ribbonLeft, 0, ribbonRight, 0);
  grad.addColorStop(0, colorWithAlpha(style.glowColor, 0));
  if (rowWaveActive) {
    const ratio = Math.max(
      0.08,
      Math.min(0.92, (crestX - ribbonLeft) / Math.max(1, ribbonRight - ribbonLeft)),
    );
    grad.addColorStop(Math.max(0, ratio - 0.22), colorWithAlpha(style.glowColor, 0.26));
    grad.addColorStop(ratio, colorWithAlpha(style.crestColor, 0.92));
    grad.addColorStop(Math.min(1, ratio + 0.22), colorWithAlpha(style.glowColor, 0.26));
  } else {
    grad.addColorStop(0.5, colorWithAlpha(style.glowColor, 0.24));
  }
  grad.addColorStop(1, colorWithAlpha(style.glowColor, 0));

  ctx.beginPath();
  for (let x = ribbonLeft; x <= ribbonRight; x += 4) {
    const d = (x - crestX) / avgCharW;
    const h = getOceanWaveHeight(d);
    const ripple = Math.sin(x * 0.055 - elapsedMs * 0.005) * 1.1;
    const y = ribbonBaseY - h * ribbonLift + ripple;
    if (x === ribbonLeft) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = grad;
  ctx.lineWidth = Math.max(1.6, Math.min(2.8, font.fontSize * 0.055));
  ctx.lineCap = "round";
  if (rowWaveActive) {
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = 10;
  }
  ctx.stroke();

  if (rowWaveActive) {
    const midHeight = font.fontSize * 0.35;
    for (let s = 0; s < 5; s++) {
      const life = (elapsedMs * 0.0018 + s * 0.21) % 1;
      const spread = (s - 2) * 11 + Math.sin(elapsedMs * 0.006 + s * 2.1) * 4;
      const fx = crestX + spread;
      const fy =
        row.y - midHeight - style.jumpHeight * 0.85 - life * 14 + Math.abs(s - 2) * 2.5;
      const alpha = Math.sin(life * Math.PI) * 0.72;
      if (alpha > 0.03) {
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.fillStyle = style.crestColor;
        const radius = Math.max(1, 1.6 * (1 - life * 0.35));
        ctx.beginPath();
        ctx.arc(fx, fy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

export function drawOceanEffect(
  style: DesktopLyricOceanStyleConfig,
  frame: LyricStyleEffectFrame,
): void {
  const { ctx, layout, font, positionMs, elapsedMs, wordMode } = frame;
  const glyphs = layout.glyphs;
  if (!glyphs.length) return;

  const { waveIndex, lineModeLitLimit } = computeWaveState(
    glyphs,
    positionMs,
    elapsedMs,
    wordMode,
  );

  if (style.showWaveLine) {
    const rows = groupVisualRows(glyphs);
    for (const row of rows) {
      drawRowWaveRibbon(style, frame, row, waveIndex);
    }
  }

  const midHeight = font.fontSize * 0.35;
  glyphs.forEach((glyph, index) => {
    const d = index - waveIndex;
    const h = getOceanWaveHeight(d);
    const offsetY = -style.jumpHeight * h;
    const scale = 1 + 0.11 * h;
    const inWave = Math.abs(d) < 2;
    const tilt = style.swayEnabled && inWave ? Math.sin((Math.PI * d) / 2) * 0.085 : 0;
    const surgeX = style.swayEnabled && inWave ? Math.sin((Math.PI * d) / 2) * 1.5 : 0;

    const sungBlend = wordMode
      ? Math.min(1, glyphProgress(glyph, positionMs) * 1.35)
      : clampProgress(lineModeLitLimit - index + 0.65);
    const activeWeight = h * 0.85;

    ctx.save();
    ctx.translate(glyph.x + glyph.width / 2 + surgeX, glyph.y - midHeight + offsetY);
    if (tilt !== 0) ctx.rotate(tilt);
    if (scale !== 1) ctx.scale(scale, scale);

    drawHighlightLayers(
      frame,
      glyph.text,
      -glyph.width / 2,
      midHeight,
      style.unlitColor,
      style.sungColor,
      style.crestColor,
      sungBlend,
      activeWeight,
      style.glowColor,
      8 + 12 * h,
    );
    ctx.restore();
  });
}
