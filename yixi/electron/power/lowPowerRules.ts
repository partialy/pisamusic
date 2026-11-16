import type { PowerSetting } from "../../src/types/lowPower";

export const AUTO_LOW_POWER_DELAY_MS = 10 * 60 * 1000;

export const DEFAULT_POWER_SETTING: PowerSetting = {
  autoLowPowerOnMinimize: false,
};

export function normalizePowerSetting(input: unknown): PowerSetting {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_POWER_SETTING };
  }
  const raw = input as Record<string, unknown>;
  return {
    autoLowPowerOnMinimize: Boolean(raw.autoLowPowerOnMinimize),
  };
}

export function isWindowIdleForLowPower(state: {
  destroyed: boolean;
  visible: boolean;
  minimized: boolean;
}): boolean {
  if (state.destroyed) return false;
  return state.minimized || !state.visible;
}

export function shouldScheduleAutoLowPower(params: {
  autoLowPowerOnMinimize: boolean;
  active: boolean;
  windowIdle: boolean;
}): boolean {
  return params.autoLowPowerOnMinimize && !params.active && params.windowIdle;
}
