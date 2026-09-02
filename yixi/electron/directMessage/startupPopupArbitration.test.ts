import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AnnouncementAutoPopupScheduler,
  StartupPopupArbitrator,
} from "../../src/composables/startupPopupArbitration";

afterEach(() => {
  vi.useRealTimers();
});

describe("startup popup arbitration", () => {
  it("cancels a queued announcement and rechecks the gate at timer execution", async () => {
    vi.useFakeTimers();
    let eligible = true;
    const load = vi.fn(async () => () => undefined);
    const scheduler = new AnnouncementAutoPopupScheduler({
      delayMs: 2000,
      isEligible: () => eligible,
      load,
      onError: vi.fn(),
    });

    scheduler.reconcile();
    eligible = false;
    scheduler.reconcile();
    await vi.advanceTimersByTimeAsync(2000);
    expect(load).not.toHaveBeenCalled();

    eligible = true;
    scheduler.reconcile();
    eligible = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(load).not.toHaveBeenCalled();
  });

  it("does not present an in-flight announcement after direct messages close the gate", async () => {
    vi.useFakeTimers();
    let eligible = true;
    let resolveLoad: ((present: () => void) => void) | undefined;
    const present = vi.fn();
    const scheduler = new AnnouncementAutoPopupScheduler({
      delayMs: 2000,
      isEligible: () => eligible,
      load: () => new Promise((resolve) => {
        resolveLoad = resolve;
      }),
      onError: vi.fn(),
    });

    scheduler.reconcile();
    await vi.advanceTimersByTimeAsync(2000);
    eligible = false;
    scheduler.reconcile();
    resolveLoad?.(present);
    await Promise.resolve();

    expect(present).not.toHaveBeenCalled();
  });

  it("holds direct messages until an already-visible announcement has left", () => {
    const arbitrator = new StartupPopupArbitrator();
    arbitrator.setDirectMessagesSettled(true);
    arbitrator.setAnnouncementVisible(true);

    expect(arbitrator.canPresentDirectMessages()).toBe(false);
    arbitrator.setDirectMessagesSettled(false);
    expect(arbitrator.canPresentDirectMessages()).toBe(false);

    arbitrator.setAnnouncementVisible(false);
    expect(arbitrator.canPresentDirectMessages()).toBe(true);
  });
});
