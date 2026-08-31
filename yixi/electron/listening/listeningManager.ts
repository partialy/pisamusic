import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type {
  ListeningFragment,
  ListeningPlaybackObservation,
  ListeningSummary,
  ListeningTerminalReason,
  ListeningTrackSnapshot,
} from "../../src/types/listening";
import { getAppDatabase } from "../database";
import { getAccountSession, getDesktopDeviceClientId } from "../system/systemClient";
import { fetchListeningSummary, uploadListeningFragments } from "./listeningClient";
import {
  CHECKPOINT_INTERVAL_MS,
  clampListeningFragmentDuration,
  defaultListeningSummary,
  FLUSH_INTERVAL_MS,
  MAX_FRAGMENT_DURATION_MS,
  normalizeListeningTrack,
} from "./listeningRules";

export class ListeningManager {
  private currentAccountId: string | null = null;
  private latestObservation: ListeningPlaybackObservation | null = null;

  private activeSessionId: string | null = null;
  private activeTrack: ListeningTrackSnapshot | null = null;
  private activeStartedWallClockMs: number = 0;
  private activeStartMonotonicMs: number = 0;
  private activeDurationAccumulatedMs: number = 0;
  private isCurrentlyPlaying: boolean = false;

  private checkpointTimer: NodeJS.Timeout | null = null;
  private flushTimer: NodeJS.Timeout | null = null;

  private serverClockOffsetMs: number = 0;
  private isFlushing: boolean = false;
  private attemptedRecoveryAccounts: Set<string> = new Set();

  constructor() {
    this.startPeriodicFlush();
  }

  private getNowWallClockMs(): number {
    return Date.now() + this.serverClockOffsetMs;
  }

  private getStore() {
    return getAppDatabase().listening;
  }

  private getDeviceId(): string {
    return getDesktopDeviceClientId();
  }

  public observe(observation: ListeningPlaybackObservation): void {
    const normalizedTrack = observation.track ? normalizeListeningTrack(observation.track) : null;
    const normalizedObs: ListeningPlaybackObservation = {
      track: normalizedTrack,
      active: Boolean(observation.active && normalizedTrack),
      terminalReason: observation.terminalReason ?? null,
    };
    this.latestObservation = normalizedObs;

    if (!this.currentAccountId) {
      return;
    }

    // If active track identity changed, close the previous track session as manual_next
    if (
      this.activeTrack &&
      (!normalizedTrack ||
        this.activeTrack.source !== normalizedTrack.source ||
        this.activeTrack.songId !== normalizedTrack.songId)
    ) {
      this.finalizeActiveSegment("manual_next", true);
    }

    if (normalizedObs.active && normalizedTrack) {
      if (!this.isCurrentlyPlaying) {
        // Play / Resume
        if (!this.activeSessionId) {
          this.activeSessionId = randomUUID();
        }
        this.activeTrack = normalizedTrack;
        this.activeStartedWallClockMs = this.getNowWallClockMs();
        this.activeStartMonotonicMs = performance.now();
        this.activeDurationAccumulatedMs = 0;
        this.isCurrentlyPlaying = true;
        this.startCheckpointTimer();
        this.saveCheckpoint();
      }
    } else {
      // Paused or Terminal
      if (this.isCurrentlyPlaying) {
        const isTerminal = Boolean(normalizedObs.terminalReason);
        this.finalizeActiveSegment(normalizedObs.terminalReason, isTerminal);
      }
    }
  }

  private finalizeActiveSegment(
    terminalReason: ListeningTerminalReason | null,
    endPlaySession: boolean
  ): void {
    if (!this.isCurrentlyPlaying || !this.activeTrack || !this.currentAccountId) {
      if (endPlaySession) {
        this.activeSessionId = null;
        this.activeTrack = null;
      }
      this.isCurrentlyPlaying = false;
      return;
    }

    const elapsed = Math.max(0, performance.now() - this.activeStartMonotonicMs);
    const totalActiveDuration = Math.round(this.activeDurationAccumulatedMs + elapsed);
    const clampedDuration = clampListeningFragmentDuration(totalActiveDuration);

    if (clampedDuration >= 1000) {
      const endedAtMs = this.activeStartedWallClockMs + clampedDuration;
      const fragment: ListeningFragment = {
        ...this.activeTrack,
        eventId: randomUUID(),
        playSessionId: this.activeSessionId || randomUUID(),
        startedAtMs: this.activeStartedWallClockMs,
        endedAtMs,
        activeDurationMs: clampedDuration,
        terminalReason,
      };
      this.getStore().insertPendingFragment(
        this.currentAccountId,
        this.getDeviceId(),
        fragment
      );
    }

    this.getStore().clearActiveCheckpoint(this.currentAccountId);

    if (endPlaySession) {
      this.activeSessionId = null;
      this.activeTrack = null;
      this.stopCheckpointTimer();
    }

    this.activeDurationAccumulatedMs = 0;
    this.activeStartMonotonicMs = 0;
    this.activeStartedWallClockMs = 0;
    this.isCurrentlyPlaying = false;
  }

  private saveCheckpoint(): void {
    if (!this.isCurrentlyPlaying || !this.activeTrack || !this.currentAccountId || !this.activeSessionId) {
      return;
    }

    const elapsed = Math.max(0, performance.now() - this.activeStartMonotonicMs);
    const totalActive = Math.round(this.activeDurationAccumulatedMs + elapsed);

    // If slice reaches 15 minutes, cut fragment and continue open session
    if (totalActive >= MAX_FRAGMENT_DURATION_MS) {
      const fragment: ListeningFragment = {
        ...this.activeTrack,
        eventId: randomUUID(),
        playSessionId: this.activeSessionId,
        startedAtMs: this.activeStartedWallClockMs,
        endedAtMs: this.activeStartedWallClockMs + MAX_FRAGMENT_DURATION_MS,
        activeDurationMs: MAX_FRAGMENT_DURATION_MS,
        terminalReason: null,
      };
      this.getStore().insertPendingFragment(
        this.currentAccountId,
        this.getDeviceId(),
        fragment
      );

      // Reopen new fragment in the same playSession
      this.activeStartedWallClockMs = this.getNowWallClockMs();
      this.activeStartMonotonicMs = performance.now();
      this.activeDurationAccumulatedMs = 0;
    }

    this.getStore().saveActiveCheckpoint({
      accountId: this.currentAccountId,
      deviceId: this.getDeviceId(),
      playSessionId: this.activeSessionId,
      track: this.activeTrack,
      startedAtMs: this.activeStartedWallClockMs,
      activeDurationMs: Math.round(this.activeDurationAccumulatedMs + (performance.now() - this.activeStartMonotonicMs)),
      checkpointedAtMs: this.getNowWallClockMs(),
    });
  }

  private startCheckpointTimer(): void {
    if (this.checkpointTimer) return;
    this.checkpointTimer = setInterval(() => {
      this.saveCheckpoint();
    }, CHECKPOINT_INTERVAL_MS);
  }

  private stopCheckpointTimer(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
  }

  private startPeriodicFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      void this.flush("interval");
    }, FLUSH_INTERVAL_MS);
  }

  public async onAccountSessionReady(accountId: string): Promise<void> {
    if (!accountId) return;

    if (this.currentAccountId && this.currentAccountId !== accountId) {
      this.onAccountLogout();
    }

    this.currentAccountId = accountId;

    // Recover previous crash checkpoint if any
    const saved = this.getStore().readActiveCheckpoint(accountId);
    if (saved && saved.activeDurationMs >= 1000) {
      const fragment: ListeningFragment = {
        ...saved.track,
        eventId: randomUUID(),
        playSessionId: saved.playSessionId,
        startedAtMs: saved.startedAtMs,
        endedAtMs: saved.startedAtMs + saved.activeDurationMs,
        activeDurationMs: saved.activeDurationMs,
        terminalReason: "app_exit",
      };
      this.getStore().insertPendingFragment(accountId, this.getDeviceId(), fragment);
      this.getStore().clearActiveCheckpoint(accountId);
    } else if (saved) {
      this.getStore().clearActiveCheckpoint(accountId);
    }

    // Startup / Login once-per-account recovery
    if (!this.attemptedRecoveryAccounts.has(accountId)) {
      this.attemptedRecoveryAccounts.add(accountId);
      void this.flush("startup");
    }

    // If renderer is already actively playing, start a fresh segment from now
    if (this.latestObservation?.active && this.latestObservation.track) {
      this.observe(this.latestObservation);
    }
  }

  public onAccountLogout(): void {
    if (this.currentAccountId && this.isCurrentlyPlaying) {
      this.finalizeActiveSegment("app_exit", true);
    }
    if (this.currentAccountId) {
      this.getStore().clearActiveCheckpoint(this.currentAccountId);
    }
    this.currentAccountId = null;
    this.stopCheckpointTimer();
    this.activeSessionId = null;
    this.activeTrack = null;
    this.isCurrentlyPlaying = false;
  }

  public async getCurrentSummary(): Promise<ListeningSummary> {
    const accountId = this.currentAccountId || getAccountSession().user?.id || null;
    if (!accountId) {
      return defaultListeningSummary();
    }

    try {
      const summary = await fetchListeningSummary();
      if (summary && typeof summary.totalMs === "number") {
        this.getStore().saveSummaryCache(accountId, summary);
        return summary;
      }
    } catch {
      // Fallback to cache on network failure
    }

    const cached = this.getStore().readSummaryCache(accountId);
    return cached || defaultListeningSummary();
  }

  public async flush(reason: "startup" | "login" | "interval" | "manual"): Promise<void> {
    if (this.isFlushing || !this.currentAccountId) {
      return;
    }

    const accountId = this.currentAccountId;
    const deviceId = this.getDeviceId();
    const pending = this.getStore().listPendingFragments(accountId, deviceId, 200);

    if (pending.length === 0) {
      return;
    }

    this.isFlushing = true;
    try {
      const result = await uploadListeningFragments(deviceId, pending);
      // Re-verify that account is still unchanged before applying state mutations
      if (this.currentAccountId === accountId) {
        if (result.accepted?.length || result.duplicate?.length) {
          const ackIds = [...(result.accepted || []), ...(result.duplicate || [])];
          this.getStore().ackFragments(accountId, deviceId, ackIds);
        }
        if (result.rejected?.length) {
          this.getStore().rejectFragments(accountId, deviceId, result.rejected);
        }
        if (result.summary && typeof result.summary.totalMs === "number") {
          this.getStore().saveSummaryCache(accountId, result.summary);
        }
        if (typeof result.serverTimeMs === "number" && result.serverTimeMs > 0) {
          this.serverClockOffsetMs = result.serverTimeMs - Date.now();
        }
      }
    } catch (error) {
      console.warn(`[ListeningManager] flush failed (${reason}):`, error);
    } finally {
      this.isFlushing = false;
    }
  }

  public shutdown(): void {
    if (this.currentAccountId && this.isCurrentlyPlaying) {
      this.finalizeActiveSegment("app_exit", true);
    }
    this.stopCheckpointTimer();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
