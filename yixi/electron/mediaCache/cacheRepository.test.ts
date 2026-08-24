import { afterEach, describe, expect, it } from "vitest";
import { MediaCacheRepository } from "./cacheRepository";

let repository: MediaCacheRepository | null = null;

afterEach(() => {
  repository?.close();
  repository = null;
});

describe("MediaCacheRepository", () => {
  it("记录分片、计算覆盖并查找命中区间", () => {
    repository = new MediaCacheRepository(":memory:");
    repository.upsertEntry({ cacheKey: "a".repeat(64), source: "kg", songId: "1", qualityKey: "kg:128" });
    repository.recordSegment({
      cacheKey: "a".repeat(64),
      startByte: 0,
      endByte: 99,
      sizeBytes: 100,
      totalBytes: 200,
      filePath: "C:\\cache\\0-99.bin",
      mimeType: "audio/mpeg",
    });
    repository.recordSegment({
      cacheKey: "a".repeat(64),
      startByte: 100,
      endByte: 199,
      sizeBytes: 100,
      totalBytes: 200,
      filePath: "C:\\cache\\100-199.bin",
      mimeType: "audio/mpeg",
    });

    expect(repository.getEntry("a".repeat(64))).toEqual(expect.objectContaining({
      cachedBytes: 200,
      totalBytes: 200,
      status: "ready",
    }));
    expect(repository.findCoveringSegment("a".repeat(64), 20, 80)).toEqual(expect.objectContaining({
      startByte: 0,
      endByte: 99,
    }));
    expect(repository.findCoveringSegments("a".repeat(64), 50, 149)).toHaveLength(2);
  });

  it("按最后访问时间返回清理候选并独立清空索引", () => {
    repository = new MediaCacheRepository(":memory:");
    repository.upsertEntry({ cacheKey: "a".repeat(64), source: "kg", songId: "1", qualityKey: "default" });
    repository.upsertEntry({ cacheKey: "b".repeat(64), source: "wy", songId: "2", qualityKey: "default" });
    repository.recordSegment({
      cacheKey: "a".repeat(64), startByte: 0, endByte: 9, sizeBytes: 10,
      totalBytes: 10, filePath: "C:\\cache\\a.bin",
    });
    repository.recordSegment({
      cacheKey: "b".repeat(64), startByte: 0, endByte: 19, sizeBytes: 20,
      totalBytes: 20, filePath: "C:\\cache\\b.bin",
    });

    expect(repository.getStats()).toEqual({ usedBytes: 30, entryCount: 2, readyCount: 2 });
    expect(repository.listEvictionCandidates(["a".repeat(64)]).map((entry) => entry.cacheKey))
      .toEqual(["b".repeat(64)]);
    expect(repository.clearAll()).toHaveLength(2);
    expect(repository.getStats()).toEqual({ usedBytes: 0, entryCount: 0, readyCount: 0 });
  });
});
