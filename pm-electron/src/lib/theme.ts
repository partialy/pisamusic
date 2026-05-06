import type { AppThemeSettings, ThemeMode } from "@shared/settings";
import { DEFAULT_THEME_SETTINGS } from "@shared/settings";

const PISA_LIGHT = {
  background: "216 33% 97%",
  foreground: "217 32% 15%",
  card: "0 0% 100%",
  cardForeground: "217 32% 15%",
  popover: "0 0% 100%",
  popoverForeground: "217 32% 15%",
  primary: "202 92% 64%",
  primaryForeground: "210 100% 98%",
  secondary: "210 40% 96%",
  secondaryForeground: "215 28% 22%",
  muted: "216 32% 94%",
  mutedForeground: "216 12% 48%",
  accent: "204 86% 94%",
  accentForeground: "207 72% 28%",
  destructive: "350 84% 65%",
  destructiveForeground: "0 0% 100%",
  border: "216 28% 90%",
  input: "216 28% 90%",
  ring: "202 92% 64%",
  sidebar: "0 0% 100%",
  sidebarForeground: "217 32% 15%",
  playerSurface: "0 0% 100%",
  playerAccent: "202 92% 64%",
  playerProgress: "202 90% 52%",
};

const PISA_DARK = {
  background: "215 48% 9%",
  foreground: "204 100% 96%",
  card: "214 42% 13%",
  cardForeground: "204 100% 96%",
  popover: "214 42% 13%",
  popoverForeground: "204 100% 96%",
  primary: "203 100% 68%",
  primaryForeground: "215 48% 9%",
  secondary: "213 35% 18%",
  secondaryForeground: "204 100% 92%",
  muted: "214 32% 18%",
  mutedForeground: "209 24% 70%",
  accent: "201 74% 22%",
  accentForeground: "204 100% 94%",
  destructive: "350 74% 62%",
  destructiveForeground: "0 0% 100%",
  border: "213 28% 24%",
  input: "213 28% 24%",
  ring: "203 100% 68%",
  sidebar: "216 47% 11%",
  sidebarForeground: "204 100% 96%",
  playerSurface: "214 42% 13%",
  playerAccent: "203 100% 68%",
  playerProgress: "203 100% 62%",
};

export function applyTheme(settings: AppThemeSettings = DEFAULT_THEME_SETTINGS): void {
  const root = document.documentElement;
  const mode = resolveMode(settings.mode);
  root.classList.toggle("dark", mode === "dark");
  const tokens = mode === "dark" ? PISA_DARK : PISA_LIGHT;
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(cssVarName(key), value);
  });
  root.style.setProperty("--radius", `${settings.radius}px`);
  if (settings.preset === "custom" && settings.primaryColor) {
    root.style.setProperty("--pisa-custom-primary", settings.primaryColor);
  }
}

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function cssVarName(key: string): string {
  return `--${key.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`;
}
