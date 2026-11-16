import { defineStore } from "pinia";

export interface PlayerBarLyricSetting {
  enabled: boolean;
  showWhenPaused: boolean;
  sourceMode: "follow" | "word" | "line";
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  opacity: number;
  followTheme: boolean;
  textColor: string;
  highlightColor: string;
}

export const PLAYER_BAR_LYRIC_LIMITS = { minFontSize: 10, maxFontSize: 22 } as const;
export const defaultPlayerBarLyricSetting = (): PlayerBarLyricSetting => ({
  enabled: true, showWhenPaused: false, sourceMode: "follow", fontSize: 16,
  fontFamily: "follow", bold: false, opacity: 1, followTheme: true,
  textColor: "#9ca3af", highlightColor: "#2897ff",
});
const STORAGE_KEY = "pisa-playerbar-lyric-setting";

function normalize(input: unknown): PlayerBarLyricSetting {
  const value = defaultPlayerBarLyricSetting();
  if (!input || typeof input !== "object") return value;
  const raw = input as Record<string, unknown>;
  for (const key of ["enabled", "showWhenPaused", "bold", "followTheme"] as const) {
    if (typeof raw[key] === "boolean") value[key] = raw[key];
  }
  for (const key of ["fontFamily", "textColor", "highlightColor"] as const) {
    if (typeof raw[key] === "string" && raw[key].trim()) value[key] = raw[key];
  }
  if (raw.sourceMode === "follow" || raw.sourceMode === "word" || raw.sourceMode === "line") value.sourceMode = raw.sourceMode;
  if (typeof raw.fontSize === "number" && Number.isFinite(raw.fontSize)) {
    value.fontSize = Math.max(PLAYER_BAR_LYRIC_LIMITS.minFontSize, Math.min(PLAYER_BAR_LYRIC_LIMITS.maxFontSize, Math.round(raw.fontSize)));
  }
  if (typeof raw.opacity === "number" && Number.isFinite(raw.opacity)) value.opacity = Math.max(0.01, Math.min(1, raw.opacity));
  return value;
}

function loadSetting() {
  try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); }
  catch { return defaultPlayerBarLyricSetting(); }
}

export const usePlayerBarLyricStore = defineStore("playerBarLyric", {
  state: () => ({ setting: loadSetting() }),
  actions: {
    updateSetting(patch: Partial<PlayerBarLyricSetting>) {
      this.setting = normalize({ ...this.setting, ...patch });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.setting));
    },
    resetSetting() { this.updateSetting(defaultPlayerBarLyricSetting()); },
  },
});
