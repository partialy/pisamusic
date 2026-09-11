import type {
  DesktopLyricClockSync,
  DesktopLyricPayload,
  DesktopLyricSettingV2,
} from "../../src/types/desktopLyric";
import {
  getDefaultDesktopLyricSetting,
  normalizeDesktopLyricSetting,
} from "../../src/desktopLyric/desktopLyricDefaults";
import {
  createPlaybackClock,
  type PlaybackClock,
} from "./playbackClock";
import {
  buildLineLayout,
  findLineIndex,
  type LineLayout,
  type TextMeasure,
  type TimedGlyphRun,
} from "./lyricLayout";
import {
  computeCameraTargetX,
  computeLineTransition,
  LINE_TRANSITION_DURATION_MS,
  smoothCamera,
  wordScale,
} from "./lyricAnimation";

export interface LyricRenderRuntime {
  now(): number;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
}

export function getRelativeLuminance(color: string): number {
  if (!color || typeof color !== "string") return 1;
  let r = 255;
  let g = 255;
  let b = 255;

  const hexMatch = color.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (hexMatch) {
    r = parseInt(hexMatch[1], 16);
    g = parseInt(hexMatch[2], 16);
    b = parseInt(hexMatch[3], 16);
  } else {
    const shortHex = color.trim().match(/^#([0-9a-f])([0-9a-f])([0-9a-f])/i);
    if (shortHex) {
      r = parseInt(shortHex[1] + shortHex[1], 16);
      g = parseInt(shortHex[2] + shortHex[2], 16);
      b = parseInt(shortHex[3] + shortHex[3], 16);
    } else {
      const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (rgbMatch) {
        r = parseInt(rgbMatch[1], 10);
        g = parseInt(rgbMatch[2], 10);
        b = parseInt(rgbMatch[3], 10);
      }
    }
  }

  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export class LyricCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private liveRegion: HTMLElement;
  private runtime: LyricRenderRuntime;
  private clock: PlaybackClock;
  private setting: DesktopLyricSettingV2;
  private lyric: DesktopLyricPayload;

  private cachedLayouts = new Map<number, LineLayout>();
  private cssWidth = 800;
  private cssHeight = 120;
  private dpr = 1;

  private currentLineIndex = -1;
  private previousLineIndex = -1;
  private transitionStartTime = -1;
  private cameraX = 0;
  private lastFrameTime = 0;
  private rafId: number | null = null;
  private renderRafId: number | null = null;
  private isPlaying = false;
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    liveRegion: HTMLElement,
    runtime?: LyricRenderRuntime,
  ) {
    this.canvas = canvas;
    this.liveRegion = liveRegion;
    this.runtime = runtime ?? {
      now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
      requestFrame: (cb) =>
        typeof requestAnimationFrame !== "undefined"
          ? requestAnimationFrame(cb)
          : (setTimeout(() => cb(Date.now()), 16) as unknown as number),
      cancelFrame: (id) =>
        typeof cancelAnimationFrame !== "undefined"
          ? cancelAnimationFrame(id)
          : clearTimeout(id),
    };

    this.ctx = canvas.getContext ? canvas.getContext("2d") : null;
    this.clock = createPlaybackClock();
    this.setting = getDefaultDesktopLyricSetting();
    this.lyric = { kind: "line", lines: [] };
  }

  setLyric(payload: DesktopLyricPayload): void {
    this.lyric = payload ?? { kind: "line", lines: [] };
    this.cachedLayouts.clear();
    this.currentLineIndex = -1;
    this.previousLineIndex = -1;
    this.transitionStartTime = -1;
    this.cameraX = 0;
    this.requestRender();
  }

  setSetting(setting: DesktopLyricSettingV2): void {
    const prev = this.setting;
    this.setting = normalizeDesktopLyricSetting(setting);

    if (
      prev.fontSize !== this.setting.fontSize ||
      prev.fontFamily !== this.setting.fontFamily ||
      prev.fontWeight !== this.setting.fontWeight
    ) {
      this.cachedLayouts.clear();
    }

    this.requestRender();
  }

  syncClock(clock: DesktopLyricClockSync): void {
    this.clock.sync(clock, this.runtime.now());
    const wasPlaying = this.isPlaying;
    this.isPlaying = Boolean(clock.isPlaying);

    if (this.isPlaying && !wasPlaying) {
      this.startLoop();
    } else if (!this.isPlaying && wasPlaying) {
      this.stopLoop();
    } else if (!this.isPlaying && clock.discontinuity) {
      this.requestRender();
    }
  }


  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
    this.cssWidth = Math.max(10, Math.round(cssWidth));
    this.cssHeight = Math.max(10, Math.round(cssHeight));
    this.dpr = Math.min(2, Math.max(1, devicePixelRatio || 1));

    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;

    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    this.cachedLayouts.clear();
    this.requestRender();
  }

  dispose(): void {
    this.disposed = true;
    this.stopLoop();
    if (this.renderRafId !== null) {
      this.runtime.cancelFrame(this.renderRafId);
      this.renderRafId = null;
    }
    this.cachedLayouts.clear();
  }

  private startLoop(): void {
    if (this.disposed) return;
    if (this.renderRafId !== null) {
      this.runtime.cancelFrame(this.renderRafId);
      this.renderRafId = null;
    }
    if (this.rafId !== null) return;
    this.lastFrameTime = this.runtime.now();
    this.rafId = this.runtime.requestFrame((now) => this.tick(now));
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      this.runtime.cancelFrame(this.rafId);
      this.rafId = null;
    }
  }

  private requestRender(): void {
    if (this.isPlaying || this.renderRafId !== null || this.disposed) return;
    this.renderRafId = this.runtime.requestFrame((now) => {
      this.renderRafId = null;
      if (!this.disposed && !this.isPlaying) {
        this.draw(now);
      }
    });
  }


  private tick(frameNow: number): void {
    if (this.disposed) return;
    this.draw(frameNow);
    if (this.isPlaying) {
      this.rafId = this.runtime.requestFrame((now) => this.tick(now));
    } else {
      this.rafId = null;
    }
  }

  private getLineLayout(index: number): LineLayout {
    let layout = this.cachedLayouts.get(index);
    if (layout) return layout;

    const line = this.lyric.lines[index];
    const measure: TextMeasure = {
      measure: (text: string) => {
        if (!this.ctx) return text.length * (this.setting.fontSize * 0.6);
        this.ctx.font = `${this.setting.fontWeight} ${this.setting.fontSize}px "${this.setting.fontFamily}", sans-serif`;
        return this.ctx.measureText(text).width;
      },
    };

    layout = buildLineLayout(line, measure);
    this.cachedLayouts.set(index, layout);
    return layout;
  }

  private updateLiveRegion(text: string): void {
    if (this.liveRegion && this.liveRegion.textContent !== text) {
      this.liveRegion.textContent = text;
    }
  }

  private draw(frameNow: number): void {
    if (!this.ctx || this.disposed) return;

    const dt = this.lastFrameTime > 0 ? frameNow - this.lastFrameTime : 16;
    this.lastFrameTime = frameNow;

    this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

    const lines = this.lyric.lines;
    if (!lines || lines.length === 0) {
      this.drawEmpty("暂无歌词");
      this.updateLiveRegion("暂无歌词");
      return;
    }

    const currentPosMs = this.clock.now(frameNow);
    const targetIndex = findLineIndex(lines, currentPosMs, this.currentLineIndex);

    if (targetIndex !== this.currentLineIndex) {
      if (this.currentLineIndex >= 0) {
        this.previousLineIndex = this.currentLineIndex;
        this.transitionStartTime = frameNow;
      }
      this.currentLineIndex = targetIndex;
      const targetText = lines[targetIndex]?.text || "";
      this.updateLiveRegion(targetText);
    }

    let transitionProgress = 1;
    if (
      this.transitionStartTime > 0 &&
      this.previousLineIndex >= 0 &&
      this.setting.animationEnabled
    ) {
      const elapsed = frameNow - this.transitionStartTime;
      transitionProgress = Math.min(1, Math.max(0, elapsed / LINE_TRANSITION_DURATION_MS));
      if (transitionProgress >= 1) {
        this.transitionStartTime = -1;
        this.previousLineIndex = -1;
      }
    }

    const transition = computeLineTransition(transitionProgress);
    const currentLayout = this.getLineLayout(this.currentLineIndex);

    const activeCenterX = this.computeActiveCenterX(currentLayout, currentPosMs);
    const targetCameraX = computeCameraTargetX(
      currentLayout.totalWidth,
      this.cssWidth,
      activeCenterX,
    );

    if (this.setting.animationEnabled) {
      this.cameraX = smoothCamera(this.cameraX, targetCameraX, dt, 0.012);
    } else {
      this.cameraX = targetCameraX;
    }

    const baselineY = Math.round(this.cssHeight / 2 + this.setting.fontSize * 0.35);

    if (this.previousLineIndex >= 0 && transitionProgress < 1) {
      const oldLayout = this.getLineLayout(this.previousLineIndex);
      this.drawSingleLine(
        oldLayout,
        Infinity,
        baselineY + transition.oldLine.y,
        transition.oldLine.alpha,
        transition.oldLine.scale,
      );
    }

    const newLineAlpha = this.previousLineIndex >= 0 && transitionProgress < 1
      ? transition.newLine.alpha
      : 1;
    const newLineY = this.previousLineIndex >= 0 && transitionProgress < 1
      ? baselineY + transition.newLine.y
      : baselineY;
    const newLineScale = this.previousLineIndex >= 0 && transitionProgress < 1
      ? transition.newLine.scale
      : 1;

    this.drawSingleLine(
      currentLayout,
      currentPosMs,
      newLineY,
      newLineAlpha,
      newLineScale,
    );
  }

  private computeActiveCenterX(layout: LineLayout, posMs: number): number {
    if (!layout.runs || layout.runs.length === 0) return layout.totalWidth / 2;

    for (const run of layout.runs) {
      if (posMs >= run.startTimeMs && posMs <= run.endTimeMs) {
        const progress =
          (posMs - run.startTimeMs) / Math.max(1, run.endTimeMs - run.startTimeMs);
        return run.x + run.width * Math.max(0, Math.min(1, progress));
      }
    }

    if (posMs > layout.endTimeMs) {
      return layout.totalWidth;
    }
    return 0;
  }

  private drawSingleLine(
    layout: LineLayout,
    posMs: number,
    baselineY: number,
    alpha: number,
    scale: number,
  ): void {
    if (!this.ctx || alpha <= 0.01) return;

    this.ctx.save();
    this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    this.ctx.font = `${this.setting.fontWeight} ${this.setting.fontSize}px "${this.setting.fontFamily}", sans-serif`;
    this.ctx.textBaseline = "alphabetic";

    this.ctx.translate(this.cameraX, 0);

    if (scale !== 1) {
      const centerX = layout.totalWidth / 2;
      this.ctx.translate(centerX, baselineY);
      this.ctx.scale(scale, scale);
      this.ctx.translate(-centerX, -baselineY);
    }

    const isWordMode = this.lyric.kind === "word" && layout.runs.length > 1;

    for (const run of layout.runs) {
      this.drawRun(run, posMs, baselineY, isWordMode);
    }

    this.ctx.restore();
  }

  private drawRun(
    run: TimedGlyphRun,
    posMs: number,
    baselineY: number,
    isWordMode: boolean,
  ): void {
    if (!this.ctx) return;

    let progress = 0;
    if (posMs >= run.endTimeMs) {
      progress = 1;
    } else if (posMs <= run.startTimeMs) {
      progress = 0;
    } else {
      progress =
        (posMs - run.startTimeMs) / Math.max(1, run.endTimeMs - run.startTimeMs);
    }

    const runScale =
      isWordMode && this.setting.wordScaleEnabled && progress > 0 && progress < 1
        ? wordScale(progress, true)
        : 1;

    this.ctx.save();
    if (runScale !== 1) {
      const runCenterX = run.x + run.width / 2;
      this.ctx.translate(runCenterX, baselineY);
      this.ctx.scale(runScale, runScale);
      this.ctx.translate(-runCenterX, -baselineY);
    }

    if (this.setting.autoOutline) {
      const lum = getRelativeLuminance(this.setting.textColor);
      this.ctx.strokeStyle = lum > 0.5 ? "rgba(0, 0, 0, 0.62)" : "rgba(255, 255, 255, 0.52)";
      this.ctx.lineWidth = Math.max(1.5, Math.min(3, this.setting.fontSize * 0.05));
      this.ctx.lineJoin = "round";
      this.ctx.miterLimit = 2;
      this.ctx.strokeText(run.text, run.x, baselineY);
    } else {
      this.ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      this.ctx.shadowBlur = 4;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 2;
    }

    this.ctx.fillStyle = this.setting.textColor;
    this.ctx.fillText(run.text, run.x, baselineY);

    if (progress > 0) {
      this.ctx.save();
      this.ctx.beginPath();
      const clipWidth = run.width * Math.min(1, Math.max(0, progress));
      this.ctx.rect(
        run.x - 2,
        baselineY - this.setting.fontSize * 1.5,
        clipWidth + 2,
        this.setting.fontSize * 2.5,
      );
      this.ctx.clip();

      if (this.setting.autoOutline) {
        const lum = getRelativeLuminance(this.setting.highlightColor);
        this.ctx.strokeStyle = lum > 0.5 ? "rgba(0, 0, 0, 0.62)" : "rgba(255, 255, 255, 0.52)";
        this.ctx.lineWidth = Math.max(1.5, Math.min(3, this.setting.fontSize * 0.05));
        this.ctx.lineJoin = "round";
        this.ctx.miterLimit = 2;
        this.ctx.strokeText(run.text, run.x, baselineY);
      }

      this.ctx.fillStyle = this.setting.highlightColor;
      this.ctx.fillText(run.text, run.x, baselineY);
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  private drawEmpty(text: string): void {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.font = `${this.setting.fontWeight} ${this.setting.fontSize}px "${this.setting.fontFamily}", sans-serif`;
    this.ctx.textBaseline = "middle";
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = this.setting.textColor;
    this.ctx.fillText(text, this.cssWidth / 2, this.cssHeight / 2);
    this.ctx.restore();
  }
}
