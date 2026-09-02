import { defineStore } from "pinia";
import { ref } from "vue";
import {

  equalizerService,
  EQUALIZER_FREQUENCIES,
  BAND_COUNT,
} from "@/utils/equalizerService";

export interface EqualizerPreset {
  key: string;
  name: string;
  preamp: number;
  gains: number[];
}

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  {
    key: "flat",
    name: "平坦",
    preamp: 0,
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    key: "pop",
    name: "流行",
    preamp: -1.0,
    gains: [-1.5, -1.0, 0, 2.0, 4.0, 4.0, 2.5, 1.0, 0, -1.0],
  },
  {
    key: "rock",
    name: "摇滚",
    preamp: -2.0,
    gains: [4.5, 3.5, 2.0, 0.5, -1.0, -0.5, 2.0, 3.5, 4.5, 4.5],
  },
  {
    key: "classical",
    name: "古典",
    preamp: -1.5,
    gains: [4.0, 3.0, 2.5, 2.0, -1.0, -1.0, 0, 2.0, 3.0, 3.5],
  },
  {
    key: "jazz",
    name: "爵士",
    preamp: -1.0,
    gains: [3.0, 2.0, 1.0, 2.0, -1.5, -1.5, 0, 1.5, 2.5, 3.0],
  },
  {
    key: "electronic",
    name: "电子",
    preamp: -2.5,
    gains: [5.5, 4.5, 2.0, 0, -1.5, 2.0, 3.0, 4.0, 4.5, 3.5],
  },
  {
    key: "vocal",
    name: "人声",
    preamp: -1.0,
    gains: [-2.0, -2.0, -1.0, 1.5, 3.5, 4.0, 3.5, 2.0, 0, -1.5],
  },
  {
    key: "bass",
    name: "重低音",
    preamp: -3.0,
    gains: [6.0, 5.0, 4.0, 2.5, 1.0, 0, 0, 0, 0, 0],
  },
  {
    key: "treble",
    name: "清脆高音",
    preamp: -2.0,
    gains: [0, 0, 0, 0, 0, 1.0, 2.5, 4.0, 5.5, 6.0],
  },
  {
    key: "acoustic",
    name: "民谣原声",
    preamp: -1.5,
    gains: [3.5, 2.5, 1.5, 1.0, 1.5, 2.0, 3.0, 2.5, 2.0, 1.5],
  },
];

const STORAGE_KEY = "pisa_equalizer_settings";

interface PersistedEqualizerState {
  enabled: boolean;
  preamp: number;
  gains: number[];
  presetKey: string;
}

function loadPersistedState(): PersistedEqualizerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.enabled === "boolean" &&
        typeof parsed.preamp === "number" &&
        Array.isArray(parsed.gains) &&
        parsed.gains.length === BAND_COUNT
      ) {
        return {
          enabled: parsed.enabled,
          preamp: Math.max(-12, Math.min(12, parsed.preamp)),
          gains: parsed.gains.map((g: any) =>
            typeof g === "number" ? Math.max(-12, Math.min(12, g)) : 0,
          ),
          presetKey: parsed.presetKey || "custom",
        };
      }
    }
  } catch (err) {
    console.warn("[useEqualizerStore] 加载持久化配置失败:", err);
  }
  return {
    enabled: false,
    preamp: 0,
    gains: new Array(BAND_COUNT).fill(0),
    presetKey: "flat",
  };
}

export const useEqualizerStore = defineStore("equalizer", () => {
  const initial = loadPersistedState();

  const enabled = ref(initial.enabled);
  const preamp = ref(initial.preamp);
  const gains = ref<number[]>([...initial.gains]);
  const currentPresetKey = ref<string>(initial.presetKey);
  const showModal = ref(false);

  // 初始化时同步到 Web Audio 核心服务
  equalizerService.setEnabled(enabled.value);
  equalizerService.setGains(gains.value, preamp.value);

  // 持久化存储
  const saveToStorage = () => {
    try {
      const payload: PersistedEqualizerState = {
        enabled: enabled.value,
        preamp: preamp.value,
        gains: gains.value,
        presetKey: currentPresetKey.value,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("[useEqualizerStore] 保存持久化配置失败:", err);
    }
  };

  const setEnabled = (val: boolean) => {
    enabled.value = val;
    equalizerService.setEnabled(val);
    saveToStorage();
  };

  const toggleEnabled = () => {
    setEnabled(!enabled.value);
  };

  const setPreampGain = (val: number) => {
    const clamped = Math.max(-12, Math.min(12, Math.round(val * 10) / 10));
    preamp.value = clamped;
    equalizerService.setPreamp(clamped);
    currentPresetKey.value = "custom";
    saveToStorage();
  };

  const setBandGain = (index: number, val: number) => {
    if (index < 0 || index >= BAND_COUNT) return;
    const clamped = Math.max(-12, Math.min(12, Math.round(val * 10) / 10));
    gains.value[index] = clamped;
    equalizerService.setGain(index, clamped);
    currentPresetKey.value = "custom";
    saveToStorage();
  };

  const applyPreset = (presetKey: string) => {
    const preset = EQUALIZER_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    currentPresetKey.value = preset.key;
    preamp.value = preset.preamp;
    gains.value = [...preset.gains];
    equalizerService.setGains(gains.value, preamp.value);
    saveToStorage();
  };

  const reset = () => {
    applyPreset("flat");
  };

  const openModal = () => {
    showModal.value = true;
  };

  const closeModal = () => {
    showModal.value = false;
  };

  return {
    frequencies: EQUALIZER_FREQUENCIES,
    presets: EQUALIZER_PRESETS,
    enabled,
    preamp,
    gains,
    currentPresetKey,
    showModal,
    setEnabled,
    toggleEnabled,
    setPreampGain,
    setBandGain,
    applyPreset,
    reset,
    openModal,
    closeModal,
  };
});
