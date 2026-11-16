import type { DesktopLyricLine } from "../../../src/types/desktopLyric";
import {
  applyDefaultShadow,
  buildFontString,
  DesktopLyricCanvasBase,
  getRunProgress,
  strokeOutlineIfEnabled,
  type AlignedLineLayout,
} from "./shared";

export class BounceLyricRenderer extends DesktopLyricCanvasBase {
  protected override getEmptyColor(): string {
    return this.setting.styles.bounce.unlitColor;
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
    const style = this.setting.styles.bounce;
    const chars = layout.chars;
    if (chars.length === 0) return;

    const midHeightOffset = this.setting.fontSize * 0.35;

    ctx.save();
    ctx.translate(this.cameraX, 0);
    ctx.font = buildFontString(this.setting);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    chars.forEach((ch, i) => {
      let offsetY = 0;
      let scale = 1;
      let color = style.unlitColor;
      let glow = false;

      if (isWordMode) {
        const p = getRunProgress(ch, posMs);
        if (p > 0 && p < 1) {
          const arc = Math.sin(Math.PI * p);
          offsetY = -style.jumpHeight * arc;
          scale = 1 + (style.jumpScale - 1) * arc;
          color = style.activeColor;
          glow = true;
        } else if (p >= 1) {
          color = style.sungColor;
        }
      } else {
        const local = elapsedInLine - i * 32;
        color = style.sungColor;
        if (local > 0 && local < 420) {
          const arc = Math.sin(Math.PI * (local / 420));
          offsetY = -style.jumpHeight * 0.85 * arc;
          scale = 1 + (style.jumpScale - 1) * 0.65 * arc;
          color = style.activeColor;
          glow = true;
        }
      }

      ctx.save();
      ctx.translate(ch.centerX, baselineY - midHeightOffset + offsetY);
      ctx.scale(scale, scale);

      strokeOutlineIfEnabled(
        ctx,
        this.setting,
        color,
        ch.text,
        -ch.width / 2,
        midHeightOffset,
      );

      if (glow) {
        ctx.shadowColor = style.activeColor;
        ctx.shadowBlur = 16;
      } else {
        applyDefaultShadow(ctx, this.setting);
      }

      ctx.fillStyle = color;
      ctx.fillText(ch.text, -ch.width / 2, midHeightOffset);
      ctx.restore();
    });

    ctx.restore();
  }
}
