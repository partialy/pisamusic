export const DEFAULT_TARGET_FPS = 60;
export const DEFAULT_FRAME_INTERVAL_MS = 1000 / DEFAULT_TARGET_FPS;
// 允许 1.2ms 帧到达抖动容差，防止标准 60Hz 显示器偶发掉帧为 30FPS
const FRAME_JITTER_TOLERANCE_MS = 1.2;

export type LyricFpsOption = 30 | 60 | 90 | 120 | 0;

export const LYRIC_FPS_VALUES: readonly LyricFpsOption[] = [30, 60, 90, 120, 0] as const;

export const LYRIC_FPS_OPTIONS: Array<{ label: string; value: LyricFpsOption }> = [
  { label: "30 FPS", value: 30 },
  { label: "60 FPS", value: 60 },
  { label: "90 FPS", value: 90 },
  { label: "120 FPS", value: 120 },
  { label: "无限制（显示器刷新率）", value: 0 },
];

export function normalizeLyricFps(
  value: unknown,
  fallback: LyricFpsOption = DEFAULT_TARGET_FPS,
): LyricFpsOption {
  return typeof value === "number" && (LYRIC_FPS_VALUES as readonly number[]).includes(value)
    ? (value as LyricFpsOption)
    : fallback;
}

export class FrameRateLimiter {
  private minIntervalMs = DEFAULT_FRAME_INTERVAL_MS;
  private lastDrawAtMs: number | null = null;

  constructor(targetFps: number = DEFAULT_TARGET_FPS) {
    this.setTargetFps(targetFps);
  }

  setTargetFps(targetFps: number): void {
    // 0 表示不限制帧率，跟随 requestAnimationFrame 跑满显示器刷新率
    const nextIntervalMs =
      targetFps === 0
        ? 0
        : Number.isFinite(targetFps) && targetFps > 0
          ? 1000 / targetFps
          : DEFAULT_FRAME_INTERVAL_MS;
    if (nextIntervalMs !== this.minIntervalMs) {
      this.minIntervalMs = nextIntervalMs;
      this.lastDrawAtMs = null;
    }
  }

  /**
   * 判断当前时间戳是否应当执行一次绘制，并推进采样基线。
   */
  shouldDraw(nowMs: number): boolean {
    if (this.minIntervalMs <= 0) {
      this.lastDrawAtMs = nowMs;
      return true;
    }

    if (this.lastDrawAtMs === null) {
      this.lastDrawAtMs = nowMs;
      return true;
    }

    const elapsed = nowMs - this.lastDrawAtMs;
    if (elapsed < 0) {
      // 时钟回拨保护
      this.lastDrawAtMs = nowMs;
      return true;
    }

    if (elapsed + FRAME_JITTER_TOLERANCE_MS < this.minIntervalMs) {
      return false;
    }

    const remainder = elapsed >= this.minIntervalMs * 2 ? 0 : Math.max(0, elapsed - this.minIntervalMs);
    this.lastDrawAtMs = nowMs - Math.min(remainder, this.minIntervalMs * 0.5);
    return true;
  }

  reset(): void {
    this.lastDrawAtMs = null;
  }
}
