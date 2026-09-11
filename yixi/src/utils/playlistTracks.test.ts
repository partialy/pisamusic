import { describe, expect, it } from "vitest";
import { resolveDynamicBatchSize } from "./playlistTracks";

describe("resolveDynamicBatchSize", () => {
  it("handles negative and zero bounds by returning minimum 50", () => {
    expect(resolveDynamicBatchSize(-10)).toBe(50);
    expect(resolveDynamicBatchSize(0)).toBe(50);
    expect(resolveDynamicBatchSize(NaN)).toBe(50);
  });

  it("coerces values below 150 to minimum batch size of 50", () => {
    expect(resolveDynamicBatchSize(20)).toBe(50);
    expect(resolveDynamicBatchSize(60)).toBe(50); // 60 / 3 = 20 -> coerce to 50
    expect(resolveDynamicBatchSize(150)).toBe(50); // 150 / 3 = 50
  });

  it("calculates dynamic batch size for intermediate song counts", () => {
    expect(resolveDynamicBatchSize(151)).toBe(51); // ceil(151 / 3) = 51
    expect(resolveDynamicBatchSize(301)).toBe(101); // ceil(301 / 3) = 101
    expect(resolveDynamicBatchSize(400)).toBe(134); // ceil(400 / 3) = 134
    expect(resolveDynamicBatchSize(598)).toBe(200); // ceil(598 / 3) = 200
  });

  it("caps batch size at maximum 200 for large playlists", () => {
    expect(resolveDynamicBatchSize(600)).toBe(200); // 600 / 3 = 200
    expect(resolveDynamicBatchSize(1000)).toBe(200); // ceil(1000 / 3) = 334 -> capped at 200
    expect(resolveDynamicBatchSize(5000)).toBe(200); // capped at 200
  });
});
