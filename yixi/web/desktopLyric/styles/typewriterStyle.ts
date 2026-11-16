import type { DesktopLyricLine } from "../../../src/types/desktopLyric";
import {
  applyDefaultShadow,
  buildFontString,
  DesktopLyricCanvasBase,
  easeOutCubic,
  strokeOutlineIfEnabled,
  type AlignedLineLayout,
} from "./shared";

export class TypewriterLyricRenderer extends DesktopLyricCanvasBase {
  protected override getEmptyColor(): string {
    return this.setting.styles.typewriter.textColor;
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
    const style = this.setting.styles.typewriter;
    const chars = layout.chars;
    const totalChars = chars.length;

    if (totalChars === 0) return;

    const charElapsed = new Array<number>(totalChars).fill(-1);
    let latestIdx = -1;
    let done = false;

    if (isWordMode) {
      for (let i = 0; i < totalChars; i++) {
        if (posMs >= chars[i].startTimeMs) {
          charElapsed[i] = posMs - chars[i].startTimeMs;
          latestIdx = i;
        }
      }
      const lastChar = chars[totalChars - 1];
      done = posMs >= lastChar.endTimeMs + 140;
    } else {
      const revealMs = Math.max(100, style.lineRevealDurationMs);
      const stepMs = revealMs / totalChars;
      for (let i = 0; i < totalChars; i++) {
        const appearAt = i * stepMs;
        if (elapsedInLine >= appearAt) {
          charElapsed[i] = elapsedInLine - appearAt;
          latestIdx = i;
        }
      }
      done = elapsedInLine >= revealMs + 320;
    }

    let shownWidth = 0;
    for (let i = 0; i <= latestIdx; i++) {
      shownWidth += chars[i].width;
    }

    const paddingRight = style.showCursor ? 24 : 12;
    let drawX =
      shownWidth + paddingRight <= this.cssWidth
        ? (this.cssWidth - shownWidth) / 2
        : this.cssWidth - shownWidth - paddingRight;

    ctx.save();
    ctx.font = buildFontString(this.setting);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    const midHeightOffset = this.setting.fontSize * 0.35;

    for (let i = 0; i <= latestIdx; i++) {
      const ch = chars[i];
      const pop = easeOutCubic(Math.min(1, charElapsed[i] / 140));
      const offsetY = (1 - pop) * 5;
      const scale = 0.88 + 0.12 * pop;
      const isCurrent = i === latestIdx && !done;
      const fillColor = isCurrent ? style.latestGlowColor : style.textColor;

      ctx.save();
      ctx.translate(drawX + ch.width / 2, baselineY - midHeightOffset + offsetY);
      ctx.scale(scale, scale);
      ctx.globalAlpha = pop;

      strokeOutlineIfEnabled(
        ctx,
        this.setting,
        fillColor,
        ch.text,
        -ch.width / 2,
        midHeightOffset,
      );

      if (isCurrent) {
        ctx.shadowColor = style.latestGlowColor;
        ctx.shadowBlur = 14;
      } else {
        applyDefaultShadow(ctx, this.setting);
      }

      ctx.fillStyle = fillColor;
      ctx.fillText(ch.text, -ch.width / 2, midHeightOffset);
      ctx.restore();

      drawX += ch.width;
    }

    if (style.showCursor && !done) {
      const blink = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos((elapsedInLine / 750) * Math.PI * 2));
      const cursorH = Math.max(14, Math.round(this.setting.fontSize * 0.85));
      const cursorY = Math.round(baselineY - cursorH * 0.84);
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.shadowColor = style.latestGlowColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = style.latestGlowColor;
      ctx.fillRect(drawX + 5, cursorY, 2.5, cursorH);
      ctx.restore();
    }

    ctx.restore();
  }
}
