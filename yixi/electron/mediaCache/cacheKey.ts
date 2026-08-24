import { createHash } from "node:crypto";
import type { MediaCacheTrack } from "./types";

export function createMediaCacheKey(track: MediaCacheTrack) {
  const identity = getMediaCacheIdentity(track);
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export function getMediaCacheIdentity(track: MediaCacheTrack) {
  const source = normalizeRequiredString(track.source, "歌曲来源");
  const songId = normalizeRequiredString(track.urlParam || track.id, "歌曲 ID");
  const qualityKey = normalizeOptionalString(track.qualityKey) || "default";
  return { source, songId, qualityKey };
}

function normalizeRequiredString(value: unknown, field: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) throw new Error(`${field} 不能为空`);
  return normalized;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}
