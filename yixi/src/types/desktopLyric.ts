import type { LyricFpsOption } from "../utils/frameRateLimiter";

export type DesktopLyricKind = "word" | "line";
export type DesktopLyricControlAction = "play" | "pause" | "prev" | "next" | "close" | "restore-main";

export type DesktopLyricStyleId =
  | "default"
  | "typewriter"
  | "ink"
  | "bounce"
  | "spotlight"
  | "neon"
  | "ocean"
  | "particle";

export type DesktopLyricParticleDensity = "fine" | "balanced" | "light";

export interface DesktopLyricWord {
  text: string;
  startTimeMs: number;
  endTimeMs: number;
}

export interface DesktopLyricLine {
  startTimeMs: number;
  endTimeMs: number;
  text: string;
  words: DesktopLyricWord[];
}

export interface DesktopLyricBounds {
  x: number | null;
  y: number | null;
  width: number;
  height: number;
}

export interface DesktopLyricDefaultStyleConfig {
  textColor: string;
  highlightColor: string;
  animationEnabled: boolean;
  wordScaleEnabled: boolean;
}

export interface DesktopLyricTypewriterStyleConfig {
  textColor: string;
  latestGlowColor: string;
  lineRevealDurationMs: number;
  showCursor: boolean;
}

export interface DesktopLyricInkStyleConfig {
  unlitColor: string;
  highlightStartColor: string;
  highlightTipColor: string;
  featherWidth: number;
  liftOffset: number;
  lineSweepDurationMs: number;
}

export interface DesktopLyricBounceStyleConfig {
  unlitColor: string;
  sungColor: string;
  activeColor: string;
  jumpHeight: number;
  jumpScale: number;
}

export interface DesktopLyricSpotlightStyleConfig {
  unlitColor: string;
  sungColor: string;
  activeColor: string;
  glowColor: string;
  blurIntensity: number;
  activeScale: number;
}

export interface DesktopLyricNeonStyleConfig {
  unlitColor: string;
  colorStart: string;
  colorMid: string;
  colorEnd: string;
  lineRevealDurationMs: number;
  flowSpeed: number;
}

export interface DesktopLyricOceanStyleConfig {
  unlitColor: string;
  sungColor: string;
  crestColor: string;
  glowColor: string;
  jumpHeight: number;
  showWaveLine: boolean;
  swayEnabled: boolean;
}

export interface DesktopLyricParticleStyleConfig {
  unlitColor: string;
  colorStart: string;
  colorEnd: string;
  gatherDurationMs: number;
  disperseDurationMs: number;
  particleDensity: DesktopLyricParticleDensity;
  showAmbientSparks: boolean;
}

export interface DesktopLyricStyleConfigMap {
  default: DesktopLyricDefaultStyleConfig;
  typewriter: DesktopLyricTypewriterStyleConfig;
  ink: DesktopLyricInkStyleConfig;
  bounce: DesktopLyricBounceStyleConfig;
  spotlight: DesktopLyricSpotlightStyleConfig;
  neon: DesktopLyricNeonStyleConfig;
  ocean: DesktopLyricOceanStyleConfig;
  particle: DesktopLyricParticleStyleConfig;
}

export type DesktopLyricStylePatchMap = {
  [K in DesktopLyricStyleId]?: Partial<DesktopLyricStyleConfigMap[K]>;
};

export interface DesktopLyricSettingV2 {
  enabled: boolean;
  locked: boolean;
  overlayTaskbar: boolean;
  bounds: DesktopLyricBounds;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  autoOutline: boolean;
  fps: LyricFpsOption;
  style: DesktopLyricStyleId;
  styles: DesktopLyricStyleConfigMap;
  /** 默认样式兼容字段，与 styles.default 保持同步 */
  textColor: string;
  highlightColor: string;
  animationEnabled: boolean;
  wordScaleEnabled: boolean;
}

export type DesktopLyricSettingPatch = Omit<
  Partial<DesktopLyricSettingV2>,
  "bounds" | "styles"
> & {
  bounds?: Partial<DesktopLyricBounds>;
  styles?: DesktopLyricStylePatchMap;
};

export interface DesktopLyricPayload {
  kind: DesktopLyricKind;
  lines: DesktopLyricLine[];
}

export interface DesktopLyricClockSync {
  positionMs: number;
  isPlaying: boolean;
  discontinuity: boolean;
}

export interface DesktopLyricSnapshot {
  visible: boolean;
  lowPowerActive?: boolean;
  lyric: DesktopLyricPayload;
  clock: DesktopLyricClockSync;
  setting: DesktopLyricSettingV2;
}

export interface DesktopLyricWindowBridge {
  ready(): void;
  control(action: DesktopLyricControlAction): void;
  setLocked(locked: boolean): void;
  adjustFontSize(delta: -2 | 2): void;
  requestBounds(bounds: DesktopLyricBounds): void;
  onSnapshot(callback: (snapshot: DesktopLyricSnapshot) => void): () => void;
  onClock(callback: (clock: DesktopLyricClockSync) => void): () => void;
  onLyric(callback: (lyric: DesktopLyricPayload) => void): () => void;
  onSetting(callback: (setting: DesktopLyricSettingV2) => void): () => void;
  onLowPower(callback: (active: boolean) => void): () => void;
}
