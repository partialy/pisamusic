export const POWER_SETTING_KEY = "power-setting";

export interface PowerSetting {
  /** 开启后，App 最小化或关闭到托盘超过 10 分钟自动进入低能耗模式 */
  autoLowPowerOnMinimize: boolean;
}

export type LowPowerReason = "manual" | "auto" | null;

export interface LowPowerState {
  active: boolean;
  reason: LowPowerReason;
  autoLowPowerOnMinimize: boolean;
  /** 距离自动进入低能耗的预计时间戳（ms），未计时为 null */
  pendingUntilMs: number | null;
}
