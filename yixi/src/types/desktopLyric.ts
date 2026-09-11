export type DesktopLyricKind = "word" | "line";
export type DesktopLyricControlAction = "play" | "pause" | "prev" | "next" | "close";

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

export interface DesktopLyricSettingV2 {
  enabled: boolean;
  locked: boolean;
  overlayTaskbar: boolean;
  bounds: DesktopLyricBounds;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textColor: string;
  highlightColor: string;
  animationEnabled: boolean;
  wordScaleEnabled: boolean;
  autoOutline: boolean;
}

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
  lyric: DesktopLyricPayload;
  clock: DesktopLyricClockSync;
  setting: DesktopLyricSettingV2;
}
