import { darkTheme, lightTheme, type GlobalTheme, type GlobalThemeOverrides } from "naive-ui";
import type { ThemeRuntimeProfile } from "./types";

export function resolveNaiveTheme(profile: ThemeRuntimeProfile): GlobalTheme | null {
  return profile.surfaceScheme === "dark" ? darkTheme : lightTheme;
}

export function createNaiveThemeOverrides(
  profile: ThemeRuntimeProfile,
  accentColor: string,
  trackColors: string[]
): GlobalThemeOverrides {
  const isImage = profile.backgroundMode === "image";
  const isDark = profile.surfaceScheme === "dark";
  const railColor = trackColors[0] || (isDark ? "#1e293b" : "#edf4ff");

  const commonOverrides: NonNullable<GlobalThemeOverrides["common"]> = {
    primaryColor: accentColor,
    primaryColorHover: mixColor(accentColor, "#ffffff", 0.18),
    primaryColorPressed: mixColor(accentColor, "#000000", 0.16),
    primaryColorSuppl: mixColor(accentColor, "#ffffff", 0.1),
  };

  if (isImage) {
    // 图片模式下 Naive UI 组件的半透明中性毛玻璃覆写
    if (isDark) {
      commonOverrides.popoverColor = "rgba(24, 30, 44, 0.92)";
      commonOverrides.cardColor = "rgba(20, 26, 38, 0.55)";
      commonOverrides.modalColor = "rgba(26, 32, 44, 0.92)";
      commonOverrides.bodyColor = "transparent";
      commonOverrides.borderColor = "rgba(255, 255, 255, 0.12)";
    } else {
      commonOverrides.popoverColor = "rgba(255, 255, 255, 0.94)";
      commonOverrides.cardColor = "rgba(255, 255, 255, 0.65)";
      commonOverrides.modalColor = "rgba(255, 255, 255, 0.94)";
      commonOverrides.bodyColor = "transparent";
      commonOverrides.borderColor = "rgba(0, 0, 0, 0.10)";
    }
  }

  const overrides: GlobalThemeOverrides = {
    common: commonOverrides,
    Menu: {
      borderRadius: "16px",
    },
    Progress: {
      railColor: isImage ? (isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.12)") : railColor,
      fillColor: accentColor,
    },
  };

  if (isImage) {
    if (isDark) {
      overrides.Card = {
        color: "rgba(20, 26, 38, 0.55)",
        borderColor: "rgba(255, 255, 255, 0.10)",
      };
      overrides.Modal = {
        color: "rgba(26, 32, 44, 0.92)",
        borderColor: "rgba(255, 255, 255, 0.14)",
      };
      overrides.Input = {
        color: "rgba(255, 255, 255, 0.08)",
        colorFocus: "rgba(255, 255, 255, 0.12)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderHover: "1px solid rgba(255, 255, 255, 0.24)",
        borderFocus: `1px solid ${accentColor}`,
      };
      overrides.Dropdown = {
        color: "rgba(24, 30, 44, 0.94)",
      };
    } else {
      overrides.Card = {
        color: "rgba(255, 255, 255, 0.65)",
        borderColor: "rgba(0, 0, 0, 0.08)",
      };
      overrides.Modal = {
        color: "rgba(255, 255, 255, 0.94)",
        borderColor: "rgba(0, 0, 0, 0.10)",
      };
      overrides.Input = {
        color: "rgba(255, 255, 255, 0.70)",
        colorFocus: "rgba(255, 255, 255, 0.85)",
        border: "1px solid rgba(0, 0, 0, 0.12)",
        borderHover: "1px solid rgba(0, 0, 0, 0.24)",
        borderFocus: `1px solid ${accentColor}`,
      };
      overrides.Dropdown = {
        color: "rgba(255, 255, 255, 0.96)",
      };
    }
  }

  return overrides;
}

function mixColor(color1: string, color2: string, weight: number): string {
  const w = Math.max(0, Math.min(1, weight));
  const c1 = parseHex(color1);
  const c2 = parseHex(color2);
  const r = Math.round(c1.r * (1 - w) + c2.r * w);
  const g = Math.round(c1.g * (1 - w) + c2.g * w);
  const b = Math.round(c1.b * (1 - w) + c2.b * w);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}
