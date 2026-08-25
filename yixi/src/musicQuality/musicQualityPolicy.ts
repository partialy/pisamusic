import type { AccountSessionLike } from "../types/account";
import { isSystemVipActive } from "../types/account";

export type QualitySource = "kg" | "wy" | "kw";
export type QualityAccessLevel = "guest" | "account" | "vip";

export type MusicQualityOption = {
  key: string;
  source: QualitySource;
  label: string;
  shortLabel: string;
  kind: "kg" | "wy-br" | "wy-level" | "kw";
  quality?: string;
  br?: number;
  level?: string;
};

export type QualityAccessOption = MusicQualityOption & {
  enabled: boolean;
  loginRequired: boolean;
  badge?: "需登录";
};

export type PlaybackQualityPreference = Partial<Record<QualitySource, string>>;

export const PLAYBACK_QUALITY_SETTING_KEY = "playback-quality-preference";

export const KG_VIP_CATALOG: MusicQualityOption[] = [
  { key: "kg:128", source: "kg", label: "128 kbps MP3", shortLabel: "128", kind: "kg", quality: "128" },
  { key: "kg:320", source: "kg", label: "320 kbps MP3", shortLabel: "320", kind: "kg", quality: "320" },
  { key: "kg:flac", source: "kg", label: "FLAC", shortLabel: "FLAC", kind: "kg", quality: "flac" },
  { key: "kg:high", source: "kg", label: "无损 (high)", shortLabel: "HQ", kind: "kg", quality: "high" },
  { key: "kg:viper_atmos", source: "kg", label: "蝰蛇全景声", shortLabel: "VIPER", kind: "kg", quality: "viper_atmos" },
  { key: "kg:viper_clear", source: "kg", label: "蝰蛇超清音质", shortLabel: "CLEAR", kind: "kg", quality: "viper_clear" },
];

export const WY_VIP_CATALOG: MusicQualityOption[] = [
  { key: "wy-br:128000", source: "wy", label: "[码率] 128 kbps", shortLabel: "128", kind: "wy-br", br: 128000 },
  { key: "wy-br:320000", source: "wy", label: "[码率] 320 kbps", shortLabel: "320", kind: "wy-br", br: 320000 },
  { key: "wy-br:999000", source: "wy", label: "[码率] 999000（最大）", shortLabel: "SQ", kind: "wy-br", br: 999000 },
  { key: "wy-level:standard", source: "wy", label: "[音质等级] 标准 standard", shortLabel: "STD", kind: "wy-level", level: "standard" },
  { key: "wy-level:higher", source: "wy", label: "[音质等级] 较高 higher", shortLabel: "HQ", kind: "wy-level", level: "higher" },
  { key: "wy-level:exhigh", source: "wy", label: "[音质等级] 极高 exhigh", shortLabel: "SQ", kind: "wy-level", level: "exhigh" },
  { key: "wy-level:lossless", source: "wy", label: "[音质等级] 无损 lossless", shortLabel: "FLAC", kind: "wy-level", level: "lossless" },
  { key: "wy-level:hires", source: "wy", label: "[音质等级] Hi-Res", shortLabel: "RES", kind: "wy-level", level: "hires" },
  { key: "wy-level:jyeffect", source: "wy", label: "[音质等级] 高清环绕声", shortLabel: "HQ", kind: "wy-level", level: "jyeffect" },
  { key: "wy-level:sky", source: "wy", label: "[音质等级] 沉浸环绕声", shortLabel: "SKY", kind: "wy-level", level: "sky" },
  { key: "wy-level:dolby", source: "wy", label: "[音质等级] 杜比全景声", shortLabel: "DOLBY", kind: "wy-level", level: "dolby" },
  { key: "wy-level:jymaster", source: "wy", label: "[音质等级] 超清母带", shortLabel: "CLEAR", kind: "wy-level", level: "jymaster" },
];

export const KW_CATALOG: MusicQualityOption[] = [
  { key: "kw:standard", source: "kw", label: "标准 standard", shortLabel: "STD", kind: "kw", quality: "standard" },
  { key: "kw:exhigh", source: "kw", label: "极高 exhigh", shortLabel: "SQ", kind: "kw", quality: "exhigh" },
  { key: "kw:lossless", source: "kw", label: "无损 lossless", shortLabel: "FLAC", kind: "kw", quality: "lossless" },
];

const ALL_CATALOG_OPTIONS: MusicQualityOption[] = [
  ...KG_VIP_CATALOG,
  ...WY_VIP_CATALOG,
  ...KW_CATALOG,
];

const CATALOG_OPTION_MAP = new Map<string, MusicQualityOption>(
  ALL_CATALOG_OPTIONS.map((opt) => [opt.key, opt]),
);

export function isQualitySource(source: string | null | undefined): source is QualitySource {
  return source === "kg" || source === "wy" || source === "kw";
}

export function getQualityAccessLevel(
  session: AccountSessionLike | null | undefined,
  now = Date.now(),
): QualityAccessLevel {
  if (!session) return "guest";
  const loggedIn = "loggedIn" in session ? session.loggedIn : session.isLogin;
  if (!loggedIn) return "guest";
  if (isSystemVipActive(session, now)) return "vip";
  return "account";
}

export function getVisibleQualityOptions(
  source: QualitySource,
  access: QualityAccessLevel,
): QualityAccessOption[] {
  switch (source) {
    case "kw":
      return KW_CATALOG.map((opt) => ({
        ...opt,
        enabled: true,
        loginRequired: false,
      }));

    case "kg":
      if (access === "vip") {
        return KG_VIP_CATALOG.map((opt) => ({
          ...opt,
          enabled: true,
          loginRequired: false,
        }));
      }
      if (access === "account") {
        return [
          { key: "kg:128", source: "kg", label: "128", shortLabel: "128", kind: "kg", quality: "128", enabled: true, loginRequired: false },
          { key: "kg:320", source: "kg", label: "320", shortLabel: "320", kind: "kg", quality: "320", enabled: true, loginRequired: false },
          { key: "kg:high", source: "kg", label: "无损（high）", shortLabel: "HQ", kind: "kg", quality: "high", enabled: true, loginRequired: false },
        ];
      }
      // guest
      return [
        { key: "kg:128", source: "kg", label: "128", shortLabel: "128", kind: "kg", quality: "128", enabled: true, loginRequired: false },
        { key: "kg:320", source: "kg", label: "320", shortLabel: "320", kind: "kg", quality: "320", enabled: false, loginRequired: true, badge: "需登录" },
        { key: "kg:high", source: "kg", label: "无损（high）", shortLabel: "HQ", kind: "kg", quality: "high", enabled: false, loginRequired: true, badge: "需登录" },
      ];

    case "wy":
      if (access === "vip") {
        return WY_VIP_CATALOG.map((opt) => ({
          ...opt,
          enabled: true,
          loginRequired: false,
        }));
      }
      if (access === "account") {
        return [
          { key: "wy-br:128000", source: "wy", label: "128k", shortLabel: "128", kind: "wy-br", br: 128000, enabled: true, loginRequired: false },
          { key: "wy-level:standard", source: "wy", label: "标准", shortLabel: "STD", kind: "wy-level", level: "standard", enabled: true, loginRequired: false },
          { key: "wy-level:higher", source: "wy", label: "较高", shortLabel: "HQ", kind: "wy-level", level: "higher", enabled: true, loginRequired: false },
          { key: "wy-level:exhigh", source: "wy", label: "极高", shortLabel: "SQ", kind: "wy-level", level: "exhigh", enabled: true, loginRequired: false },
        ];
      }
      // guest
      return [
        { key: "wy-br:128000", source: "wy", label: "128k", shortLabel: "128", kind: "wy-br", br: 128000, enabled: true, loginRequired: false },
        { key: "wy-level:standard", source: "wy", label: "标准", shortLabel: "STD", kind: "wy-level", level: "standard", enabled: true, loginRequired: false },
        { key: "wy-level:higher", source: "wy", label: "较高", shortLabel: "HQ", kind: "wy-level", level: "higher", enabled: false, loginRequired: true, badge: "需登录" },
        { key: "wy-level:exhigh", source: "wy", label: "极高", shortLabel: "SQ", kind: "wy-level", level: "exhigh", enabled: false, loginRequired: true, badge: "需登录" },
      ];
  }
}

export function isKnownQualityKey(
  source: QualitySource,
  qualityKey: string | null | undefined,
): boolean {
  if (!qualityKey) return false;
  const option = CATALOG_OPTION_MAP.get(qualityKey);
  return Boolean(option && option.source === source);
}

export function isQualityKeyAllowed(
  source: QualitySource,
  qualityKey: string | null | undefined,
  access: QualityAccessLevel,
): boolean {
  if (!qualityKey) return false;
  const visible = getVisibleQualityOptions(source, access);
  return visible.some((opt) => opt.key === qualityKey && opt.enabled);
}

export function getDefaultQualityKey(
  source: QualitySource,
  access: QualityAccessLevel = "vip",
): string {
  switch (source) {
    case "kg":
      return access === "vip" ? "kg:320" : "kg:128";
    case "wy":
      return access === "vip" ? "wy-level:exhigh" : "wy-level:standard";
    case "kw":
      return "kw:exhigh";
  }
}

export function normalizeQualityKeyForAccess(
  source: QualitySource,
  requestedKey: string | null | undefined,
  access: QualityAccessLevel,
): string {
  if (requestedKey && isQualityKeyAllowed(source, requestedKey, access)) {
    return requestedKey;
  }
  return getDefaultQualityKey(source, access);
}

export function getQualityOption(key?: string | null): MusicQualityOption | null {
  if (!key) return null;
  return CATALOG_OPTION_MAP.get(key) ?? null;
}
