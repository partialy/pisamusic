import { app, BrowserWindow, screen } from "electron";
import type { WebContents } from "electron";
import type { PlayerControlsVisibilityEvent } from "../../src/types/playerControls";
import {
  createPlayerControlsActivityState,
  isPointInsideWindow,
  PLAYER_CONTROLS_SAMPLE_MS,
  reducePlayerControlsActivity,
} from "./playerControlsActivityRules";
import type { PlayerControlsActivityState } from "./playerControlsActivityRules";

export class PlayerControlsActivityTracker {
  private readonly getMainWindow: () => BrowserWindow | null;
  private intervalId: NodeJS.Timeout | null = null;
  private activeSenderId: number | null = null;
  private sender: WebContents | null = null;
  private state: PlayerControlsActivityState | null = null;

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
  }

  start(sender: WebContents): void {
    if (sender.isDestroyed()) return;

    this.stop();

    this.sender = sender;
    this.activeSenderId = sender.id;
    this.state = null;

    if (!app.isReady()) {
      return;
    }

    // 启动 100ms 采样定时器
    this.intervalId = setInterval(() => {
      this.sample();
    }, PLAYER_CONTROLS_SAMPLE_MS);

    // 立即执行一次采样
    this.sample();
  }

  stop(senderId?: number): void {
    if (senderId !== undefined && this.activeSenderId !== null && senderId !== this.activeSenderId) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.sender = null;
    this.activeSenderId = null;
    this.state = null;
  }

  markRendererInteraction(senderId: number): void {
    if (this.activeSenderId !== senderId || !this.sender || this.sender.isDestroyed()) {
      return;
    }

    const win = this.getMainWindow();
    const windowAvailable = Boolean(
      win && !win.isDestroyed() && win.isVisible() && !win.isMinimized()
    );

    if (!windowAvailable || !win) return;

    const point = screen.getCursorScreenPoint();
    const bounds = win.getBounds();

    if (!isPointInsideWindow(point, bounds)) {
      return;
    }

    const nowMs = Date.now();
    const wasVisible = this.state?.visible ?? false;

    this.state = {
      visible: true,
      pointerInside: true,
      lastPoint: point,
      lastActivityAtMs: nowMs,
    };

    if (!wasVisible) {
      const event: PlayerControlsVisibilityEvent = {
        visible: true,
        pointerInside: true,
        reason: "renderer-interaction",
      };
      this.sender.send("player-controls:visibility", event);
    }
  }

  dispose(): void {
    this.stop();
  }

  private sample(): void {
    if (!this.sender || this.sender.isDestroyed()) {
      this.stop();
      return;
    }

    const win = this.getMainWindow();
    const windowAvailable = Boolean(
      win && !win.isDestroyed() && win.isVisible() && !win.isMinimized()
    );

    const point = screen.getCursorScreenPoint();
    const bounds = win && !win.isDestroyed()
      ? win.getBounds()
      : { x: 0, y: 0, width: 0, height: 0 };
    const nowMs = Date.now();

    if (this.state === null) {
      if (windowAvailable && isPointInsideWindow(point, bounds)) {
        this.state = createPlayerControlsActivityState(point, nowMs);
        const event: PlayerControlsVisibilityEvent = {
          visible: true,
          pointerInside: true,
          reason: "tracking-started",
        };
        this.sender.send("player-controls:visibility", event);
      } else {
        this.state = {
          visible: false,
          pointerInside: false,
          lastPoint: point,
          lastActivityAtMs: nowMs,
        };
        const event: PlayerControlsVisibilityEvent = {
          visible: false,
          pointerInside: false,
          reason: windowAvailable ? "pointer-left-window" : "window-unavailable",
        };
        this.sender.send("player-controls:visibility", event);
      }
      return;
    }

    const transition = reducePlayerControlsActivity(this.state, {
      point,
      bounds,
      nowMs,
      windowAvailable,
    });

    this.state = transition.state;

    if (transition.event && !this.sender.isDestroyed()) {
      this.sender.send("player-controls:visibility", transition.event);
    }
  }
}
