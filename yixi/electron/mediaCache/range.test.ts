import { describe, expect, it } from "vitest";
import { formatByteRange, parseByteRange, parseContentRange } from "./range";

describe("media cache byte range", () => {
  it("解析闭合区间和开放尾部区间", () => {
    expect(parseByteRange("bytes=100-199", 1_000)).toEqual({ start: 100, end: 199 });
    expect(parseByteRange("bytes=200-", 1_000)).toEqual({ start: 200, end: 999 });
    expect(formatByteRange({ start: 200, end: null })).toBe("bytes=200-");
  });

  it("解析 suffix range", () => {
    expect(parseByteRange("bytes=-200", 1_000)).toEqual({ start: 800, end: 999 });
  });

  it("拒绝多段和越界 range", () => {
    expect(parseByteRange("bytes=0-1,10-11", 1_000)).toBeNull();
    expect(parseByteRange("bytes=1000-", 1_000)).toBeNull();
    expect(parseByteRange("bytes=20-10", 1_000)).toBeNull();
  });

  it("解析 Content-Range", () => {
    expect(parseContentRange("bytes 100-199/1000")).toEqual({ start: 100, end: 199, total: 1_000 });
    expect(parseContentRange("bytes 0-99/*")).toEqual({ start: 0, end: 99, total: null });
  });
});
