export const DEFAULT_TARGET_FPS = 60;
export const DEFAULT_FRAME_INTERVAL_MS = 1000 / DEFAULT_TARGET_FPS;
// 允许 1.2ms 帧到达抖动容差，防止标准 60Hz 显示器偶发掉帧为 30FPS
const FRAME_JITTER_TOLERANCE_MS = 1.2;

export class FrameRateLimiter {
  private readonly minIntervalMs: number;
  private lastDrawAtMs: number | null = null;

  constructor(targetFps = DEFAULT_TARGET_FPS) {
    const safeFps = Number.isFinite(targetFps) && targetFps > 0 ? targetFps : DEFAULT_TARGET_FPS;
    this.minIntervalMs = 1000 / safeFps;
  }

  /**
   * 判断当前时间戳是否应当执行一次绘制，并推进采样基线。
   */
  shouldDraw(nowMs: number): boolean {
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
