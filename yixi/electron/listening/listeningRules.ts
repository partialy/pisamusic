import type { ListeningSource, ListeningSummary, ListeningTrackSnapshot } from "../../src/types/listening";

export const MAX_FRAGMENT_DURATION_MS = 15 * 60_000;
export const CHECKPOINT_INTERVAL_MS = 60_000;
export const FLUSH_INTERVAL_MS = 15 * 60_000;
export const MAX_BATCH_SIZE = 200;

export const SUPPORTED_LISTENING_SOURCES: ReadonlySet<string> = new Set([
  "kg",
  "wy",
  "kw",
  "cloud",
  "local",
]);

export function isSupportedListeningSource(source: unknown): source is ListeningSource {
  return typeof source === "string" && SUPPORTED_LISTENING_SOURCES.has(source.trim().toLowerCase());
}

export function normalizeListeningTrack(raw: unknown): ListeningTrackSnapshot | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as Record<string, unknown>;
  const rawSource = typeof item.source === "string" ? item.source.trim().toLowerCase() : "";
  if (!isSupportedListeningSource(rawSource)) {
    return null;
  }

  const rawSongId = typeof item.songId === "string"
    ? item.songId.trim()
    : typeof item.id === "string" || typeof item.id === "number"
      ? String(item.id).trim()
      : "";

  if (!rawSongId || rawSongId.length > 256) {
    return null;
  }

  if (rawSource === "local") {
    const lowerId = rawSongId.toLowerCase();
    if (
      lowerId.startsWith("file:") ||
      lowerId.startsWith("content:") ||
      rawSongId.includes("/") ||
      rawSongId.includes("\\")
    ) {
      return null;
    }
  }

  const rawTitle = typeof item.title === "string"
    ? item.title
    : typeof item.name === "string"
      ? item.name
      : "";
  const rawArtist = typeof item.artist === "string"
    ? item.artist
    : typeof item.singer === "string"
      ? item.singer
      : "";
  const rawAlbum = typeof item.album === "string" ? item.album : "";

  const title = rawTitle.trim().slice(0, 512);
  const artist = rawArtist.trim().slice(0, 512);
  const album = rawAlbum.trim().slice(0, 512);

  let trackDurationMs: number | null = null;
  if (typeof item.trackDurationMs === "number" && Number.isFinite(item.trackDurationMs) && item.trackDurationMs > 0) {
    trackDurationMs = Math.round(item.trackDurationMs);
  } else if (typeof item.duration === "number" && Number.isFinite(item.duration) && item.duration > 0) {
    // If duration is in seconds (e.g. < 10000), convert to ms, otherwise keep ms
    trackDurationMs = Math.round(item.duration > 10000 ? item.duration : item.duration * 1000);
  }

  return {
    source: rawSource,
    songId: rawSongId,
    title,
    artist,
    album,
    trackDurationMs,
  };
}

export function clampListeningFragmentDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
  return Math.min(Math.round(durationMs), MAX_FRAGMENT_DURATION_MS);
}

export function defaultListeningSummary(): ListeningSummary {
  return {
    totalMs: 0,
    totalMinutes: 0,
    level: {
      level: 1,
      minMinutes: 0,
      maxMinutes: null,
    },
  };
}
