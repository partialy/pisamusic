import type {
  DesktopLyricClockSync,
  DesktopLyricPayload,
  DesktopLyricSettingV2,
} from "../../../src/types/desktopLyric";

export interface IDesktopLyricRenderer {
  setLyric(payload: DesktopLyricPayload): void;
  setSetting(setting: DesktopLyricSettingV2): void;
  syncClock(clock: DesktopLyricClockSync): void;
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void;
  dispose(): void;
}
