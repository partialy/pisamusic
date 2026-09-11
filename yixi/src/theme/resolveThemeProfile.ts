import type {
  ActiveThemeStyle,
  BackgroundMode,
  ResolveThemeProfileInput,
  ResolvedColorScheme,
  ThemeRuntimeProfile,
} from "./types";

export function resolveThemeProfile(input: ResolveThemeProfileInput): ThemeRuntimeProfile {
  const backgroundMode: BackgroundMode = input.backgroundMode === "image" ? "image" : "color";

  let colorScheme: ResolvedColorScheme;
  if (input.mode === "system") {
    colorScheme = input.systemDark ? "dark" : "light";
  } else if (input.mode === "dark") {
    colorScheme = "dark";
  } else {
    colorScheme = "light";
  }

  let activeStyle: ActiveThemeStyle;
  let surfaceScheme: "light" | "dark";

  if (backgroundMode === "image") {
    activeStyle = "image";
    surfaceScheme = "dark";
  } else {
    activeStyle = colorScheme === "dark" ? "color-dark" : "color-light";
    surfaceScheme = colorScheme;
  }

  return {
    backgroundMode,
    colorScheme,
    activeStyle,
    surfaceScheme,
  };
}
