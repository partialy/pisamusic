import { describe, expect, it } from "vitest";
import { createMediaCacheKey, getMediaCacheIdentity } from "./cacheKey";

describe("media cache key", () => {
  it("相同歌曲身份得到稳定 key", () => {
    const first = createMediaCacheKey({ source: "kg", id: "ABC", qualityKey: "KG:128" });
    const second = createMediaCacheKey({ source: "kg", urlParam: "abc", qualityKey: "kg:128" });
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("不同音质使用不同 key", () => {
    const normal = createMediaCacheKey({ source: "wy", id: "1", qualityKey: "wy-level:standard" });
    const lossless = createMediaCacheKey({ source: "wy", id: "1", qualityKey: "wy-level:lossless" });
    expect(normal).not.toBe(lossless);
  });

  it("缺少歌曲身份时拒绝缓存", () => {
    expect(() => getMediaCacheIdentity({ source: "kg" })).toThrow("歌曲 ID 不能为空");
  });
});
