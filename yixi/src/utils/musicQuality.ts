import type { Song } from "@/types/song";
import {
  isQualitySource as isQualitySourcePolicy,
  getVisibleQualityOptions,
  getQualityOption as getQualityOptionPolicy,
  getDefaultQualityKey as getDefaultQualityKeyPolicy,
  type QualitySource,
  type QualityAccessLevel,
  type MusicQualityOption,
  type QualityAccessOption,
  type PlaybackQualityPreference,
  PLAYBACK_QUALITY_SETTING_KEY,
} from "@/musicQuality/musicQualityPolicy";

export type {
  QualitySource,
  QualityAccessLevel,
  MusicQualityOption,
  QualityAccessOption,
  PlaybackQualityPreference,
};

export { PLAYBACK_QUALITY_SETTING_KEY };

export function isQualitySource(source: Song["source"] | string | null | undefined): source is QualitySource {
  return isQualitySourcePolicy(source);
}

export function getQualityOptionsForSong(
  song?: Pick<Song, "source"> | null,
  access: QualityAccessLevel = "vip",
): QualityAccessOption[] {
  if (!song || !isQualitySource(song.source)) return [];
  return getVisibleQualityOptions(song.source, access);
}

export function getQualityOption(key?: string | null): MusicQualityOption | null {
  return getQualityOptionPolicy(key);
}

export function getDefaultQualityKey(source: QualitySource, access: QualityAccessLevel = "vip"): string {
  return getDefaultQualityKeyPolicy(source, access);
}
