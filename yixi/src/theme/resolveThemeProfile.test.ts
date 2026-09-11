import { describe, expect, it } from "vitest";
import { resolveThemeProfile } from "./resolveThemeProfile";

describe("resolveThemeProfile", () => {
  it("resolves color-light when backgroundMode is color and mode is light", () => {
    const profile = resolveThemeProfile({
      mode: "light",
      systemDark: false,
      backgroundMode: "color",
    });

    expect(profile).toEqual({
      backgroundMode: "color",
      colorScheme: "light",
      activeStyle: "color-light",
      surfaceScheme: "light",
    });
  });

  it("resolves color-dark when backgroundMode is color and mode is dark", () => {
    const profile = resolveThemeProfile({
      mode: "dark",
      systemDark: false,
      backgroundMode: "color",
    });

    expect(profile).toEqual({
      backgroundMode: "color",
      colorScheme: "dark",
      activeStyle: "color-dark",
      surfaceScheme: "dark",
    });
  });

  it("follows systemDark when backgroundMode is color and mode is system", () => {
    const profileDark = resolveThemeProfile({
      mode: "system",
      systemDark: true,
      backgroundMode: "color",
    });

    expect(profileDark).toEqual({
      backgroundMode: "color",
      colorScheme: "dark",
      activeStyle: "color-dark",
      surfaceScheme: "dark",
    });

    const profileLight = resolveThemeProfile({
      mode: "system",
      systemDark: false,
      backgroundMode: "color",
    });

    expect(profileLight).toEqual({
      backgroundMode: "color",
      colorScheme: "light",
      activeStyle: "color-light",
      surfaceScheme: "light",
    });
  });

  it("resolves image style with dark surfaceScheme when backgroundMode is image, preserving colorScheme preference", () => {
    const profileFromLight = resolveThemeProfile({
      mode: "light",
      systemDark: false,
      backgroundMode: "image",
    });

    expect(profileFromLight).toEqual({
      backgroundMode: "image",
      colorScheme: "light",
      activeStyle: "image",
      surfaceScheme: "dark",
    });

    const profileFromDark = resolveThemeProfile({
      mode: "dark",
      systemDark: false,
      backgroundMode: "image",
    });

    expect(profileFromDark).toEqual({
      backgroundMode: "image",
      colorScheme: "dark",
      activeStyle: "image",
      surfaceScheme: "dark",
    });
  });

  it("defaults to color backgroundMode when backgroundMode is omitted or null", () => {
    const profile = resolveThemeProfile({
      mode: "light",
      systemDark: false,
      backgroundMode: null,
    });

    expect(profile.backgroundMode).toBe("color");
    expect(profile.activeStyle).toBe("color-light");
  });
});
