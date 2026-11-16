import { defineStore } from "pinia";
import { ref } from "vue";
import electronAPI from "@/utils/electron";
import type { LowPowerReason, LowPowerState } from "@/types/lowPower";

export const useLowPowerStore = defineStore("lowPower", () => {
  const active = ref(false);
  const reason = ref<LowPowerReason>(null);
  const autoLowPowerOnMinimize = ref(false);
  const pendingUntilMs = ref<number | null>(null);

  let initialized = false;
  let initPromise: Promise<void> | null = null;
  let unsubscribeState: (() => void) | null = null;
  let stateGeneration = 0;

  function applyState(state: LowPowerState | null | undefined): void {
    if (!state) return;
    active.value = Boolean(state.active);
    reason.value = state.reason ?? null;
    autoLowPowerOnMinimize.value = Boolean(state.autoLowPowerOnMinimize);
    pendingUntilMs.value = state.pendingUntilMs ?? null;
  }

  function initialize(): Promise<void> {
    if (initialized) return Promise.resolve();
    if (initPromise) return initPromise;

    if (!unsubscribeState && electronAPI.onLowPowerStateChanged) {
      unsubscribeState = electronAPI.onLowPowerStateChanged((next) => {
        stateGeneration += 1;
        applyState(next);
      });
    }

    const startGeneration = stateGeneration;
    initPromise = (async () => {
      try {
        const snapshot = await electronAPI.getLowPowerState?.();
        if (snapshot && stateGeneration === startGeneration) {
          applyState(snapshot);
        }
        initialized = true;
      } catch (error) {
        initPromise = null;
        void electronAPI.reportError?.(error, { scope: "low-power", action: "initialize" });
      }
    })();

    return initPromise;
  }

  async function setAutoLowPower(enabled: boolean): Promise<void> {
    const next = await electronAPI.setAutoLowPower?.(Boolean(enabled));
    if (next) {
      stateGeneration += 1;
      applyState(next);
    }
  }

  async function enterManual(): Promise<void> {
    const next = await electronAPI.enterLowPowerMode?.({ hideWindow: true });
    if (next) {
      stateGeneration += 1;
      applyState(next);
    }
  }

  async function exitToNormal(): Promise<void> {
    const next = await electronAPI.exitLowPowerMode?.({ showWindow: true });
    if (next) {
      stateGeneration += 1;
      applyState(next);
    }
  }

  function dispose(): void {
    unsubscribeState?.();
    unsubscribeState = null;
    initialized = false;
    initPromise = null;
  }

  return {
    active,
    reason,
    autoLowPowerOnMinimize,
    pendingUntilMs,
    initialize,
    setAutoLowPower,
    enterManual,
    exitToNormal,
    dispose,
  };
});
