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

  it("跳过非法 bootstrap feed 并继续使用有效 discovery fallback", () => {
    expect(resolveUpdaterFeedCandidates(
      "https://user:password@updates.example.com/feed?channel=stable#fragment",
      ["https://backup.example.com/releases/win32/x64"],
    )).toEqual(["https://backup.example.com/releases/win32/x64"]);
  });

  it("逐个跳过非法候选，全部非法时返回空数组", () => {
    expect(resolveUpdaterFeedCandidates(
      "not-a-url",
      [
        "http://updates.example.com/feed",
        "https://updates.example.com/feed?channel=stable",
      ],
    )).toEqual([]);
  });
});
