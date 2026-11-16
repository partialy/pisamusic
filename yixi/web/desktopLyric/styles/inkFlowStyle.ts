import type { DesktopLyricLine } from "../../../src/types/desktopLyric";
import {
  applyDefaultShadow,
  buildFontString,
  DesktopLyricCanvasBase,
  getRunProgress,
  strokeOutlineIfEnabled,
  type AlignedLineLayout,
} from "./shared";

export class InkFlowLyricRenderer extends DesktopLyricCanvasBase {
  protected override getEmptyColor(): string {
    return this.setting.styles.ink.unlitColor;
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
    const { ctx, layout, posMs, elapsedInLine, baselineY, isWordMode } = params;
    const style = this.setting.styles.ink;
    if (layout.runs.length === 0) return;

    const feather = style.featherWidth;
    let scanX = -feather;
    let activeIdx = -1;
    let activeProgress = 0;

    if (isWordMode) {
      let started = false;
      let allDone = true;
      for (let i = 0; i < layout.runs.length; i++) {
        const run = layout.runs[i];
        const p = getRunProgress(run, posMs);
        if (p <= 0) {
          allDone = false;
          break;
        }
        started = true;
        scanX = run.x + run.width * p;
        if (p < 1) {
          allDone = false;
          activeIdx = i;
          activeProgress = p;
          break;
        }
      }
      if (!started) {
        scanX = -feather;
      } else if (allDone) {
        scanX = layout.totalWidth + feather;
      }
    } else {
      const sweepMs = Math.max(150, style.lineSweepDurationMs);
      const sweep = Math.min(1, elapsedInLine / sweepMs);
      scanX = -feather + (layout.totalWidth + feather * 2) * sweep;
    }

    ctx.save();
    ctx.translate(this.cameraX, 0);
    ctx.font = buildFontString(this.setting);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    const gradStart = scanX - feather;
    const gradEnd = scanX + feather;
    const grad = ctx.createLinearGradient(gradStart, 0, Math.max(gradStart + 1, gradEnd), 0);
    grad.addColorStop(0, style.highlightStartColor);
    grad.addColorStop(0.52, style.highlightTipColor);
    grad.addColorStop(1, style.unlitColor);

    layout.runs.forEach((run, i) => {
      const offsetY =
        i === activeIdx && style.liftOffset > 0
          ? -style.liftOffset * Math.sin(Math.PI * activeProgress)
          : 0;
      const drawY = baselineY + offsetY;

      ctx.save();
      strokeOutlineIfEnabled(
        ctx,
        this.setting,
        style.highlightStartColor,
        run.text,
        run.x,
        drawY,
      );
      applyDefaultShadow(ctx, this.setting);
      ctx.fillStyle = grad;
      ctx.fillText(run.text, run.x, drawY);
      ctx.restore();
    });

    ctx.restore();
  }
}
