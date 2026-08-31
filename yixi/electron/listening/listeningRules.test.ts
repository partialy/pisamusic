import { describe, expect, it } from "vitest";
import {
  clampListeningFragmentDuration,
  defaultListeningSummary,
  isSupportedListeningSource,
  normalizeListeningTrack,
} from "./listeningRules";

describe("listeningRules", () => {
  it("normalizes supported tracks and snapshot fields", () => {
    expect(
      normalizeListeningTrack({
        source: "kg",
        id: "123",
        name: "海阔天空",
        singer: "Beyond",
        album: "乐与怒",
        duration: 180000,
      })
    ).toEqual({
      source: "kg",
      songId: "123",
      title: "海阔天空",
      artist: "Beyond",
      album: "乐与怒",
      trackDurationMs: 180000,
    });

    expect(
      normalizeListeningTrack({
        source: "wy",
        songId: "abc",
        title: "Test",
        artist: "Artist",
        album: "Album",
        trackDurationMs: 240000,
      })
    ).toEqual({
      source: "wy",
      songId: "abc",
      title: "Test",
      artist: "Artist",
      album: "Album",
      trackDurationMs: 240000,
    });
  });

  it("converts second duration to milliseconds", () => {
    const track = normalizeListeningTrack({
      source: "cloud",
      id: "cloud-1",
      name: "Song",
      singer: "Singer",
      album: "Album",
      duration: 210, // seconds
    });
    expect(track?.trackDurationMs).toBe(210000);
  });

  it("rejects unsupported sources such as qq", () => {
    expect(
      normalizeListeningTrack({
        source: "qq",
        id: "123",
        name: "QQ Music",
        singer: "Singer",
      })
    ).toBeNull();

    expect(isSupportedListeningSource("qq")).toBe(false);
    expect(isSupportedListeningSource("kg")).toBe(true);
    expect(isSupportedListeningSource("wy")).toBe(true);
    expect(isSupportedListeningSource("kw")).toBe(true);
    expect(isSupportedListeningSource("cloud")).toBe(true);
    expect(isSupportedListeningSource("local")).toBe(true);
  });

  it("rejects invalid local IDs with file paths or URIs", () => {
    expect(normalizeListeningTrack({ source: "local", id: "file:C:/music/a.mp3" })).toBeNull();
    expect(normalizeListeningTrack({ source: "local", id: "content://media/123" })).toBeNull();
    expect(normalizeListeningTrack({ source: "local", id: "C:\\music\\song.mp3" })).toBeNull();
    expect(normalizeListeningTrack({ source: "local", id: "music/song.mp3" })).toBeNull();

    // Valid opaque local ID
    expect(normalizeListeningTrack({ source: "local", id: "local-track-hash-123" })).toMatchObject({
      source: "local",
      songId: "local-track-hash-123",
    });
  });

  it("clamps fragment durations to maximum 15 minutes", () => {
    expect(clampListeningFragmentDuration(16 * 60_000)).toBe(15 * 60_000);
    expect(clampListeningFragmentDuration(5 * 60_000)).toBe(5 * 60_000);
    expect(clampListeningFragmentDuration(0)).toBe(0);
    expect(clampListeningFragmentDuration(-100)).toBe(0);
  });

  it("provides default listening summary", () => {
    expect(defaultListeningSummary()).toEqual({
      totalMs: 0,
      totalMinutes: 0,
      level: { level: 1, minMinutes: 0, maxMinutes: null },
    });
  });
});
