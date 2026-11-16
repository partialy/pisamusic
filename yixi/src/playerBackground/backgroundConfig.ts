export interface PlayerBackgroundConfig {
  version: 2;
  mode: "image" | "dynamic" | "flow";
  image: { url: string; blur: number; brightness: number; mask: number };
  dynamic: { speed: number; fps: number; scale: number; brightness: number; mask: number; continueWhenPaused: boolean };
  flow: { speed: number; amplitude: number; intensity: number; brightness: number; saturation: number; colorMode: "cover" | "soft" | "vivid"; fps: number; scale: number; continueWhenPaused: boolean };
}

export type PlayerBackgroundPatch = { mode?: PlayerBackgroundConfig["mode"]; image?: Partial<PlayerBackgroundConfig["image"]>; dynamic?: Partial<PlayerBackgroundConfig["dynamic"]>; flow?: Partial<PlayerBackgroundConfig["flow"]> };

export const getDefaultBackgroundConfig = (): PlayerBackgroundConfig => ({
  version: 2, mode: "flow",
  image: { url: "", blur: 0, brightness: 100, mask: 16 },
  dynamic: { speed: 2, fps: 60, scale: 0.75, brightness: 100, mask: 30, continueWhenPaused: false },
  flow: { speed: 1, amplitude: 50, intensity: 50, brightness: 50, saturation: 50, colorMode: "cover", fps: 30, scale: 0.75, continueWhenPaused: false },
});

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const number = (value: unknown, fallback: number, min = 0, max = 100) => typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const fps = (value: unknown, fallback: number) => [30, 60, 120].includes(value as number) ? value as number : fallback;
const scale = (value: unknown, fallback: number) => [0.25, 0.5, 0.75, 1].includes(value as number) ? value as number : fallback;

export function normalizeBackgroundConfig(input: unknown, legacy?: Record<string, unknown>): PlayerBackgroundConfig {
  const result = getDefaultBackgroundConfig();
  const raw = record(input);
  const image = record(raw.image), dynamic = record(raw.dynamic), flow = record(raw.flow);
  if (raw.mode === "image" || raw.mode === "dynamic" || raw.mode === "flow") result.mode = raw.mode;
  else if (legacy?.backgroundMode === "image") result.mode = "image";
  else if (legacy?.backgroundMode === "default") result.mode = "dynamic";
  const old = raw.version === 2 ? {} : legacy ?? {};
  result.image.url = typeof image.url === "string" ? image.url : typeof old.backgroundImage === "string" ? old.backgroundImage : "";
  result.image.blur = number(image.blur ?? old.backgroundBlur, 0);
  result.image.brightness = number(image.brightness ?? old.backgroundBrightness, 100);
  result.image.mask = number(image.mask, 16, 0, 80);
  result.dynamic.speed = number(dynamic.speed ?? old.backgroundFlowSpeed, 2, 0, 4);
  result.dynamic.fps = fps(dynamic.fps ?? old.backgroundFps, 60);
  result.dynamic.scale = scale(dynamic.scale ?? old.backgroundRenderScale, 0.75);
  result.dynamic.brightness = number(dynamic.brightness, 100);
  result.dynamic.mask = number(dynamic.mask, 30, 0, 80);
  result.dynamic.continueWhenPaused = dynamic.continueWhenPaused === true;
  result.flow.speed = number(flow.speed, 1, 0.5, 2);
  for (const key of ["amplitude", "intensity", "brightness", "saturation"] as const) result.flow[key] = number(flow[key], 50);
  if (flow.colorMode === "cover" || flow.colorMode === "soft" || flow.colorMode === "vivid") result.flow.colorMode = flow.colorMode;
  result.flow.fps = fps(flow.fps, 30);
  result.flow.scale = scale(flow.scale, 0.75);
  result.flow.continueWhenPaused = flow.continueWhenPaused === true;
  return result;
}
