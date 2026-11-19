import type {
  DesktopLyricClockSync,
  DesktopLyricLine,
  DesktopLyricPayload,
  DesktopLyricSettingV2,
} from "../../../src/types/desktopLyric";
import {
  getDefaultDesktopLyricSetting,
  normalizeDesktopLyricSetting,
} from "../../../src/desktopLyric/desktopLyricDefaults";
import { computeCameraTargetX, smoothCamera } from "../lyricAnimation";
import { findLineIndex } from "../lyricLayout";
import { createPlaybackClock, type PlaybackClock } from "../playbackClock";
import { FrameRateLimiter } from "../frameScheduler";
import type { IDesktopLyricRenderer } from "./types";

export interface AlignedGlyphRun {
  text: string;
  x: number;
  width: number;
  centerX: number;
  startTimeMs: number;
  endTimeMs: number;
}

export interface AlignedLineLayout {
  text: string;
  totalWidth: number;
  runs: AlignedGlyphRun[];
  chars: AlignedGlyphRun[];
  startTimeMs: number;
  endTimeMs: number;
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

export function buildFontString(setting: DesktopLyricSettingV2): string {
  return `${setting.fontWeight} ${setting.fontSize}px "${setting.fontFamily}", sans-serif`;
}

export function easeOutCubic(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * t;
}

export function getRunProgress(
  run: Pick<AlignedGlyphRun, "startTimeMs" | "endTimeMs">,
  posMs: number,
): number {
  if (posMs <= run.startTimeMs) return 0;
  if (posMs >= run.endTimeMs) return 1;
  return (posMs - run.startTimeMs) / Math.max(1, run.endTimeMs - run.startTimeMs);
}

export function strokeOutlineIfEnabled(
  ctx: CanvasRenderingContext2D,
  setting: DesktopLyricSettingV2,
  referenceColor: string,
  text: string,
  x: number,
  y: number,
): void {
  if (!setting.autoOutline) return;
  const lum = getRelativeLuminance(referenceColor);
  ctx.strokeStyle = lum > 0.5 ? "rgba(0, 0, 0, 0.62)" : "rgba(255, 255, 255, 0.52)";
  ctx.lineWidth = Math.max(1.5, Math.min(3, setting.fontSize * 0.05));
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeText(text, x, y);
}

export function applyDefaultShadow(
  ctx: CanvasRenderingContext2D,
  setting: DesktopLyricSettingV2,
): void {
  if (setting.autoOutline) return;
  ctx.shadowColor = "rgba(0, 0, 0, 0.36)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
}

export function splitGraphemes(text: string): string[] {
  return Array.from(text);
}

export function buildAlignedLineLayout(
  ctx: CanvasRenderingContext2D | null,
  line: DesktopLyricLine | null | undefined,
  setting: DesktopLyricSettingV2,
): AlignedLineLayout {
  if (!line) {
    return { text: "", totalWidth: 0, runs: [], chars: [], startTimeMs: 0, endTimeMs: 0 };
  }

  const measure = (text: string): number => {
    if (!ctx) return text.length * (setting.fontSize * 0.6);
    ctx.font = buildFontString(setting);
    return ctx.measureText(text).width;
  };

  const fullText =
    line.text ||
    (Array.isArray(line.words) ? line.words.map((w) => String(w.text ?? "")).join("") : "");
  const totalWidth = measure(fullText);
  const startTimeMs = line.startTimeMs;
  const endTimeMs = Math.max(startTimeMs + 1, line.endTimeMs);

  // 构建逐字 run（有逐字时间信息用逐字，否则按整行拆字均匀兜底）
  const rawWords = Array.isArray(line.words) ? line.words.filter((w) => w.text) : [];
  const runs: AlignedGlyphRun[] = [];
  if (rawWords.length > 0) {
    const rawWidths = rawWords.map((w) => measure(String(w.text)));
    const rawSum = rawWidths.reduce((acc, w) => acc + w, 0) || 1;
    const scale = totalWidth > 0 ? totalWidth / rawSum : 1;
    let x = 0;
    rawWords.forEach((w, idx) => {
      const width = rawWidths[idx] * scale;
      runs.push({
        text: String(w.text),
        x,
        width,
        centerX: x + width / 2,
        startTimeMs: w.startTimeMs,
        endTimeMs: Math.max(w.startTimeMs + 1, w.endTimeMs),
      });
      x += width;
    });
  } else if (fullText) {
    runs.push({
      text: fullText,
      x: 0,
      width: totalWidth,
      centerX: totalWidth / 2,
      startTimeMs,
      endTimeMs,
    });
  }

  // 构建单字级列表，供打字机/弹跳/聚光灯在逐行模式和混合英文场景逐字处理
  const chars: AlignedGlyphRun[] = [];
  if (rawWords.length > 1) {
    for (const run of runs) {
      const glyphs = splitGraphemes(run.text);
      if (glyphs.length <= 1) {
        chars.push(run);
        continue;
      }
      const gWidths = glyphs.map((g) => measure(g));
      const gSum = gWidths.reduce((a, b) => a + b, 0) || 1;
      const dur = Math.max(1, run.endTimeMs - run.startTimeMs);
      let gx = run.x;
      glyphs.forEach((g, idx) => {
        const w = (gWidths[idx] / gSum) * run.width;
        const t0 = run.startTimeMs + (dur * idx) / glyphs.length;
        const t1 = run.startTimeMs + (dur * (idx + 1)) / glyphs.length;
        chars.push({
          text: g,
          x: gx,
          width: w,
          centerX: gx + w / 2,
          startTimeMs: t0,
          endTimeMs: Math.max(t0 + 1, t1),
        });
        gx += w;
      });
    }
  } else {
    const glyphs = splitGraphemes(fullText);
    const gWidths = glyphs.map((g) => measure(g));
    const gSum = gWidths.reduce((a, b) => a + b, 0) || 1;
    const scale = totalWidth > 0 ? totalWidth / gSum : 1;
    const dur = Math.max(1, endTimeMs - startTimeMs);
    let gx = 0;
    glyphs.forEach((g, idx) => {
      const w = gWidths[idx] * scale;
      const t0 = startTimeMs + (dur * idx) / Math.max(1, glyphs.length);
      const t1 = startTimeMs + (dur * (idx + 1)) / Math.max(1, glyphs.length);
      chars.push({
        text: g,
        x: gx,
        width: w,
        centerX: gx + w / 2,
        startTimeMs: t0,
        endTimeMs: Math.max(t0 + 1, t1),
      });
      gx += w;
    });
  }

  return { text: fullText, totalWidth, runs, chars, startTimeMs, endTimeMs };
}

export abstract class DesktopLyricCanvasBase implements IDesktopLyricRenderer {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D | null;
  protected liveRegion: HTMLElement;
  protected clock: PlaybackClock;
  protected setting: DesktopLyricSettingV2;
  protected lyric: DesktopLyricPayload;

  protected cachedLayouts = new Map<number, AlignedLineLayout>();
  protected cssWidth = 800;
  protected cssHeight = 120;
  protected dpr = 1;

  protected currentLineIndex = -1;
  protected lineEnteredAtMs = 0;
  protected cameraX = 0;
  protected lastFrameTime = 0;
  protected rafId: number | null = null;
  protected renderRafId: number | null = null;
  private frameLimiter = new FrameRateLimiter();
  protected isPlaying = false;
  protected disposed = false;

  constructor(canvas: HTMLCanvasElement, liveRegion: HTMLElement) {
    this.canvas = canvas;
    this.liveRegion = liveRegion;
    this.ctx = canvas.getContext ? canvas.getContext("2d") : null;
    this.clock = createPlaybackClock();
    this.setting = getDefaultDesktopLyricSetting();
    this.lyric = { kind: "line", lines: [] };
  }

  setLyric(payload: DesktopLyricPayload): void {
    this.lyric = payload ?? { kind: "line", lines: [] };
    this.cachedLayouts.clear();
    this.currentLineIndex = -1;
    this.lineEnteredAtMs = 0;
    this.cameraX = 0;
    this.onLyricChanged();
    this.frameLimiter.reset();
    this.ensureActiveRender();
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
    this.onSettingChanged(prev, this.setting);
    this.frameLimiter.setTargetFps(this.setting.fps);
    this.frameLimiter.reset();
    this.ensureActiveRender();
  }

  syncClock(clock: DesktopLyricClockSync): void {
    this.clock.sync(clock, performance.now());
    const wasPlaying = this.isPlaying;
    this.isPlaying = Boolean(clock.isPlaying);

    if (this.isPlaying && !wasPlaying) {
      this.startLoop();
    } else if (!this.isPlaying && wasPlaying) {
      this.stopLoop();
      this.requestRender();
    } else if (!this.isPlaying && clock.discontinuity) {
      this.requestRender();
    } else if (this.isPlaying && (clock.discontinuity || this.rafId === null)) {
      this.frameLimiter.reset();
      this.startLoop();
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
    this.onResized();
    this.frameLimiter.reset();
    this.ensureActiveRender();
  }

  dispose(): void {
    this.disposed = true;
    this.stopLoop();
    if (this.renderRafId !== null) {
      cancelAnimationFrame(this.renderRafId);
      this.renderRafId = null;
    }
    this.cachedLayouts.clear();
    this.onDisposed();
  }

  protected onLyricChanged(): void {}
  protected onSettingChanged(
    _prev: DesktopLyricSettingV2,
    _next: DesktopLyricSettingV2,
  ): void {}
  protected onResized(): void {}
  protected onDisposed(): void {}

  protected abstract renderFrame(params: {
    ctx: CanvasRenderingContext2D;
    lineIndex: number;
    line: DesktopLyricLine;
    layout: AlignedLineLayout;
    posMs: number;
    elapsedInLine: number;
    lineDuration: number;
    baselineY: number;
    isWordMode: boolean;
    dt: number;
  }): void;

  protected getEmptyColor(): string {
    return this.setting.textColor;
  }

  protected computeFocusX(
    layout: AlignedLineLayout,
    posMs: number,
    isWordMode: boolean,
  ): number {
    if (!isWordMode || layout.runs.length === 0) return layout.totalWidth / 2;
    for (const run of layout.runs) {
      if (posMs >= run.startTimeMs && posMs <= run.endTimeMs) {
        const p = getRunProgress(run, posMs);
        return run.x + run.width * p;
      }
    }
    return posMs > layout.endTimeMs ? layout.totalWidth : 0;
  }

  private ensureActiveRender(): void {
    if (this.disposed) return;
    if (this.isPlaying) {
      if (this.rafId === null) {
        this.startLoop();
      }
      return;
    }
    this.requestRender();
  }

  private startLoop(): void {
    if (this.disposed) return;
    this.frameLimiter.reset();
    if (this.renderRafId !== null) {
      cancelAnimationFrame(this.renderRafId);
      this.renderRafId = null;
    }
    if (this.rafId !== null) return;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame((now) => this.tick(now));
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  protected requestRender(): void {
    if (this.isPlaying || this.renderRafId !== null || this.disposed) return;
    this.renderRafId = requestAnimationFrame((now) => {
      this.renderRafId = null;
      if (!this.disposed && !this.isPlaying) {
        this.draw(now);
      }
    });
  }

  private tick(frameNow: number): void {
    if (this.disposed) return;
    if (this.frameLimiter.shouldDraw(frameNow)) {
      this.draw(frameNow);
    }
    if (!this.isPlaying) {
      this.rafId = null;
      return;
    }
    if (!this.lyric.lines || this.lyric.lines.length === 0) {
      // 无歌词时暂停循环，等待 setLyric 重新唤醒
      this.rafId = null;
      return;
    }
    this.rafId = requestAnimationFrame((now) => this.tick(now));
  }

  private getLineLayout(index: number): AlignedLineLayout {
    const cached = this.cachedLayouts.get(index);
    if (cached) return cached;
    const layout = buildAlignedLineLayout(this.ctx, this.lyric.lines[index], this.setting);
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

    const posMs = this.clock.now(frameNow);
    const targetIndex = findLineIndex(lines, posMs, this.currentLineIndex);

    if (targetIndex !== this.currentLineIndex) {
      this.currentLineIndex = targetIndex;
      this.lineEnteredAtMs = frameNow;
      this.updateLiveRegion(lines[targetIndex]?.text || "");
    }

    const line = lines[this.currentLineIndex];
    const layout = this.getLineLayout(this.currentLineIndex);
    const isWordMode = this.lyric.kind === "word" && layout.runs.length > 1;
    const focusX = this.computeFocusX(layout, posMs, isWordMode);
    const targetCameraX = computeCameraTargetX(layout.totalWidth, this.cssWidth, focusX);
    this.cameraX = smoothCamera(this.cameraX, targetCameraX, dt, 0.012);

    const nextLineStart =
      this.currentLineIndex + 1 < lines.length
        ? lines[this.currentLineIndex + 1].startTimeMs
        : line.endTimeMs;
    const lineEndMs = Math.max(line.endTimeMs, nextLineStart);
    const lineDuration = Math.max(400, lineEndMs - line.startTimeMs);
    const elapsedInLine = Math.max(0, posMs - line.startTimeMs);
    const baselineY = Math.round(this.cssHeight / 2 + this.setting.fontSize * 0.35);

    this.renderFrame({
      ctx: this.ctx,
      lineIndex: this.currentLineIndex,
      line,
      layout,
      posMs,
      elapsedInLine,
      lineDuration,
      baselineY,
      isWordMode,
      dt,
    });
  }

  private drawEmpty(text: string): void {
    if (!this.ctx) return;
    const color = this.getEmptyColor();
    this.ctx.save();
    this.ctx.font = buildFontString(this.setting);
    this.ctx.textBaseline = "middle";
    this.ctx.textAlign = "center";
    strokeOutlineIfEnabled(
      this.ctx,
      this.setting,
      color,
      text,
      this.cssWidth / 2,
      this.cssHeight / 2,
    );
    applyDefaultShadow(this.ctx, this.setting);
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, this.cssWidth / 2, this.cssHeight / 2);
    this.ctx.restore();
  }
}
