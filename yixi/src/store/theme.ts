import electronAPI from "@/utils/electron";
import {
  darkTheme,
  lightTheme,
  type GlobalTheme,
  type GlobalThemeOverrides,
} from "naive-ui";
import { computed, ref } from "vue";
import { defineStore } from "pinia";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedThemeMode = "light" | "dark";

export type AppThemeSetting = {
  mode: ThemeMode;
  accentColor: string;
};

const THEME_SETTING_KEY = "app-theme";
const DEFAULT_ACCENT_COLOR = "#2897ff";
const DEFAULT_THEME: AppThemeSetting = {
  mode: "light",
  accentColor: DEFAULT_ACCENT_COLOR,
};

export const useThemeStore = defineStore("theme", () => {
  const mode = ref<ThemeMode>(DEFAULT_THEME.mode);
  const accentColor = ref(DEFAULT_THEME.accentColor);
  const systemDark = ref(false);
  const initialized = ref(false);
  let mediaQuery: MediaQueryList | null = null;

  const resolvedMode = computed<ResolvedThemeMode>(() => {
    if (mode.value === "system") return systemDark.value ? "dark" : "light";
    return mode.value;
  });

  const naiveTheme = computed<GlobalTheme | null>(() =>
    resolvedMode.value === "dark" ? darkTheme : lightTheme
  );

  const naiveThemeOverrides = computed<GlobalThemeOverrides>(() => {
    const color = normalizeHexColor(accentColor.value, DEFAULT_ACCENT_COLOR);
    return {
      common: {
        primaryColor: color,
        primaryColorHover: mixColor(color, "#ffffff", 0.18),
        primaryColorPressed: mixColor(color, "#000000", 0.16),
        primaryColorSuppl: mixColor(color, "#ffffff", 0.1),
      },
      Menu: {
        borderRadius: '16px'
      }
    };
  });

  async function init() {
    if (initialized.value) return;
    initialized.value = true;
    setupSystemListener();

    const savedTheme = await electronAPI.getSetting<AppThemeSetting>(THEME_SETTING_KEY);
    const migratedTheme = savedTheme?.value ?? getLegacyTheme();
    applyTheme(migratedTheme);

    if (!savedTheme && migratedTheme) {
      await persist();
    }
  }

  async function setMode(nextMode: ThemeMode) {
    mode.value = nextMode;
    applyRuntimeTheme();
    await persist();
  }

  async function setAccentColor(nextColor: string) {
    accentColor.value = normalizeHexColor(nextColor, DEFAULT_ACCENT_COLOR);
    applyRuntimeTheme();
    await persist();
  }

  async function resetAccentColor() {
    await setAccentColor(DEFAULT_ACCENT_COLOR);
  }

  async function toggleLightDark() {
    await setMode(resolvedMode.value === "dark" ? "light" : "dark");
  }

  function applyTheme(theme?: Partial<AppThemeSetting> | null) {
    mode.value = isThemeMode(theme?.mode) ? theme.mode : DEFAULT_THEME.mode;
    accentColor.value = normalizeHexColor(theme?.accentColor, DEFAULT_ACCENT_COLOR);
    applyRuntimeTheme();
  }

  function applyRuntimeTheme() {
    const root = document.documentElement;
    const color = normalizeHexColor(accentColor.value, DEFAULT_ACCENT_COLOR);
    root.dataset.theme = resolvedMode.value;
    root.style.setProperty("--color-primary", color);
    root.style.setProperty("--color-text-primary", color);
    root.style.setProperty("--color-primary-hover", mixColor(color, "#ffffff", 0.18));
    root.style.setProperty("--color-text-primary-hover", mixColor(color, "#000000", 0.16));
  }

  async function persist() {
    await electronAPI.setSetting(THEME_SETTING_KEY, {
      mode: mode.value,
      accentColor: normalizeHexColor(accentColor.value, DEFAULT_ACCENT_COLOR),
    }, 1);
  }

  function setupSystemListener() {
    if (!window.matchMedia) return;
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemDark.value = mediaQuery.matches;
    mediaQuery.addEventListener("change", handleSystemThemeChange);
  }

  function dispose() {
    mediaQuery?.removeEventListener("change", handleSystemThemeChange);
    mediaQuery = null;
  }

  function handleSystemThemeChange(event: MediaQueryListEvent) {
    systemDark.value = event.matches;
    applyRuntimeTheme();
  }

  function getLegacyTheme(): AppThemeSetting | null {
    const oldPisaTheme = localStorage.getItem("pisa-theme");
    const oldHeaderTheme = localStorage.getItem("theme");
    if (oldPisaTheme === "dark" || oldHeaderTheme === "night") {
      return { ...DEFAULT_THEME, mode: "dark" };
    }
    if (oldPisaTheme === "light" || oldHeaderTheme === "light") {
      return { ...DEFAULT_THEME, mode: "light" };
    }
    return null;
  }

  return {
    mode,
    accentColor,
    resolvedMode,
    naiveTheme,
    naiveThemeOverrides,
    init,
    setMode,
    setAccentColor,
    resetAccentColor,
    toggleLightDark,
    dispose,
  };
});

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
}

function mixColor(baseColor: string, mixWith: string, weight: number) {
  const base = hexToRgb(baseColor);
  const mix = hexToRgb(mixWith);
  const ratio = Math.min(Math.max(weight, 0), 1);
  return rgbToHex({
    r: Math.round(base.r * (1 - ratio) + mix.r * ratio),
    g: Math.round(base.g * (1 - ratio) + mix.g * ratio),
    b: Math.round(base.b * (1 - ratio) + mix.b * ratio),
  });
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex, DEFAULT_ACCENT_COLOR).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(color: { r: number; g: number; b: number }) {
  return `#${[color.r, color.g, color.b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}
