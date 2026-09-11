import type { DesktopLyricClockSync } from "../../src/types/desktopLyric";

export interface PlaybackClock {
  sync(input: DesktopLyricClockSync, receivedAtMs: number): void;
  now(frameNowMs: number): number;
}

const DRIFT_SNAP_THRESHOLD_MS = 120;
const DRIFT_ABSORPTION_DURATION_MS = 180;
const IMMEDIATE_DRIFT_RATIO = 0.35;

export class DesktopLyricPlaybackClock implements PlaybackClock {
  private basePositionMs = 0;
  private baseReceivedAtMs = 0;
  private isPlaying = false;
  private driftOffset = 0;
  private driftStartTime = 0;
  private driftDuration = 0;

  sync(input: DesktopLyricClockSync, receivedAtMs: number): void {
    const position = Math.max(0, Math.round(input.positionMs));
    this.isPlaying = Boolean(input.isPlaying);

    if (input.discontinuity || !this.isPlaying) {
      this.basePositionMs = position;
      this.baseReceivedAtMs = receivedAtMs;
      this.driftOffset = 0;
      this.driftDuration = 0;
      this.driftStartTime = 0;
      return;
    }

    const currentEst =
      this.basePositionMs + Math.max(0, receivedAtMs - this.baseReceivedAtMs);
    const diff = position - currentEst;

    if (Math.abs(diff) >= DRIFT_SNAP_THRESHOLD_MS) {
      this.basePositionMs = position;
      this.baseReceivedAtMs = receivedAtMs;
      this.driftOffset = 0;
      this.driftDuration = 0;
      this.driftStartTime = 0;
      return;
    }

    const immediate = diff * IMMEDIATE_DRIFT_RATIO;
    this.basePositionMs = currentEst + immediate;
    this.baseReceivedAtMs = receivedAtMs;
    this.driftOffset = diff - immediate;
    this.driftStartTime = receivedAtMs;
    this.driftDuration = DRIFT_ABSORPTION_DURATION_MS;
  }

  now(frameNowMs: number): number {
    if (!this.isPlaying) {
      return this.basePositionMs;
    }

    const elapsed = Math.max(0, frameNowMs - this.baseReceivedAtMs);
    let pos = this.basePositionMs + elapsed;

    if (this.driftDuration > 0) {
      const progress = Math.min(
        1,
        Math.max(0, (frameNowMs - this.driftStartTime) / this.driftDuration),
      );
      pos += this.driftOffset * progress;
      if (progress >= 1) {
        this.driftDuration = 0;
        this.driftOffset = 0;
      }
    }

    return Math.round(pos);
  }
}

export function createPlaybackClock(): PlaybackClock {
  return new DesktopLyricPlaybackClock();
}
