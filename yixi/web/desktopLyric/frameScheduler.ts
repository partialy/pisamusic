import {
  DEFAULT_FRAME_INTERVAL_MS,
  DEFAULT_TARGET_FPS,
  FrameRateLimiter,
} from "../../src/utils/frameRateLimiter";

export const DESKTOP_LYRIC_TARGET_FPS = DEFAULT_TARGET_FPS;
export const DESKTOP_LYRIC_FRAME_INTERVAL_MS = DEFAULT_FRAME_INTERVAL_MS;
export { FrameRateLimiter };

/**
 * 计算静态空窗期的休眠时长（ms）：
 * - 返回 `null`：画面正在变化（扫字/切行/镜头滚动），继续 60FPS 循环
 * - 返回 `0`：完全静态（无歌词或已到最后一句末尾），停止循环等待新事件唤醒
 * - 返回 `> 0`：前奏或句间留白期，休眠到下一有效时间点再唤醒
 */
export function computeStaticIdleWakeDelayMs(params: {
  isPlaying: boolean;
  hasLines: boolean;
  inLineTransition: boolean;
  cameraSettled: boolean;
  currentPosMs: number;
  activeStartMs: number;
  activeEndMs: number;
  nextLineStartMs: number | null;
}): number | null {
  if (!params.isPlaying) {
    return 0;
  }

  if (!params.hasLines) {
    return 0;
  }

  if (params.inLineTransition || !params.cameraSettled) {
    return null;
  }

  // 正在进行逐字/整行推进扫描
  if (params.currentPosMs >= params.activeStartMs && params.currentPosMs < params.activeEndMs) {
    return null;
  }

  // 处于当前句开始前的空白期（如前奏）
  if (params.currentPosMs < params.activeStartMs) {
    const waitMs = params.activeStartMs - params.currentPosMs;
    return waitMs <= 16 ? null : Math.min(1500, Math.floor(waitMs - 8));
  }

  // 当前句已播完，等待下一句开始
  if (params.nextLineStartMs === null || !Number.isFinite(params.nextLineStartMs)) {
    return 0;
  }

  const waitMs = params.nextLineStartMs - params.currentPosMs;
  return waitMs <= 16 ? null : Math.min(1500, Math.floor(waitMs - 8));
}
