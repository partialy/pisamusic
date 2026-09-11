export type BackgroundMode = "color" | "image";
export type ResolvedColorScheme = "light" | "dark";
export type ImageTone = "light" | "dark";
export type GradientDirection = "to bottom" | "to right" | "135deg" | "45deg";
export type ActiveThemeStyle = "color-light" | "color-dark" | "image-light" | "image-dark";

export interface ThemeRuntimeProfile {
  backgroundMode: BackgroundMode;
  colorScheme: ResolvedColorScheme;
  activeStyle: ActiveThemeStyle;
  surfaceScheme: "light" | "dark";
  imageTone: ImageTone;
}

export interface ResolveThemeProfileInput {
  mode: "light" | "dark" | "system";
  systemDark: boolean;
  backgroundMode?: BackgroundMode | null;
  imageIsDark?: boolean;
}
