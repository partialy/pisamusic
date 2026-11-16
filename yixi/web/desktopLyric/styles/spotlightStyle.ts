import type {
  DesktopLyricLine,
  DesktopLyricSettingV2,
} from "../../../src/types/desktopLyric";
import {
  applyDefaultShadow,
  buildFontString,
  DesktopLyricCanvasBase,
  getRunProgress,
  strokeOutlineIfEnabled,
  type AlignedLineLayout,
} from "./shared";

const BLUR_PAD_X = 32;

export class SpotlightLyricRenderer extends DesktopLyricCanvasBase {
  private blurCanvas: HTMLCanvasElement | null = null;
  private blurCtx: CanvasRenderingContext2D | null = null;
  private blurCacheKey = "";
  private blurLogicalWidth = 0;

  protected override getEmptyColor(): string {
    return this.setting.styles.spotlight.unlitColor;
  }

  protected override onLyricChanged(): void {
    this.blurCacheKey = "";
  }

  protected override onSettingChanged(
    prev: DesktopLyricSettingV2,
    next: DesktopLyricSettingV2,
  ): void {
    if (
      prev.fontSize !== next.fontSize ||
      prev.fontFamily !== next.fontFamily ||
      prev.fontWeight !== next.fontWeight ||
      prev.styles.spotlight.blurIntensity !== next.styles.spotlight.blurIntensity ||
      prev.styles.spotlight.unlitColor !== next.styles.spotlight.unlitColor
    ) {
      this.blurCacheKey = "";
    }
  }

  protected override onResized(): void {
    this.blurCacheKey = "";
  }

  protected override onDisposed(): void {
    this.blurCanvas = null;
    this.blurCtx = null;
    this.blurCacheKey = "";
  }

  private ensureBlurCache(
    lineIndex: number,
    layout: AlignedLineLayout,
    baselineY: number,
  ): void {
    const style = this.setting.styles.spotlight;
    if (style.blurIntensity <= 0.05 || typeof document === "undefined") return;

    const key = `${lineIndex}:${this.cssHeight}:${this.dpr}:${this.setting.fontSize}:${this.setting.fontFamily}:${this.setting.fontWeight}:${style.blurIntensity}:${style.unlitColor}`;
    if (this.blurCacheKey === key && this.blurCanvas) return;

    if (!this.blurCanvas) {
      this.blurCanvas = document.createElement("canvas");
      this.blurCtx = this.blurCanvas.getContext("2d");
    }
    if (!this.blurCtx) return;

    this.blurCacheKey = key;
    this.blurLogicalWidth = Math.max(64, Math.ceil(layout.totalWidth + BLUR_PAD_X * 2));
    this.blurCanvas.width = Math.round(this.blurLogicalWidth * this.dpr);
    this.blurCanvas.height = Math.round(this.cssHeight * this.dpr);

    this.blurCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.blurCtx.clearRect(0, 0, this.blurLogicalWidth, this.cssHeight);
    this.blurCtx.save();
    this.blurCtx.font = buildFontString(this.setting);
    this.blurCtx.textBaseline = "alphabetic";
    this.blurCtx.textAlign = "left";
    this.blurCtx.filter = `blur(${style.blurIntensity}px)`;
    this.blurCtx.fillStyle = style.unlitColor;
    this.blurCtx.fillText(layout.text, BLUR_PAD_X, baselineY);
    this.blurCtx.restore();
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
    const style = this.setting.styles.spotlight;
    const chars = layout.chars;
    if (chars.length === 0) return;

    const focusIn = Math.min(1, elapsedInLine / 340);
    const fadeOut = Math.min(1, Math.max(0, (lineDuration - elapsedInLine) / 220));
    const clarity = Math.min(focusIn, fadeOut);
    const blurAlpha = style.blurIntensity > 0.05 ? (1 - clarity) * 0.9 : 0;
    const maxSpread = layout.totalWidth > this.cssWidth * 0.85 ? 0 : (1 - focusIn) * 5;
    const midHeightOffset = this.setting.fontSize * 0.35;

    this.ensureBlurCache(lineIndex, layout, baselineY);

    ctx.save();
    ctx.translate(this.cameraX, 0);

    if (blurAlpha > 0.02 && this.blurCanvas) {
      ctx.save();
      ctx.globalAlpha = blurAlpha;
      ctx.drawImage(
        this.blurCanvas,
        -BLUR_PAD_X,
        0,
        this.blurLogicalWidth,
        this.cssHeight,
      );
      ctx.restore();
    }

    if (clarity > 0.02) {
      ctx.font = buildFontString(this.setting);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const midIdx = (chars.length - 1) / 2;

      chars.forEach((ch, i) => {
        const spreadX = (i - midIdx) * maxSpread;
        let isActive = false;
        let isSung = false;

        if (isWordMode) {
          const p = getRunProgress(ch, posMs);
          isActive = p > 0 && p < 1;
          isSung = p >= 1;
        } else {
          isActive = elapsedInLine >= 120 && elapsedInLine <= 720;
          isSung = elapsedInLine > 260;
        }

        const scale = isActive ? style.activeScale : 1;
        const fillColor = isActive
          ? style.activeColor
          : isSung
            ? style.sungColor
            : style.unlitColor;

        ctx.save();
        ctx.translate(ch.centerX + spreadX, baselineY - midHeightOffset);
        ctx.scale(scale, scale);
        ctx.globalAlpha = isSung && !isActive ? clarity * 0.9 : clarity;

        strokeOutlineIfEnabled(
          ctx,
          this.setting,
          fillColor,
          ch.text,
          -ch.width / 2,
          midHeightOffset,
        );

        if (isActive) {
          ctx.shadowColor = style.glowColor;
          ctx.shadowBlur = 22;
        } else {
          applyDefaultShadow(ctx, this.setting);
        }

        ctx.fillStyle = fillColor;
        ctx.fillText(ch.text, -ch.width / 2, midHeightOffset);
        ctx.restore();
      });
    }

    ctx.restore();
  }
}
