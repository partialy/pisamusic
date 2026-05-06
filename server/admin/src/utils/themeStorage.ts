import { bgPresets } from "../constants/theme";

const STORAGE_KEY = "pisa-admin-theme";

export type StoredTheme = {
  themeColor: string;
  bgIndex: number;
};

const defaultTheme: StoredTheme = {
  themeColor: "#0f172a",
  bgIndex: 0,
};

function isHexColor(s: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(s);
}

export function loadTheme(): StoredTheme {
  if (typeof window === "undefined") return defaultTheme;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultTheme;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const themeColor =
      typeof o.themeColor === "string" && isHexColor(o.themeColor) ? o.themeColor : defaultTheme.themeColor;
    const bgIndex =
      typeof o.bgIndex === "number" &&
      Number.isInteger(o.bgIndex) &&
      o.bgIndex >= 0 &&
      o.bgIndex < bgPresets.length
        ? o.bgIndex
        : defaultTheme.bgIndex;
    return { themeColor, bgIndex };
  } catch {
    return defaultTheme;
  }
}

export function saveTheme(t: StoredTheme): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    /* 无痕模式或配额 */
  }
}
