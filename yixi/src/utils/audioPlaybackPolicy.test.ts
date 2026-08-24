import { describe, expect, it } from "vitest";
import {
  getHowlerFormatHint,
  MAX_CONSECUTIVE_PLAYBACK_FAILURES,
  shouldAutoSkipPlaybackFailure,
} from "./audioPlaybackPolicy";

describe("audio playback policy", () => {
  it("为无扩展名的缓存协议提供 Howler 格式提示", () => {
    expect(getHowlerFormatHint("pisacache://media/abc")).toEqual(["mp3"]);
    expect(getHowlerFormatHint("https://example.com/song.mp3")).toBeUndefined();
  });

  it("最多尝试三首并在成功前保持熔断", () => {
    expect(shouldAutoSkipPlaybackFailure(1, 10)).toBe(true);
    expect(shouldAutoSkipPlaybackFailure(2, 10)).toBe(true);
    expect(shouldAutoSkipPlaybackFailure(MAX_CONSECUTIVE_PLAYBACK_FAILURES, 10)).toBe(false);
    expect(shouldAutoSkipPlaybackFailure(1, 2)).toBe(true);
    expect(shouldAutoSkipPlaybackFailure(2, 2)).toBe(false);
    expect(shouldAutoSkipPlaybackFailure(1, 1)).toBe(false);
  });
});
