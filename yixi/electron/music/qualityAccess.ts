import { getAccountSession } from "../system/systemClient";
import {
  getQualityAccessLevel,
  normalizeQualityKeyForAccess,
  isQualitySource,
  type QualityAccessLevel,
} from "../../src/musicQuality/musicQualityPolicy";
import type { MusicUrlParams, PlayableTrackPayload } from "./types";
import { parseQualityKey } from "./quality";

export function getCurrentQualityAccessLevel(): QualityAccessLevel {
  const session = getAccountSession();
  return getQualityAccessLevel(session);
}

export type CanonicalMusicUrlParams = MusicUrlParams & {
  qualityKey: string;
};

export type CanonicalPlayableTrackPayload = PlayableTrackPayload & {
  qualityKey?: string;
};

export function normalizeMusicUrlParamsForCurrentAccount(
  params: MusicUrlParams,
): CanonicalMusicUrlParams {
  const access = getCurrentQualityAccessLevel();
  const source = params.source;
  const canonicalKey = normalizeQualityKeyForAccess(source, params.qualityKey, access);
  const parsed = parseQualityKey(canonicalKey);

  const result: CanonicalMusicUrlParams = {
    source,
    id: params.id,
    qualityKey: canonicalKey,
  };

  if (parsed?.kind === "kg" || parsed?.kind === "kw") {
    result.quality = parsed.quality;
  } else if (parsed?.kind === "wy-level") {
    result.level = parsed.level;
  } else if (parsed?.kind === "wy-br") {
    result.br = parsed.br;
  }

  return result;
}

export function normalizePlayableTrackForCurrentAccount<T extends PlayableTrackPayload>(
  track: T,
): T & { qualityKey?: string } {
  if (track.source === "local" || !isQualitySource(track.source)) {
    return track;
  }
  const access = getCurrentQualityAccessLevel();
  const canonicalKey = normalizeQualityKeyForAccess(track.source, track.qualityKey, access);
  const parsed = parseQualityKey(canonicalKey);

  const result: T & { qualityKey?: string } = {
    ...track,
    qualityKey: canonicalKey,
  };

  if (parsed?.kind === "kg" || parsed?.kind === "kw") {
    result.quality = parsed.quality;
    result.br = undefined;
    result.level = undefined;
  } else if (parsed?.kind === "wy-level") {
    result.level = parsed.level;
    result.br = undefined;
    result.quality = undefined;
  } else if (parsed?.kind === "wy-br") {
    result.br = parsed.br;
    result.level = undefined;
    result.quality = undefined;
  }

  return result;
}
