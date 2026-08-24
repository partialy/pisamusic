import { describe, expect, it } from "vitest";
import { resolveUpdaterFeedCandidates } from "./updaterConfig";

describe("resolveUpdaterFeedCandidates", () => {
  it("bootstrap feed 优先并与发现配置去重", () => {
    expect(resolveUpdaterFeedCandidates(
      "https://updates.example.com/feed/",
      ["https://updates.example.com/feed", "https://backup.example.com/feed"],
    )).toEqual([
      "https://updates.example.com/feed",
      "https://backup.example.com/feed",
    ]);
  });

  it("bootstrap 不可用时仍返回发现配置 feed", () => {
    expect(resolveUpdaterFeedCandidates("", ["https://updates.example.com/feed"]))
      .toEqual(["https://updates.example.com/feed"]);
  });
});
