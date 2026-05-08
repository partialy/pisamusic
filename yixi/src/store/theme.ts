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
export type GradientDirection = "to bottom" | "to right" | "135deg" | "45deg";

export type AppThemeSetting = {
  mode: ThemeMode;
  accentColor: string;
  autoBackground: boolean;
  gradientDirection: GradientDirection;
  gradientColors: string[];
};

const THEME_SETTING_KEY = "app-theme";
const DEFAULT_ACCENT_COLOR = "#2897ff";
const DEFAULT_GRADIENT_DIRECTION: GradientDirection = "to bottom";
const MAX_GRADIENT_COLOR_COUNT = 5;
const DEFAULT_LIGHT_GRADIENT_COLORS = ["#edf4ff", "#f7fbff", "#f5f5f5"];
const DEFAULT_DARK_GRADIENT_COLORS = ["#121826", "#151b2b", "#10131d"];
const DEFAULT_THEME: AppThemeSetting = {
  mode: "light",
  accentColor: DEFAULT_ACCENT_COLOR,
  autoBackground: false,
  gradientDirection: DEFAULT_GRADIENT_DIRECTION,
  gradientColors: DEFAULT_LIGHT_GRADIENT_COLORS,
};

export const useThemeStore = defineStore("theme", () => {
  const mode = ref<ThemeMode>(DEFAULT_THEME.mode);
  const accentColor = ref(DEFAULT_THEME.accentColor);
  const autoBackground = ref(DEFAULT_THEME.autoBackground);
  const gradientDirection = ref<GradientDirection>(DEFAULT_THEME.gradientDirection);
  const gradientColors = ref<string[]>([...DEFAULT_THEME.gradientColors]);
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
      },
      Progress: {
        railColor: getRuntimeGradientColors()[0],
        fillColor: color
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

  async function setAutoBackground(enabled: boolean) {
    autoBackground.value = enabled;
    applyRuntimeTheme();
    await persist();
  }

  async function setGradientDirection(direction: GradientDirection) {
    gradientDirection.value = isGradientDirection(direction)
      ? direction
      : DEFAULT_GRADIENT_DIRECTION;
    applyRuntimeTheme();
    await persist();
  }

  async function setGradientColor(index: number, nextColor: string) {
    if (index < 0 || index >= gradientColors.value.length) return;
    const colors = [...gradientColors.value];
    colors[index] = normalizeHexColor(nextColor, colors[index] ?? DEFAULT_ACCENT_COLOR);
    gradientColors.value = normalizeGradientColors(colors, resolvedMode.value);
    applyRuntimeTheme();
    await persist();
  }

  async function addGradientColor() {
    if (gradientColors.value.length >= MAX_GRADIENT_COLOR_COUNT) return;
    const colors = [...gradientColors.value];
    colors.push(colors[colors.length - 1] ?? accentColor.value);
    gradientColors.value = normalizeGradientColors(colors, resolvedMode.value);
    applyRuntimeTheme();
    await persist();
  }

  async function removeGradientColor(index: number) {
    if (gradientColors.value.length <= 2) return;
    gradientColors.value = normalizeGradientColors(
      gradientColors.value.filter((_, colorIndex) => colorIndex !== index),
      resolvedMode.value
    );
    applyRuntimeTheme();
    await persist();
  }

  async function resetBackground() {
    autoBackground.value = false;
    gradientDirection.value = DEFAULT_GRADIENT_DIRECTION;
    gradientColors.value = getDefaultGradientColors(resolvedMode.value);
    applyRuntimeTheme();
    await persist();
  }

  async function toggleLightDark() {
    await setMode(resolvedMode.value === "dark" ? "light" : "dark");
  }

  function applyTheme(theme?: Partial<AppThemeSetting> | null) {
    mode.value = isThemeMode(theme?.mode) ? theme.mode : DEFAULT_THEME.mode;
    accentColor.value = normalizeHexColor(theme?.accentColor, DEFAULT_ACCENT_COLOR);
    autoBackground.value =
      typeof theme?.autoBackground === "boolean"
        ? theme.autoBackground
        : DEFAULT_THEME.autoBackground;
    gradientDirection.value = isGradientDirection(theme?.gradientDirection)
      ? theme.gradientDirection
      : DEFAULT_GRADIENT_DIRECTION;
    gradientColors.value = normalizeGradientColors(theme?.gradientColors, resolvedMode.value);
    applyRuntimeTheme();
  }

  function applyRuntimeTheme() {
    const root = document.documentElement;
    const color = normalizeHexColor(accentColor.value, DEFAULT_ACCENT_COLOR);
    const bgColors = getRuntimeGradientColors();
    root.dataset.theme = resolvedMode.value;
    root.style.setProperty("--color-primary", color);
    root.style.setProperty("--color-text-primary", color);
    root.style.setProperty("--color-primary-hover", mixColor(color, "#ffffff", 0.18));
    root.style.setProperty("--color-text-primary-hover", mixColor(color, "#000000", 0.16));
    root.style.setProperty(
      "--color-bg-track",
      `linear-gradient(${gradientDirection.value}, ${bgColors.join(", ")})`
    );
  }

  async function persist() {
    await electronAPI.setSetting(THEME_SETTING_KEY, {
      mode: mode.value,
      accentColor: normalizeHexColor(accentColor.value, DEFAULT_ACCENT_COLOR),
      autoBackground: autoBackground.value,
      gradientDirection: gradientDirection.value,
      gradientColors: normalizeGradientColors(gradientColors.value, resolvedMode.value),
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

  function getRuntimeGradientColors() {
    if (autoBackground.value) {
      return generateGradientColors(accentColor.value, resolvedMode.value);
    }
    return normalizeGradientColors(gradientColors.value, resolvedMode.value);
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
    autoBackground,
    gradientDirection,
    gradientColors,
    resolvedMode,
    naiveTheme,
    naiveThemeOverrides,
    init,
    setMode,
    setAccentColor,
    resetAccentColor,
    setAutoBackground,
    setGradientDirection,
    setGradientColor,
    addGradientColor,
    removeGradientColor,
    resetBackground,
    toggleLightDark,
    dispose,
  };
});

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function isGradientDirection(value: unknown): value is GradientDirection {
  return value === "to bottom" || value === "to right" || value === "135deg" || value === "45deg";
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

function generateGradientColors(color: string, mode: ResolvedThemeMode) {
  const normalized = normalizeHexColor(color, DEFAULT_ACCENT_COLOR);
  if (mode === "dark") {
    return [
      mixColor(normalized, "#101826", 0.72),
      mixColor(normalized, "#151b2b", 0.82),
      mixColor(normalized, "#10131d", 0.9),
    ];
  }
  return [
    mixColor(normalized, "#ffffff", 0.82),
    mixColor(normalized, "#ffffff", 0.92),
    mixColor(normalized, "#f5f5f5", 0.96),
  ];
}

function normalizeGradientColors(value: unknown, mode: ResolvedThemeMode) {
  const source = Array.isArray(value) && value.length > 0 ? value : getDefaultGradientColors(mode);
  const colors = source
    .slice(0, MAX_GRADIENT_COLOR_COUNT)
    .map((color) => normalizeHexColor(color, ""))
    .filter(Boolean);
  const fallback = getDefaultGradientColors(mode);
  const normalized = colors.length >= 2 ? colors : fallback;
  return normalized.map((color) => normalizeHexColor(color, DEFAULT_ACCENT_COLOR));
}

function getDefaultGradientColors(mode: ResolvedThemeMode) {
  return mode === "dark"
    ? [...DEFAULT_DARK_GRADIENT_COLORS]
    : [...DEFAULT_LIGHT_GRADIENT_COLORS];
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
