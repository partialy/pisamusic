import type { MusicSource } from "./types";
import {
  getQualityOption,
  isQualitySource,
  getDefaultQualityKey,
} from "../../src/musicQuality/musicQualityPolicy";

export type MusicQualityChoice =
  | { kind: "kg"; quality: string }
  | { kind: "wy-br"; br: number }
  | { kind: "wy-level"; level: string }
  | { kind: "kw"; quality: string };

export function parseQualityKey(key?: string | null): MusicQualityChoice | null {
  const option = getQualityOption(key);
  if (!option) return null;
  switch (option.kind) {
    case "kg":
      return option.quality ? { kind: "kg", quality: option.quality } : null;
    case "kw":
      return option.quality ? { kind: "kw", quality: option.quality } : null;
    case "wy-br":
      return typeof option.br === "number" ? { kind: "wy-br", br: option.br } : null;
    case "wy-level":
      return option.level ? { kind: "wy-level", level: option.level } : null;
    default:
      return null;
  }
}

export function qualityKeyMatchesSource(key: string | undefined, source: MusicSource) {
  if (!key || !isQualitySource(source)) return false;
  const option = getQualityOption(key);
  return Boolean(option && option.source === source);
}

export function toSourceQualityParams(input: {
  source: MusicSource;
  qualityKey?: string;
  quality?: string;
  br?: number;
  level?: string;
}) {
  const parsed = qualityKeyMatchesSource(input.qualityKey, input.source)
    ? parseQualityKey(input.qualityKey)
    : null;

  switch (input.source) {
    case "cloud":
      return { quality: undefined };
    case "kg":
      return { quality: parsed?.kind === "kg" ? parsed.quality : input.quality };
    case "kw":
      return { quality: parsed?.kind === "kw" ? parsed.quality : input.quality };
    case "wy":
      if (parsed?.kind === "wy-level") return { level: parsed.level };
      if (parsed?.kind === "wy-br") return { br: parsed.br };
      return { level: input.level, br: input.br };
  }
}

export function defaultQualityKeyForSource(source: MusicSource) {
  if (isQualitySource(source)) {
    return getDefaultQualityKey(source, "vip");
  }
  return "kg:320";
}
