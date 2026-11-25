import type { Announcement } from "../db/announcements/announcementStore";
import type { ReleaseConfig } from "../db/system/systemConfigStore";
import { parseAnnouncementPageAction, parseAnnouncementUrlAction, type AnnouncementPageAction, type AnnouncementUrlAction } from "./announcementContent";

export const ANNOUNCEMENT_VERSION = 2;
type ClientPlatform = "mobile" | "pc";
export type AnnouncementPlatform = ClientPlatform | "all";
export type AnnouncementVersionRule =
  | { mode: "all" }
  | { mode: "current"; versions: Partial<Record<ClientPlatform, string>> }
  | { mode: "specified"; versions: string[] }
  | { mode: "gte" | "lte"; version: string };
export type AnnouncementDelivery = {
  platform: AnnouncementPlatform;
  versionRule: AnnouncementVersionRule;
  waitSeconds: number;
  gotoAction: AnnouncementPageAction | AnnouncementUrlAction | null;
};

export class AnnouncementDeliveryError extends Error {}

export const defaultAnnouncementDelivery: AnnouncementDelivery = {
  platform: "all",
  versionRule: { mode: "all" },
  waitSeconds: 0,
  gotoAction: null,
};

const APP_VERSION = /^[vV]?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function normalizeAppVersion(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 128) return;
  const match = APP_VERSION.exec(value.trim());
  if (!match) return;
  const [, major, minor, patch, pre] = match;
  if (pre?.split(".").some((part) => /^0\d+$/.test(part))) return;
  return [major, minor, patch].join(".") + (pre ? "-" + pre : "");
}

function compareVersion(a: string, b: string): number {
  const [aCore, aPre] = a.split(/-(.*)/s);
  const [bCore, bPre] = b.split(/-(.*)/s);
  const compareIdentifier = (left: string, right: string) => {
    if (left === right) return 0;
    const leftNumber = /^\d+$/.test(left);
    const rightNumber = /^\d+$/.test(right);
    if (leftNumber && rightNumber && left.length !== right.length) return left.length - right.length;
    if (leftNumber !== rightNumber) return leftNumber ? -1 : 1;
    return left < right ? -1 : 1;
  };
  const coreA = aCore.split(".");
  const coreB = bCore.split(".");
  for (let index = 0; index < coreA.length; index++) {
    const result = compareIdentifier(coreA[index], coreB[index]);
    if (result) return result;
  }
  if (aPre === bPre) return 0;
  if (!aPre || !bPre) return !aPre ? 1 : -1;
  const preA = aPre.split(".");
  const preB = bPre.split(".");
  for (let index = 0; index < Math.min(preA.length, preB.length); index++) {
    const result = compareIdentifier(preA[index], preB[index]);
    if (result) return result;
  }
  return preA.length - preB.length;
}

function requiredVersion(value: unknown): string {
  const version = normalizeAppVersion(value);
  if (!version) throw new AnnouncementDeliveryError("App 版本格式无效，例如 v2.2.2");
  return version;
}

function isPlatform(value: unknown): value is AnnouncementPlatform {
  return value === "all" || value === "mobile" || value === "pc";
}

type AnnouncementQuery = { announcementVersion: number; appVersion?: string; type: AnnouncementPlatform };

export function readAnnouncementQuery(input: Record<string, unknown>, startup = false): AnnouncementQuery {
  const raw = input.announcementVersion;
  const value = typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : raw;
  const valid = typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
  if (raw !== undefined && !valid && !startup) throw new AnnouncementDeliveryError("announcementVersion 必须为正整数");
  if (input.type !== undefined && !isPlatform(input.type)) throw new AnnouncementDeliveryError("type 只能为 all、mobile 或 pc");
  const appVersion = input.appVersion === undefined
    ? undefined
    : startup ? normalizeAppVersion(input.appVersion) : requiredVersion(input.appVersion);
  return {
    announcementVersion: valid && !(startup && input.appVersion !== undefined && !appVersion) ? value : 1,
    appVersion,
    type: isPlatform(input.type) ? input.type : "all",
  };
}

export function matchesAnnouncement(announcement: Announcement, query: AnnouncementQuery): boolean {
  const { platform, versionRule: rule } = announcement;
  if (query.announcementVersion < announcement.announcementVersion) return false;
  if (query.type !== "all" && platform !== "all" && platform !== query.type) return false;
  const version = query.appVersion;
  if (!version || rule.mode === "all") return true;
  if (rule.mode === "current") {
    const requestedPlatform = query.type === "all" ? platform : query.type;
    return requestedPlatform === "all"
      ? Object.values(rule.versions).includes(version)
      : rule.versions[requestedPlatform] === version;
  }
  if (rule.mode === "specified") return rule.versions.includes(version);
  const order = compareVersion(version, rule.version);
  return rule.mode === "gte" ? order >= 0 : order <= 0;
}

export function normalizeAnnouncementDelivery(
  input: Record<string, unknown>,
  existing: Announcement | undefined,
  releases?: ReleaseConfig,
): AnnouncementDelivery {
  const platform = input.platform ?? existing?.platform ?? "all";
  if (!isPlatform(platform)) throw new AnnouncementDeliveryError("公告平台无效");
  const waitSeconds = input.waitSeconds ?? existing?.waitSeconds ?? 0;
  if (typeof waitSeconds !== "number" || !Number.isInteger(waitSeconds) || waitSeconds < 0 || waitSeconds > 2147483647) {
    throw new AnnouncementDeliveryError("等待时间必须为非负整数秒且不超过 2147483647");
  }
  const rawRule = input.versionRule ?? existing?.versionRule ?? { mode: "all" };
  if (typeof rawRule !== "object" || rawRule === null || Array.isArray(rawRule)) {
    throw new AnnouncementDeliveryError("版本规则无效");
  }
  const rule = rawRule as Record<string, unknown>;
  let versionRule: AnnouncementVersionRule;
  switch (rule.mode) {
    case "all":
      versionRule = { mode: "all" };
      break;
    case "current": {
      if (rule.versions !== undefined && existing?.versionRule.mode === "current" && existing.platform === platform) {
        versionRule = existing.versionRule;
        break;
      }
      const versions: Partial<Record<ClientPlatform, string>> = {};
      if (platform !== "pc") versions.mobile = requiredVersion(releases?.android.latestVersion);
      if (platform !== "mobile") versions.pc = requiredVersion(releases?.desktop.latestVersion);
      versionRule = { mode: "current", versions };
      break;
    }
    case "specified":
      if (!Array.isArray(rule.versions) || !rule.versions.length || rule.versions.length > 100) {
        throw new AnnouncementDeliveryError("请指定 1 到 100 个 App 版本");
      }
      versionRule = { mode: "specified", versions: [...new Set(rule.versions.map(requiredVersion))] };
      break;
    case "gte":
    case "lte":
      versionRule = { mode: rule.mode, version: requiredVersion(rule.version) };
      break;
    default:
      throw new AnnouncementDeliveryError("版本规则无效");
  }
  const rawAction = "gotoAction" in input ? input.gotoAction : existing?.gotoAction;
  let gotoAction: AnnouncementDelivery["gotoAction"] = null;
  if (rawAction != null) {
    if (typeof rawAction !== "object" || Array.isArray(rawAction)) throw new AnnouncementDeliveryError("前往动作无效");
    const action = rawAction as Record<string, unknown>;
    if (action.type === "page") gotoAction = parseAnnouncementPageAction(action, "gotoAction");
    else if (action.type === "url") gotoAction = parseAnnouncementUrlAction(action, "gotoAction");
    else throw new AnnouncementDeliveryError("前往动作无效");
  }
  return { platform, versionRule, waitSeconds, gotoAction };
}
