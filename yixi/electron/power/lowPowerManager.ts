import type { BrowserWindow } from "electron";
import { POWER_SETTING_KEY, type LowPowerReason, type LowPowerState, type PowerSetting } from "../../src/types/lowPower";
import { getAppDatabase } from "../database";
import {
  AUTO_LOW_POWER_DELAY_MS,
  DEFAULT_POWER_SETTING,
  isWindowIdleForLowPower,
  normalizePowerSetting,
  shouldScheduleAutoLowPower,
} from "./lowPowerRules";

export interface LowPowerWindowLike {
  isDestroyed(): boolean;
  isVisible(): boolean;
  isMinimized(): boolean;
  hide(): void;
  show(): void;
  restore(): void;
  focus(): void;
  on(event: "minimize" | "hide" | "restore" | "show" | "closed", listener: () => void): unknown;
  removeListener?(event: "minimize" | "hide" | "restore" | "show" | "closed", listener: () => void): unknown;
  webContents: {
    isDestroyed(): boolean;
    send(channel: string, ...args: unknown[]): void;
  };
}

export interface LowPowerManagerOptions {
  getMainWindow: () => LowPowerWindowLike | null;
  onLowPowerChanged?: (active: boolean, state: LowPowerState) => void;
  onWindowActivityChanged?: (windowAvailable: boolean) => void;
  readSetting?: () => PowerSetting;
  writeSetting?: (setting: PowerSetting) => void;
  scheduleTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timerId: ReturnType<typeof setTimeout>) => void;
  now?: () => number;
  autoDelayMs?: number;
}

export class LowPowerManager {
  private readonly getMainWindow: () => LowPowerWindowLike | null;
  private readonly onLowPowerChanged?: (active: boolean, state: LowPowerState) => void;
  private readonly onWindowActivityChanged?: (windowAvailable: boolean) => void;
  private readonly readSetting: () => PowerSetting;
  private readonly writeSetting: (setting: PowerSetting) => void;
  private readonly scheduleTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (timerId: ReturnType<typeof setTimeout>) => void;
  private readonly now: () => number;
  private readonly autoDelayMs: number;

  private setting: PowerSetting;
  private active = false;
  private reason: LowPowerReason = null;
  private pendingUntilMs: number | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private attachedWindow: LowPowerWindowLike | null = null;
  private detachWindowListeners: (() => void) | null = null;

  constructor(options: LowPowerManagerOptions) {
    this.getMainWindow = options.getMainWindow;
    this.onLowPowerChanged = options.onLowPowerChanged;
    this.onWindowActivityChanged = options.onWindowActivityChanged;
    this.readSetting =
      options.readSetting ??
      (() => {
        try {
          const record = getAppDatabase().getSetting<PowerSetting>(POWER_SETTING_KEY);
          return normalizePowerSetting(record?.value);
        } catch {
          return { ...DEFAULT_POWER_SETTING };
        }
      });
    this.writeSetting =
      options.writeSetting ??
      ((setting) => {
        getAppDatabase().setSetting(POWER_SETTING_KEY, setting, 1);
      });
    this.scheduleTimer = options.scheduleTimer ?? ((cb, ms) => setTimeout(cb, ms));
    this.clearTimer = options.clearTimer ?? ((id) => clearTimeout(id));
    this.now = options.now ?? (() => Date.now());
    this.autoDelayMs = options.autoDelayMs ?? AUTO_LOW_POWER_DELAY_MS;
    this.setting = normalizePowerSetting(this.readSetting());
  }

  getState(): LowPowerState {
    return {
      active: this.active,
      reason: this.reason,
      autoLowPowerOnMinimize: this.setting.autoLowPowerOnMinimize,
      pendingUntilMs: this.pendingUntilMs,
    };
  }

  attachMainWindow(win: LowPowerWindowLike): void {
    if (this.attachedWindow === win) return;
    this.detachWindowListeners?.();
    this.attachedWindow = win;

    const handleIdle = () => {
      this.onWindowActivityChanged?.(false);
      this.evaluateAutoSchedule();
    };

    const handleWake = () => {
      this.clearCountdown();
      if (this.active) {
        this.exit({ showWindow: false });
      }
      this.onWindowActivityChanged?.(true);
      this.broadcastState();
    };

    const handleClosed = () => {
      this.clearCountdown();
      this.detachWindowListeners?.();
      this.attachedWindow = null;
    };

    win.on("minimize", handleIdle);
    win.on("hide", handleIdle);
    win.on("restore", handleWake);
    win.on("show", handleWake);
    win.on("closed", handleClosed);

    this.detachWindowListeners = () => {
      win.removeListener?.("minimize", handleIdle);
      win.removeListener?.("hide", handleIdle);
      win.removeListener?.("restore", handleWake);
      win.removeListener?.("show", handleWake);
      win.removeListener?.("closed", handleClosed);
    };

    this.evaluateAutoSchedule();
  }

  setAutoLowPower(enabled: boolean): LowPowerState {
    const next = normalizePowerSetting({ autoLowPowerOnMinimize: enabled });
    this.setting = next;
    this.writeSetting(next);

    if (!next.autoLowPowerOnMinimize) {
      this.clearCountdown();
    } else {
      this.evaluateAutoSchedule();
    }

    const state = this.getState();
    this.broadcastState(state);
    return state;
  }

  enter(reason: Exclude<LowPowerReason, null> = "manual", options: { hideWindow?: boolean } = {}): LowPowerState {
    this.clearCountdown();

    if (!this.active || this.reason !== reason) {
      this.active = true;
      this.reason = reason;
      const state = this.getState();
      this.broadcastState(state);
      this.onLowPowerChanged?.(true, state);
    }

    if (options.hideWindow) {
      const win = this.getMainWindow();
      if (win && !win.isDestroyed() && win.isVisible()) {
        win.hide();
      }
    }

    return this.getState();
  }

  exit(options: { showWindow?: boolean } = {}): LowPowerState {
    const hadCountdown = this.clearCountdown();
    const wasActive = this.active;

    if (wasActive) {
      this.active = false;
      this.reason = null;
      const state = this.getState();
      this.broadcastState(state);
      this.onLowPowerChanged?.(false, state);
    } else if (hadCountdown) {
      this.broadcastState();
    }

    if (options.showWindow) {
      const win = this.getMainWindow();
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) {
          win.restore();
        }
        win.show();
        win.focus();
      }
    }

    return this.getState();
  }

  toggleManual(): LowPowerState {
    return this.active ? this.exit({ showWindow: true }) : this.enter("manual", { hideWindow: true });
  }

  dispose(): void {
    this.clearCountdown();
    this.detachWindowListeners?.();
    this.detachWindowListeners = null;
    this.attachedWindow = null;
  }

  private evaluateAutoSchedule(): void {
    const win = this.getMainWindow();
    const windowIdle = Boolean(
      win &&
        isWindowIdleForLowPower({
          destroyed: win.isDestroyed(),
          visible: win.isVisible(),
          minimized: win.isMinimized(),
        }),
    );

    if (
      !shouldScheduleAutoLowPower({
        autoLowPowerOnMinimize: this.setting.autoLowPowerOnMinimize,
        active: this.active,
        windowIdle,
      })
    ) {
      if (this.clearCountdown()) {
        this.broadcastState();
      }
      return;
    }

    if (this.countdownTimer !== null) return;

    this.pendingUntilMs = this.now() + this.autoDelayMs;
    this.countdownTimer = this.scheduleTimer(() => {
      this.countdownTimer = null;
      this.pendingUntilMs = null;

      const currentWin = this.getMainWindow();
      if (
        !this.setting.autoLowPowerOnMinimize ||
        this.active ||
        !currentWin ||
        !isWindowIdleForLowPower({
          destroyed: currentWin.isDestroyed(),
          visible: currentWin.isVisible(),
          minimized: currentWin.isMinimized(),
        })
      ) {
        this.broadcastState();
        return;
      }

      this.enter("auto", { hideWindow: false });
    }, this.autoDelayMs);
  }

  private clearCountdown(): boolean {
    let cleared = false;
    if (this.countdownTimer !== null) {
      this.clearTimer(this.countdownTimer);
      this.countdownTimer = null;
      cleared = true;
    }
    if (this.pendingUntilMs !== null) {
      this.pendingUntilMs = null;
      cleared = true;
    }
    return cleared;
  }

  private broadcastState(state: LowPowerState = this.getState()): void {
    const win = this.getMainWindow();
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send("low-power:state-changed", state);
  }
}

export type BrowserMainWindow = BrowserWindow;
