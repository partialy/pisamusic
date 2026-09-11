import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  DesktopLyricSettingV2,
  DesktopLyricSnapshot,
} from "@/types/desktopLyric";
import {
  getDefaultDesktopLyricSetting,
  normalizeDesktopLyricSetting,
} from "@/desktopLyric/desktopLyricDefaults";

export const useDesktopLyricStore = defineStore("desktopLyric", () => {
  const visible = ref(false);
  const setting = ref<DesktopLyricSettingV2>(getDefaultDesktopLyricSetting());

  function applySnapshot(snapshot: DesktopLyricSnapshot) {
    if (!snapshot) return;
    visible.value = Boolean(snapshot.visible);
    if (snapshot.setting) {
      setting.value = normalizeDesktopLyricSetting(snapshot.setting);
    }
  }

  function setVisible(v: boolean) {
    visible.value = Boolean(v);
  }

  async function initialize(): Promise<void> {
    try {
      const snapshot = await window.electronAPI?.getDesktopLyricSnapshot?.();
      if (snapshot) {
        applySnapshot(snapshot as DesktopLyricSnapshot);
      }
    } catch {
      // headless or error fallback
    }
  }

  async function open(): Promise<void> {
    visible.value = true;
    await window.electronAPI?.openLyricWindow?.();
  }

  async function close(): Promise<void> {
    visible.value = false;
    await window.electronAPI?.closeLyricWindow?.();
  }

  async function toggle(): Promise<void> {
    const next = !visible.value;
    visible.value = next;
    await window.electronAPI?.toggleLyricWindow?.();
  }

  async function patchSetting(patch: Partial<DesktopLyricSettingV2>): Promise<void> {
    setting.value = normalizeDesktopLyricSetting({
      ...setting.value,
      ...patch,
      bounds: {
        ...setting.value.bounds,
        ...(patch.bounds ?? {}),
      },
    });
    if (patch.locked !== undefined) {
      window.electronAPI?.setDesktopLyricLocked?.(patch.locked);
    }
    window.electronAPI?.patchDesktopLyricSetting?.(patch);
  }

  function dispose(): void {
    // cleanup
  }

  return {
    visible,
    setting,
    initialize,
    open,
    close,
    toggle,
    patchSetting,
    applySnapshot,
    setVisible,
    dispose,
  };
});
