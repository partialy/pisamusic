export type BackgroundMode = "color" | "image";
export type ResolvedColorScheme = "light" | "dark";
export type ActiveThemeStyle = "color-light" | "color-dark" | "image";

export interface ThemeRuntimeProfile {
  backgroundMode: BackgroundMode;
  colorScheme: ResolvedColorScheme;
  activeStyle: ActiveThemeStyle;
  surfaceScheme: "light" | "dark";
}

export interface ResolveThemeProfileInput {
  mode: "light" | "dark" | "system";
  systemDark: boolean;
  backgroundMode?: BackgroundMode | null;
}
