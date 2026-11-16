import type { DesktopLyricLine } from "../../../src/types/desktopLyric";
import { desktopEffectLayout } from "../../../src/lyricStyles/desktopEffectLayout";
import { drawLyricStyleEffect } from "../../../src/lyricStyles/lyricStyleEffects";
import { DesktopLyricCanvasBase, type AlignedLineLayout } from "./shared";

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
    const { ctx, layout, posMs, elapsedInLine, lineDuration, baselineY, isWordMode } = params;
    ctx.save();
    ctx.translate(this.cameraX, 0);
    drawLyricStyleEffect("ink", this.setting.styles.ink, {
      ctx,
      layout: desktopEffectLayout(layout, baselineY, this.cssHeight),
      font: {
        fontSize: this.setting.fontSize,
        fontFamily: this.setting.fontFamily,
        fontWeight: this.setting.fontWeight,
        shadowEnabled: true,
        autoOutline: this.setting.autoOutline,
      },
      positionMs: posMs,
      elapsedMs: elapsedInLine,
      durationMs: lineDuration,
      wordMode: isWordMode,
      viewportWidth: this.cssWidth,
      variant: "desktop",
    });
    ctx.restore();
  }
}
