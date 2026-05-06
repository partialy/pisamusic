import type { AppThemeSettings, ThemeMode } from "@shared/settings";
import { DEFAULT_THEME_SETTINGS } from "@shared/settings";

const PISA_LIGHT = {
  background: "210 70% 98%",
  foreground: "215 27% 17%",
  card: "0 0% 100%",
  cardForeground: "215 27% 17%",
  popover: "0 0% 100%",
  popoverForeground: "215 27% 17%",
  primary: "207 100% 55%",
  primaryForeground: "210 100% 98%",
  secondary: "210 78% 96%",
  secondaryForeground: "215 26% 23%",
  muted: "212 62% 94%",
  mutedForeground: "214 11% 45%",
  accent: "208 100% 93%",
  accentForeground: "207 90% 35%",
  destructive: "350 84% 65%",
  destructiveForeground: "0 0% 100%",
  border: "211 48% 89%",
  input: "211 48% 88%",
  ring: "207 100% 55%",
  sidebar: "212 100% 96%",
  sidebarForeground: "215 27% 17%",
  playerSurface: "0 0% 100%",
  playerAccent: "207 100% 55%",
  playerProgress: "207 100% 50%",
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
