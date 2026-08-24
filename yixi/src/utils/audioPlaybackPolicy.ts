const MEDIA_CACHE_PROTOCOL = "pisacache://";

export const MAX_CONSECUTIVE_PLAYBACK_FAILURES = 3;

/**
 * Howler 会先按 URL 扩展名判断是否支持播放。自定义缓存 URL 没有扩展名，
 * 因此需要显式给一个 Chromium 支持的格式提示，实际媒体类型仍由协议响应头决定。
 */
export function getHowlerFormatHint(url: string): string[] | undefined {
  return url.startsWith(MEDIA_CACHE_PROTOCOL) ? ["mp3"] : undefined;
}

/** failureCount 包含当前这次失败。 */
export function shouldAutoSkipPlaybackFailure(
  failureCount: number,
  playlistLength: number,
): boolean {
  const maxAttempts = Math.min(
    MAX_CONSECUTIVE_PLAYBACK_FAILURES,
    Math.max(0, playlistLength),
  );
  return playlistLength > 1 && failureCount < maxAttempts;
}
