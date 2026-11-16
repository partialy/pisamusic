import type {
  DesktopLyricLine,
  DesktopLyricParticleDensity,
  DesktopLyricSettingV2,
} from "../../../src/types/desktopLyric";
import {
  applyDefaultShadow,
  buildFontString,
  DesktopLyricCanvasBase,
  easeInCubic,
  easeOutCubic,
  getRunProgress,
  strokeOutlineIfEnabled,
  type AlignedLineLayout,
} from "./shared";

interface LyricParticle {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  delay: number;
  size: number;
  tone: number;
  phase: number;
}

interface LineParticlePool {
  baselineY: number;
  particles: LyricParticle[];
}

const SAMPLE_PAD_X = 16;

function resolveStep(density: DesktopLyricParticleDensity): number {
  if (density === "fine") return 2;
  if (density === "light") return 4;
  return 3;
}

export class ParticleLyricRenderer extends DesktopLyricCanvasBase {
  private sampleCanvas: HTMLCanvasElement | null = null;
  private sampleCtx: CanvasRenderingContext2D | null = null;
  private particlePools = new Map<number, LineParticlePool>();
  private poolSignature = "";

  protected override getEmptyColor(): string {
    return this.setting.styles.particle.unlitColor;
  }

  protected override onLyricChanged(): void {
    this.particlePools.clear();
  }

  protected override onSettingChanged(
    prev: DesktopLyricSettingV2,
    next: DesktopLyricSettingV2,
  ): void {
    if (
      prev.fontSize !== next.fontSize ||
      prev.fontFamily !== next.fontFamily ||
      prev.fontWeight !== next.fontWeight ||
      prev.styles.particle.particleDensity !== next.styles.particle.particleDensity
    ) {
      this.particlePools.clear();
    }
  }

  protected override onResized(): void {
    this.particlePools.clear();
  }

  protected override onDisposed(): void {
    this.particlePools.clear();
    this.sampleCanvas = null;
    this.sampleCtx = null;
  }

  private getParticlesForLine(
    lineIndex: number,
    layout: AlignedLineLayout,
    baselineY: number,
  ): LyricParticle[] {
    const density = this.setting.styles.particle.particleDensity;
    const signature = `${this.cssHeight}:${this.setting.fontSize}:${this.setting.fontFamily}:${this.setting.fontWeight}:${density}`;
    if (this.poolSignature !== signature) {
      this.poolSignature = signature;
      this.particlePools.clear();
    }

    const cached = this.particlePools.get(lineIndex);
    if (cached && cached.baselineY === baselineY) return cached.particles;
    if (typeof document === "undefined" || !layout.text || layout.totalWidth <= 0) {
      return [];
    }

    if (!this.sampleCanvas) {
      this.sampleCanvas = document.createElement("canvas");
      this.sampleCtx = this.sampleCanvas.getContext("2d", { willReadFrequently: true });
    }
    if (!this.sampleCtx) return [];

    const sampleW = Math.max(64, Math.ceil(layout.totalWidth + SAMPLE_PAD_X * 2));
    const sampleH = Math.max(32, this.cssHeight);
    this.sampleCanvas.width = sampleW;
    this.sampleCanvas.height = sampleH;

    this.sampleCtx.clearRect(0, 0, sampleW, sampleH);
    this.sampleCtx.font = buildFontString(this.setting);
    this.sampleCtx.textBaseline = "alphabetic";
    this.sampleCtx.textAlign = "left";
    this.sampleCtx.fillStyle = "#ffffff";
    this.sampleCtx.fillText(layout.text, SAMPLE_PAD_X, baselineY);

    const data = this.sampleCtx.getImageData(0, 0, sampleW, sampleH).data;
    const step = resolveStep(density);
    const particles: LyricParticle[] = [];

    for (let y = 0; y < sampleH; y += step) {
      for (let x = 0; x < sampleW; x += step) {
        const alpha = data[(y * sampleW + x) * 4 + 3];
        if (alpha < 75) continue;

        const tx = x - SAMPLE_PAD_X;
        const ty = y;
        const nx = tx / Math.max(1, layout.totalWidth);
        const angle = Math.random() * Math.PI * 2;
        const gatherDist = 24 + Math.random() * 52;
        const sx = tx + Math.cos(angle) * gatherDist - 20 * (1 - nx);
        const sy = ty + Math.sin(angle) * (gatherDist * 0.5);

        const windAngle = -Math.PI / 6 + (Math.random() - 0.5) * 1.4;
        const exitDist = 34 + Math.random() * 64;
        const ex = tx + Math.cos(windAngle) * exitDist + 14;
        const ey = ty + Math.sin(windAngle) * exitDist - 12;

        particles.push({
          tx,
          ty,
          sx,
          sy,
          ex,
          ey,
          delay: nx * 0.24 + Math.random() * 0.08,
          size: step <= 2 ? 1.5 + Math.random() * 1.2 : 1.9 + Math.random() * 1.3,
          tone: Math.random(),
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    this.particlePools.set(lineIndex, { baselineY, particles });
    return particles;
  }

  protected override renderFrame(params: {
    ctx: CanvasRenderingContext2D;
    lineIndex: number;
    line: DesktopLyricLine;
    layout: AlignedLineLayout;
    posMs: number;
    elapsedInLine: number;
    lineDuration: number;
    baselineY: number;
    isWordMode: boolean;
  }): void {
    const { ctx, lineIndex, layout, posMs, elapsedInLine, lineDuration, baselineY, isWordMode } =
      params;
    const style = this.setting.styles.particle;
    if (!layout.text) return;

    const particles = this.getParticlesForLine(lineIndex, layout, baselineY);

    // 防止极短歌词句导致入场与退场时间重叠闪烁
    const sumPhase = style.gatherDurationMs + style.disperseDurationMs;
    const scaleRatio = sumPhase > lineDuration * 0.85 ? (lineDuration * 0.85) / sumPhase : 1;
    const gatherMs = Math.max(120, style.gatherDurationMs * scaleRatio);
    const disperseMs = Math.max(120, style.disperseDurationMs * scaleRatio);

    const gatherRaw = Math.min(1, elapsedInLine / gatherMs);
    const disperseStart = Math.max(gatherMs, lineDuration - disperseMs);
    const disperseRaw =
      elapsedInLine >= disperseStart
        ? Math.min(1, (elapsedInLine - disperseStart) / disperseMs)
        : 0;

    let textAlpha = 1;
    if (gatherRaw < 1) {
      textAlpha = Math.max(0, (gatherRaw - 0.65) / 0.35);
    }
    if (disperseRaw > 0) {
      textAlpha = Math.min(textAlpha, Math.max(0, 1 - disperseRaw / 0.28));
    }

    let litX = layout.totalWidth;
    if (isWordMode) {
      litX = 0;
      let started = false;
      let allDone = true;
      for (const run of layout.runs) {
        const p = getRunProgress(run, posMs);
        if (p <= 0) {
          allDone = false;
          break;
        }
        started = true;
        litX = run.x + run.width * p;
        if (p < 1) {
          allDone = false;
          break;
        }
      }
      if (!started) litX = 0;
      else if (allDone) litX = layout.totalWidth;
    }

    ctx.save();
    ctx.translate(this.cameraX, 0);

    // 1) 清晰主文本
    if (textAlpha > 0.01) {
      ctx.save();
      ctx.font = buildFontString(this.setting);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.globalAlpha = textAlpha;

      strokeOutlineIfEnabled(ctx, this.setting, style.unlitColor, layout.text, 0, baselineY);
      applyDefaultShadow(ctx, this.setting);
      ctx.fillStyle = style.unlitColor;
      ctx.fillText(layout.text, 0, baselineY);

      if (litX > 0.5) {
        const grad = ctx.createLinearGradient(0, 0, Math.max(1, layout.totalWidth), 0);
        grad.addColorStop(0, style.colorStart);
        grad.addColorStop(1, style.colorEnd);

        ctx.beginPath();
        ctx.rect(-12, 0, litX + 12, this.cssHeight);
        ctx.clip();
        strokeOutlineIfEnabled(ctx, this.setting, style.colorStart, layout.text, 0, baselineY);
        ctx.shadowColor = style.colorEnd;
        ctx.shadowBlur = 12;
        ctx.fillStyle = grad;
        ctx.fillText(layout.text, 0, baselineY);
      }
      ctx.restore();
    }

    // 2) 粒子聚散层
    const particleGatherAlpha = gatherRaw < 1 ? 1 - Math.max(0, (gatherRaw - 0.72) / 0.28) : 0;
    const particleDisperseAlpha = disperseRaw > 0 ? 1 - easeInCubic(disperseRaw) : 0;

    if (particleGatherAlpha > 0.01 || particleDisperseAlpha > 0.01) {
      for (const pt of particles) {
        let x = pt.tx;
        let y = pt.ty;
        let alpha = 0;
        let size = pt.size;

        if (disperseRaw > 0) {
          const localD = Math.max(0, Math.min(1, (disperseRaw - pt.delay * 0.6) / 0.78));
          const e = easeInCubic(localD);
          x = pt.tx + (pt.ex - pt.tx) * e;
          y = pt.ty + (pt.ey - pt.ty) * e - Math.sin(localD * Math.PI + pt.phase) * 4;
          alpha = (1 - localD) * 0.95;
          size = pt.size * (1 - localD * 0.45);
        } else {
          const localG = Math.max(0, Math.min(1, (gatherRaw - pt.delay * 0.7) / 0.76));
          const e = easeOutCubic(localG);
          x = pt.sx + (pt.tx - pt.sx) * e;
          y = pt.sy + (pt.ty - pt.sy) * e;
          alpha = Math.min(1, localG * 2.1) * particleGatherAlpha;
        }

        if (alpha <= 0.02) continue;

        const isLit = pt.tx <= litX;
        ctx.save();
        ctx.globalAlpha = isLit ? alpha : alpha * 0.72;
        ctx.fillStyle = isLit
          ? pt.tone > 0.68
            ? "#ffffff"
            : pt.tone > 0.34
              ? style.colorEnd
              : style.colorStart
          : style.unlitColor;
        const s = Math.max(1, size);
        ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s);
        ctx.restore();
      }
    }

    // 3) 演唱中飘散星尘
    if (style.showAmbientSparks && textAlpha > 0.5 && disperseRaw === 0) {
      const sparkCount = isWordMode ? 12 : 8;
      const midY = baselineY - this.setting.fontSize * 0.35;
      for (let i = 0; i < sparkCount; i++) {
        const life = (elapsedInLine * 0.0014 + i * 0.17) % 1;
        const anchorX = isWordMode
          ? litX + Math.sin(i * 19.3) * 14
          : ((i * 0.11 + 0.05) % 0.92) * layout.totalWidth;
        const anchorY = midY + Math.cos(i * 11.7) * (this.setting.fontSize * 0.3);
        const px = anchorX + Math.sin(life * 4 + i) * 7;
        const py = anchorY - life * 24;
        const pAlpha = Math.sin(life * Math.PI) * 0.72 * textAlpha;

        ctx.save();
        ctx.globalAlpha = pAlpha;
        ctx.fillStyle = i % 2 === 0 ? style.colorEnd : style.colorStart;
        const s = 2.2 * (1 - life * 0.4);
        ctx.fillRect(px - s * 0.5, py - s * 0.5, s, s);
        ctx.restore();
      }
    }

    ctx.restore();
  }
}
