import { describe, expect, it } from "vitest";
import {
  buildListenTogetherJoinLink,
  decideListenTogetherInvite,
  findListenTogetherInviteInArgs,
  parseListenTogetherInvite,
  type ListenTogetherInvite,
} from "./listenTogetherShareLink";

const invite: ListenTogetherInvite = {
  type: "listen-together-join",
  roomId: "123456",
};

describe("buildListenTogetherJoinLink", () => {
  it("builds the canonical website scan link", () => {
    expect(buildListenTogetherJoinLink(" 123456 ")).toBe(
      "https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=123456",
    );
  });

  it.each([
    "https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=123456",
    "https://pisamusic.partialy.cn/scan/?roomId=123456&type=listen-together-join",
    "https://pisamusic.partialy.cn:443/scan?type=listen-together-join&roomId=123456",
    "pisamusic://scan?type=listen-together-join&roomId=123456",
    "PISAMUSIC://SCAN/?roomId=123456&type=listen-together-join",
  ])("parses supported invite %s", (raw) => {
    expect(parseListenTogetherInvite(raw)).toEqual(invite);
  });

  it.each([
    "http://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=123456",
    "https://example.com/scan?type=listen-together-join&roomId=123456",
    "https://pisamusic.partialy.cn:8443/scan?type=listen-together-join&roomId=123456",
    "https://pisamusic.partialy.cn/download?type=listen-together-join&roomId=123456",
    "https://pisamusic.partialy.cn/scan?type=unknown&roomId=123456",
    "https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=12ab",
    "https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=123",
    "https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=%",
    "pisamusic://other?type=listen-together-join&roomId=123456",
    "not a url",
  ])("rejects unsupported invite %s", (raw) => {
    expect(parseListenTogetherInvite(raw)).toBeNull();
  });

  it("uses the last valid invite in process arguments", () => {
    expect(
      findListenTogetherInviteInArgs([
        "--inspect=9229",
        "pisamusic://scan?type=listen-together-join&roomId=1111",
        "--original-process-start-time=123",
        "https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=87654321",
      ]),
    ).toEqual({
      type: "listen-together-join",
      roomId: "87654321",
    });
    expect(findListenTogetherInviteInArgs(["--inspect", "invalid"])).toBeNull();
  });

  it.each([
    [{ currentRoomId: "123456", isLoggedIn: true, onlineServiceAvailable: false }, "open-current-room"],
    [{ currentRoomId: null, isLoggedIn: true, onlineServiceAvailable: false }, "service-unavailable"],
    [{ currentRoomId: null, isLoggedIn: false, onlineServiceAvailable: true }, "request-login"],
    [{ currentRoomId: null, isLoggedIn: true, onlineServiceAvailable: true }, "join-room"],
    [{ currentRoomId: "654321", isLoggedIn: true, onlineServiceAvailable: true }, "confirm-switch-room"],
  ] as const)("decides invite handling for current state", (state, expected) => {
    expect(decideListenTogetherInvite(invite, state)).toBe(expected);
  });
});
