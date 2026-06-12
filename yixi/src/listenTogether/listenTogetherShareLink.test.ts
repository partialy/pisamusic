import { describe, expect, it } from "vitest";
import { buildListenTogetherJoinLink } from "./listenTogetherShareLink";

describe("buildListenTogetherJoinLink", () => {
  it("builds the canonical website scan link", () => {
    expect(buildListenTogetherJoinLink(" 123456 ")).toBe(
      "https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=123456",
    );
  });
});
