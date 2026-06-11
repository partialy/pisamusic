import { describe, expect, it } from "vitest";
import {
  clampPositionMs,
  needsSeek,
  playerSecondsToProtocolMs,
  protocolMsToPlayerSeconds,
  shouldApplyAckRoom,
  shouldApplyBroadcastVersion,
  shouldCompleteTransition,
  targetPositionMs,
} from "../listenTogetherRules";

describe("targetPositionMs", () => {
  it("playing 状态按 position + now - updatedAt 推算", () => {
    const room = { status: "playing" as const, position: 10_000, updatedAt: 1_000_000 };
    expect(targetPositionMs(room, 1_003_500)).toBe(13_500);
  });

  it("playing 状态时钟回拨不出现负累加", () => {
    const room = { status: "playing" as const, position: 10_000, updatedAt: 1_000_000 };
    expect(targetPositionMs(room, 999_000)).toBe(10_000);
  });

  it("paused 状态不累加时间", () => {
    const room = { status: "paused" as const, position: 10_000, updatedAt: 1_000_000 };
    expect(targetPositionMs(room, 1_999_999)).toBe(10_000);
  });

  it("ended 状态不累加时间", () => {
    const room = { status: "ended" as const, position: 240_000, updatedAt: 1_000_000 };
    expect(targetPositionMs(room, 2_000_000)).toBe(240_000);
  });

  it("负 position 被裁剪为 0", () => {
    const room = { status: "paused" as const, position: -50, updatedAt: 0 };
    expect(targetPositionMs(room, 100)).toBe(0);
  });
});

describe("版本过滤", () => {
  it("旧版本广播被忽略", () => {
    expect(shouldApplyBroadcastVersion(3, 5)).toBe(false);
  });

  it("等于或大于本地版本的广播放行", () => {
    expect(shouldApplyBroadcastVersion(5, 5)).toBe(true);
    expect(shouldApplyBroadcastVersion(6, 5)).toBe(true);
  });

  it("ACK 房间版本不小于本地版本时才更新", () => {
    expect(shouldApplyAckRoom(4, 5)).toBe(false);
    expect(shouldApplyAckRoom(5, 5)).toBe(true);
    expect(shouldApplyAckRoom(7, 5)).toBe(true);
  });
});

describe("shouldCompleteTransition", () => {
  it("匹配的 CHANGE_SONG 结束 pending", () => {
    expect(shouldCompleteTransition("CHANGE_SONG", "t-1", "t-1")).toBe(true);
  });

  it("transitionId 不匹配时不结束", () => {
    expect(shouldCompleteTransition("CHANGE_SONG", "t-1", "t-2")).toBe(false);
  });

  it("没有 pending 时不结束", () => {
    expect(shouldCompleteTransition("CHANGE_SONG", null, "t-1")).toBe(false);
  });

  it("PLAY/PAUSE/SEEK/ENDED 不能结束切歌 pending", () => {
    for (const action of ["PLAY", "PAUSE", "SEEK", "ENDED"]) {
      expect(shouldCompleteTransition(action, "t-1", "t-1")).toBe(false);
    }
  });
});

describe("单位转换", () => {
  it("播放器秒转协议毫秒并取整", () => {
    expect(playerSecondsToProtocolMs(12.3456)).toBe(12_345);
    expect(playerSecondsToProtocolMs(0)).toBe(0);
  });

  it("负值与非法值裁剪为 0", () => {
    expect(playerSecondsToProtocolMs(-3)).toBe(0);
    expect(playerSecondsToProtocolMs(Number.NaN)).toBe(0);
    expect(protocolMsToPlayerSeconds(-100)).toBe(0);
    expect(protocolMsToPlayerSeconds(Number.NaN)).toBe(0);
  });

  it("协议毫秒转播放器秒", () => {
    expect(protocolMsToPlayerSeconds(12_345)).toBeCloseTo(12.345, 6);
  });
});

describe("seek 容差", () => {
  it("偏差大于 1000ms 需要 seek", () => {
    expect(needsSeek(10_000, 11_001)).toBe(true);
    expect(needsSeek(11_001, 10_000)).toBe(true);
  });

  it("偏差不超过 1000ms 不追赶", () => {
    expect(needsSeek(10_000, 11_000)).toBe(false);
    expect(needsSeek(10_000, 10_000)).toBe(false);
  });
});

describe("clampPositionMs", () => {
  it("超过时长裁剪到时长，负值裁剪为 0", () => {
    expect(clampPositionMs(250_000, 240_000)).toBe(240_000);
    expect(clampPositionMs(-1, 240_000)).toBe(0);
    expect(clampPositionMs(120_500.9, 240_000)).toBe(120_500);
  });

  it("时长未知（0）时只裁剪负值", () => {
    expect(clampPositionMs(250_000, 0)).toBe(250_000);
  });
});
