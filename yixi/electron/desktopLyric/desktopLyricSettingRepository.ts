import { normalizeDesktopLyricSetting } from "../../src/desktopLyric/desktopLyricDefaults";
import type { DesktopLyricBounds, DesktopLyricSettingV2 } from "../../src/types/desktopLyric";
import { getAppDatabase } from "../database";
import { appStore } from "../store";

export const DESKTOP_LYRIC_SETTING_KEY = "desktop-lyric-setting";
export const DESKTOP_LYRIC_SETTING_VERSION = 2;

export interface DesktopLyricSettingRepository {
  read(): DesktopLyricSettingV2;
  patch(patch: Partial<DesktopLyricSettingV2>): DesktopLyricSettingV2;
  saveBounds(bounds: DesktopLyricBounds): DesktopLyricSettingV2;
}

export interface DesktopLyricSettingRepositoryDeps {
  getSqliteSetting<T>(key: string): { value: T; version: number } | null;
  setSqliteSetting<T>(key: string, value: T, version: number): void;
  readLegacyLyricConfig(): Record<string, unknown> | null;
}

function parseLegacyOrPartial(raw: Record<string, unknown>): Partial<DesktopLyricSettingV2> {
  const result: Partial<DesktopLyricSettingV2> = {};

  if (typeof raw.desktop === "boolean") {
    result.enabled = raw.desktop;
  } else if (typeof raw.enabled === "boolean") {
    result.enabled = raw.enabled;
  }

  if (typeof raw.locked === "boolean") result.locked = raw.locked;
  if (typeof raw.overlayTaskbar === "boolean") result.overlayTaskbar = raw.overlayTaskbar;
  if (typeof raw.fontSize === "number") result.fontSize = raw.fontSize;
  if (typeof raw.fontFamily === "string") result.fontFamily = raw.fontFamily;
  if (typeof raw.textColor === "string") result.textColor = raw.textColor;
  if (typeof raw.highlightColor === "string") result.highlightColor = raw.highlightColor;
  if (typeof raw.animationEnabled === "boolean") result.animationEnabled = raw.animationEnabled;
  if (typeof raw.wordScaleEnabled === "boolean") result.wordScaleEnabled = raw.wordScaleEnabled;
  if (typeof raw.autoOutline === "boolean") result.autoOutline = raw.autoOutline;

  if (typeof raw.fontWeight === "number") {
    result.fontWeight = raw.fontWeight;
  } else if (typeof raw.fontWeight === "string") {
    const parsed = parseInt(raw.fontWeight, 10);
    if (!Number.isNaN(parsed)) result.fontWeight = parsed;
  }

  if (raw.bounds && typeof raw.bounds === "object") {
    result.bounds = raw.bounds as DesktopLyricBounds;
  } else {
    const x = typeof raw.x === "number" ? raw.x : null;
    const y = typeof raw.y === "number" ? raw.y : null;
    const width = typeof raw.width === "number" ? raw.width : 800;
    const height = typeof raw.height === "number" ? raw.height : 120;
    if (
      raw.width !== undefined ||
      raw.height !== undefined ||
      raw.x !== undefined ||
      raw.y !== undefined
    ) {
      result.bounds = { x, y, width, height };
    }
  }

  return result;
}

export function createDesktopLyricSettingRepository(
  deps: DesktopLyricSettingRepositoryDeps,
): DesktopLyricSettingRepository {
  return {
    read(): DesktopLyricSettingV2 {
      const record = deps.getSqliteSetting<unknown>(DESKTOP_LYRIC_SETTING_KEY);
      if (record && record.value && typeof record.value === "object") {
        const val = record.value as Record<string, unknown>;
        if (
          record.version === DESKTOP_LYRIC_SETTING_VERSION &&
          val.bounds &&
          typeof val.bounds === "object"
        ) {
          return normalizeDesktopLyricSetting(val);
        }

        const parsed = parseLegacyOrPartial(val);
        if (parsed.enabled === undefined) {
          const legacyDesktop = deps.getSqliteSetting<boolean>("lyricConfig.desktop")?.value;
          if (typeof legacyDesktop === "boolean") {
            parsed.enabled = legacyDesktop;
          }
        }
        const normalized = normalizeDesktopLyricSetting(parsed);
        deps.setSqliteSetting(
          DESKTOP_LYRIC_SETTING_KEY,
          normalized,
          DESKTOP_LYRIC_SETTING_VERSION,
        );
        return normalized;
      }

      const legacyDesktop = deps.getSqliteSetting<boolean>("lyricConfig.desktop")?.value;
      const legacyStoreConfig = deps.readLegacyLyricConfig();

      if (legacyStoreConfig && typeof legacyStoreConfig === "object") {
        const parsed = parseLegacyOrPartial(legacyStoreConfig);
        if (typeof legacyDesktop === "boolean") {
          parsed.enabled = legacyDesktop;
        }
        const normalized = normalizeDesktopLyricSetting(parsed);
        deps.setSqliteSetting(
          DESKTOP_LYRIC_SETTING_KEY,
          normalized,
          DESKTOP_LYRIC_SETTING_VERSION,
        );
        return normalized;
      }

      if (typeof legacyDesktop === "boolean") {
        const normalized = normalizeDesktopLyricSetting({ enabled: legacyDesktop });
        deps.setSqliteSetting(
          DESKTOP_LYRIC_SETTING_KEY,
          normalized,
          DESKTOP_LYRIC_SETTING_VERSION,
        );
        return normalized;
      }

      const normalized = normalizeDesktopLyricSetting(null);
      deps.setSqliteSetting(
        DESKTOP_LYRIC_SETTING_KEY,
        normalized,
        DESKTOP_LYRIC_SETTING_VERSION,
      );
      return normalized;
    },

    patch(patchData: Partial<DesktopLyricSettingV2>): DesktopLyricSettingV2 {
      const current = this.read();
      const merged = normalizeDesktopLyricSetting({
        ...current,
        ...patchData,
        bounds: {
          ...current.bounds,
          ...(patchData.bounds ?? {}),
        },
      });
      deps.setSqliteSetting(
        DESKTOP_LYRIC_SETTING_KEY,
        merged,
        DESKTOP_LYRIC_SETTING_VERSION,
      );
      return merged;
    },

    saveBounds(bounds: DesktopLyricBounds): DesktopLyricSettingV2 {
      return this.patch({ bounds });
    },
  };
}

export function getDefaultDesktopLyricSettingRepository(): DesktopLyricSettingRepository {
  return createDesktopLyricSettingRepository({
    getSqliteSetting: (key) => getAppDatabase().getSetting(key),
    setSqliteSetting: (key, value, version) => getAppDatabase().setSetting(key, value, version),
    readLegacyLyricConfig: () => {
      try {
        return (appStore.get("lyricConfig") as Record<string, unknown>) ?? null;
      } catch {
        return null;
      }
    },
  });
}
