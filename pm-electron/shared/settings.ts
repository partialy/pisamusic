export type ThemeMode = "light" | "dark" | "system";
export type ThemePreset = "pisa-blue" | "custom";

export interface AppThemeSettings {
  version: 1;
  mode: ThemeMode;
  preset: ThemePreset;
  primaryColor: string;
  radius: number;
  useAlbumAccent: boolean;
}

export interface AppSettings {
  version: 1;
  volume: number;
  lastRoute: string;
  theme: AppThemeSettings;
}

export const DEFAULT_THEME_SETTINGS: AppThemeSettings = {
  version: 1,
  mode: "system",
  preset: "pisa-blue",
  primaryColor: "#1A8CFF",
  radius: 12,
  useAlbumAccent: false,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  version: 1,
  volume: 0.8,
  lastRoute: "search",
  theme: DEFAULT_THEME_SETTINGS,
};
