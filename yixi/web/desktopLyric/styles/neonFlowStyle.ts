import type { DesktopLyricLine } from "../../../src/types/desktopLyric";
import {
  applyDefaultShadow,
  buildFontString,
  DesktopLyricCanvasBase,
  getRunProgress,
  strokeOutlineIfEnabled,
  type AlignedLineLayout,
} from "./shared";

export class NeonFlowLyricRenderer extends DesktopLyricCanvasBase {
  protected override getEmptyColor(): string {
    return this.setting.styles.neon.unlitColor;
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
    const style = this.setting.styles.neon;
    if (!layout.text) return;

    let scanX = 0;
    let flowShift = 0;

    if (isWordMode) {
      let allDone = true;
      let started = false;
      for (const run of layout.runs) {
        const p = getRunProgress(run, posMs);
        if (p <= 0) {
          allDone = false;
          break;
        }
        started = true;
        scanX = run.x + run.width * p;
        if (p < 1) {
          allDone = false;
          break;
        }
      }
      if (!started) scanX = 0;
      else if (allDone) scanX = layout.totalWidth;
      flowShift = elapsedInLine * 0.06 * style.flowSpeed;
    } else {
      const revealMs = Math.max(120, style.lineRevealDurationMs);
      const p = Math.min(1, elapsedInLine / revealMs);
      scanX = layout.totalWidth * p;
      if (p >= 1) {
        flowShift = (elapsedInLine - revealMs) * 0.12 * style.flowSpeed;
      }
    }

    ctx.save();
    ctx.translate(this.cameraX, 0);
    ctx.font = buildFontString(this.setting);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // 未唱底字
    ctx.save();
    strokeOutlineIfEnabled(ctx, this.setting, style.unlitColor, layout.text, 0, baselineY);
    applyDefaultShadow(ctx, this.setting);
    ctx.fillStyle = style.unlitColor;
    ctx.fillText(layout.text, 0, baselineY);
    ctx.restore();

    // 已唱裁剪 + 双周期无缝流动极光渐变
    if (scanX > 0.5) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-12, 0, scanX + 12, this.cssHeight);
      ctx.clip();

      const cycleW = Math.max(180, layout.totalWidth);
      const gStart = -(flowShift % cycleW);
      const gEnd = gStart + cycleW * 2;
      const grad = ctx.createLinearGradient(gStart, 0, gEnd, 0);
      grad.addColorStop(0, style.colorStart);
      grad.addColorStop(0.166, style.colorMid);
      grad.addColorStop(0.333, style.colorEnd);
      grad.addColorStop(0.5, style.colorStart);
      grad.addColorStop(0.666, style.colorMid);
      grad.addColorStop(0.833, style.colorEnd);
      grad.addColorStop(1, style.colorStart);

      strokeOutlineIfEnabled(ctx, this.setting, style.colorMid, layout.text, 0, baselineY);
      ctx.shadowColor = style.colorMid;
      ctx.shadowBlur = 14;
      ctx.fillStyle = grad;
      ctx.fillText(layout.text, 0, baselineY);

      if (scanX < layout.totalWidth - 2) {
        const tipGrad = ctx.createLinearGradient(scanX - 18, 0, scanX + 2, 0);
        tipGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
        tipGrad.addColorStop(1, "rgba(255, 255, 255, 0.92)");
        ctx.fillStyle = tipGrad;
        ctx.fillText(layout.text, 0, baselineY);
      }

      ctx.restore();
    }

    ctx.restore();
  }
}
