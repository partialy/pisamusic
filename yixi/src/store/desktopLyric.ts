import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  DesktopLyricSettingPatch,
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
  const unsubs: Array<() => void> = [];
  let initialization: Promise<void> | null = null;
  let lifecycle = 0;
  let settingGeneration = 0;
  let visibilityGeneration = 0;

  function applySnapshot(snapshot: DesktopLyricSnapshot) {
    if (!snapshot) return;
    visible.value = Boolean(snapshot.visible);
    visibilityGeneration += 1;
    if (snapshot.setting) {
      setting.value = normalizeDesktopLyricSetting(snapshot.setting);
      settingGeneration += 1;
    }
  }

  function setVisible(v: boolean) {
    visible.value = Boolean(v);
    visibilityGeneration += 1;
  }

  function initialize(): Promise<void> {
    if (initialization) return initialization;
    const api = window.electronAPI;
    if (unsubs.length === 0) {
      const subscriptionLifecycle = lifecycle;
      if (api?.onDesktopLyricSettingChanged) {
        unsubs.push(api.onDesktopLyricSettingChanged((nextSetting) => {
          if (subscriptionLifecycle !== lifecycle) return;
          settingGeneration += 1;
          setting.value = normalizeDesktopLyricSetting(nextSetting);
        }));
      }
      if (api?.onLyricWindowStatus) {
        unsubs.push(api.onLyricWindowStatus((status) => {
          if (subscriptionLifecycle === lifecycle) setVisible(status);
        }));
      }
    }

    const requestLifecycle = lifecycle;
    const initialSettingGeneration = settingGeneration;
    const initialVisibilityGeneration = visibilityGeneration;
    initialization = (async () => {
      try {
        const snapshot = await api?.getDesktopLyricSnapshot?.();
        if (!snapshot || requestLifecycle !== lifecycle) return;
        // 订阅先于读取；等待快照期间收到的权威事件不能被迟到快照覆盖。
        if (initialSettingGeneration === settingGeneration) {
          setting.value = normalizeDesktopLyricSetting(snapshot.setting);
        }
        if (initialVisibilityGeneration === visibilityGeneration) {
          visible.value = Boolean(snapshot.visible);
        }
      } catch (error) {
        if (requestLifecycle !== lifecycle) return;
        initialization = null;
        void api?.reportError?.(error, { scope: "desktop-lyric", action: "initialize" });
      }
    })();
    return initialization;
  }

  async function open(): Promise<void> {
    await window.electronAPI?.openLyricWindow?.();
  }

  async function close(): Promise<void> {
    await window.electronAPI?.closeLyricWindow?.();
  }

  async function toggle(): Promise<void> {
    await window.electronAPI?.toggleLyricWindow?.();
  }

  async function patchSetting(patch: DesktopLyricSettingPatch): Promise<void> {
    // contextBridge 在进入 preload 前克隆参数，必须在 renderer 先去除 Vue Proxy。
    const dto: DesktopLyricSettingPatch = JSON.parse(JSON.stringify(patch));
    window.electronAPI?.patchDesktopLyricSetting?.(dto);
  }

  function dispose(): void {
    lifecycle += 1;
    unsubs.splice(0).forEach((unsub) => unsub());
    initialization = null;
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
