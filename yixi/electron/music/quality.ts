import type { MusicSource } from "./types";

export type MusicQualityChoice =
  | { kind: "kg"; quality: string }
  | { kind: "wy-br"; br: number }
  | { kind: "wy-level"; level: string }
  | { kind: "kw"; quality: string };

export function parseQualityKey(key?: string | null): MusicQualityChoice | null {
  if (!key) return null;
  const separator = key.indexOf(":");
  if (separator <= 0 || separator === key.length - 1) return null;
  const prefix = key.slice(0, separator);
  const value = key.slice(separator + 1);
  switch (prefix) {
    case "kg":
      return value ? { kind: "kg", quality: value } : null;
    case "kw":
      return value ? { kind: "kw", quality: value } : null;
    case "wy-br": {
      const br = Number(value);
      return Number.isFinite(br) ? { kind: "wy-br", br } : null;
    }
    case "wy-level":
      return value ? { kind: "wy-level", level: value } : null;
    default:
      return null;
  }
}

export function qualityKeyMatchesSource(key: string | undefined, source: MusicSource) {
  const choice = parseQualityKey(key);
  if (!choice) return false;
  if (choice.kind === "kg") return source === "kg";
  if (choice.kind === "kw") return source === "kw";
  return source === "wy";
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
  switch (source) {
    case "kg":
      return "kg:320";
    case "wy":
      return "wy-level:exhigh";
    case "kw":
      return "kw:exhigh";
  }
}
