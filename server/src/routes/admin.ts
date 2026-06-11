import { Router } from "express";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  type AboutConfig,
  type Announcement,
  type AvailabilityConfig,
  type BootstrapConfig,
  type DesktopUpdateAssetType,
  type DiscoverConfig,
  type EditableAppConfigSections,
  type EmailConfig,
  type GatewaySignConfig,
  type ReleaseConfig,
  type ReleaseInfo,
  type ReleasePlatform,
  type TextContentConfig,
  activateDesktopUpdateVersion,
  createDesktopUpdateUploadRecord,
  createReleaseUploadRecord,
  deleteAnnouncement,
  listFileRecords,
  publishUpdate,
  readAdminUser,
  readAnnouncements,
  readAnyAdminUser,
  readAppConfig,
  readUpdateHistory,
  replacePlaintextPaths,
  saveAnnouncement,
  saveAppConfigSections,
  softDeleteUpdateHistory,
  updatePublishedUpdate,
  upsertAdminUser,
} from "../db/configStore";
import { getDeviceDb } from "../db/deviceInfoDb";
import { getPlaintextPaths, setPlaintextPaths } from "../middleware/encryption";
import { getAdminJwtSecret, requireAdminJwt } from "../middleware/requireAdminJwt";
import { adminDynamicConfigRouter } from "./adminDynamicConfig";
import { adminFeedbackRouter } from "./adminFeedback";
import { adminUsersRouter } from "./adminUsers";
import {
  buildReleaseFileDownloadPath,
  createDesktopUpdateUploadToken,
  createQiniuUploadToken,
  validateDesktopUpdateAsset,
  validateReleaseFile,
} from "../services/qiniuReleaseFiles";
import { deleteManagedFileRecord, deleteManagedReleaseFileForHistory } from "../services/fileManagementService";
import { fail, ok } from "../types/response";

export const adminRouter = Router();

const JWT_EXPIRES: jwt.SignOptions["expiresIn"] = "7d";
const PATH_REGEX = /^\/[A-Za-z0-9._\-/*]*$/;
const EMAIL_PROVIDER_CODE_REGEX = /^[a-z][a-z0-9_-]*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANDATORY_PLAINTEXT_PATHS = ["/api/config/releases", "/api/config/release-files/*", "/api/config/desktop-updates/*", "/api/config/discover", "/discover/*"];

function getUsernameFromJwt(req: Request): string | null {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) return null;
  const token = raw.slice(7).trim();
  if (!token) return null;
  try {
    const p = jwt.verify(token, getAdminJwtSecret()) as jwt.JwtPayload;
    return typeof p.sub === "string" ? p.sub : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRequiredString(value: unknown, field: string, maxLength: number): { ok: true; value: string } | { ok: false; msg: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: false, msg: `${field} 涓嶈兘涓虹┖` };
  if (text.length > maxLength) return { ok: false, msg: `${field} 闀垮害涓嶈兘瓒呰繃 ${maxLength}` };
  return { ok: true, value: text };
}

function normalizePlatform(value: unknown): ReleasePlatform {
  return value === "desktop" ? "desktop" : "android";
}

function normalizePayload(body: unknown): { platform: ReleasePlatform; release: ReleaseInfo; releaseFileId?: string } | null {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== "object") return null;

  const platform = normalizePlatform(b.platform);
  const latestVersion = String(b.latestVersion ?? "").trim();
  const updateTime = String(b.updateTime ?? "").trim();
  const downloadUrl = String(b.downloadUrl ?? "").trim();
  const officialUrl = String(b.officialUrl ?? "").trim();
  const updateContent = String(b.updateContent ?? "").trim();
  const forceUpdate = Boolean(b.forceUpdate);
  const platformLabel = String(b.platformLabel ?? (platform === "desktop" ? "PC ?" : "Android")).trim();
  const fileSizeText = String(b.fileSizeText ?? "").trim();
  const available = Boolean(b.available) && Boolean(downloadUrl);
  const releaseFileId = typeof b.releaseFileId === "string" ? b.releaseFileId.trim() : "";

  if (!latestVersion || !updateTime || !officialUrl || !updateContent || !platformLabel) return null;
  if (available && !downloadUrl) return null;
  if (platform === "android" && !downloadUrl) return null;
  return {
    platform,
    releaseFileId: releaseFileId || undefined,
    release: {
      latestVersion,
      updateTime,
      forceUpdate,
      downloadUrl,
      officialUrl,
      updateContent,
      platformLabel,
      fileSizeText,
      available,
    },
  };
}

function normalizeUploadTokenPayload(body: unknown):
  | { ok: true; value: { platform: ReleasePlatform; fileName: string; fileSize: number; mimeType: string } }
  | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const platform = normalizePlatform(body.platform);
  const fileName = String(body.fileName ?? "").trim();
  const fileSize = Number(body.fileSize);
  const mimeType = String(body.mimeType ?? "").trim();
  try {
    validateReleaseFile(platform, fileName, fileSize);
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "安装包文件不合法" };
  }
  return { ok: true, value: { platform, fileName, fileSize, mimeType } };
}

function normalizeUploadCompletePayload(body: unknown):
  | {
      ok: true;
      value: {
        platform: ReleasePlatform;
        bucket: string;
        key: string;
        hash: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
        version?: string;
      };
    }
  | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const platform = normalizePlatform(body.platform);
  const bucket = String(body.bucket ?? "").trim();
  const key = String(body.key ?? "").trim();
  const hash = String(body.hash ?? "").trim();
  const fileName = String(body.fileName ?? "").trim();
  const mimeType = String(body.mimeType ?? "").trim();
  const fileSize = Number(body.fileSize);
  const version = String(body.version ?? "").trim();
  if (!bucket) return { ok: false, msg: "bucket 不能为空" };
  if (!key.startsWith(`pisamusic/releases/${platform}/`)) return { ok: false, msg: "七牛文件 key 与发布平台不匹配" };
  try {
    validateReleaseFile(platform, fileName, fileSize);
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "安装包文件不合法" };
  }
  return { ok: true, value: { platform, bucket, key, hash, fileName, mimeType, fileSize, version: version || undefined } };
}

function normalizeDesktopUpdateUploadTokenPayload(body: unknown):
  | { ok: true; value: { version: string; platform: "win32"; arch: "x64"; fileType: DesktopUpdateAssetType; fileName: string; fileSize: number; mimeType: string } }
  | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const version = String(body.version ?? "").trim();
  const platform = body.platform === "win32" ? "win32" : "win32";
  const arch = body.arch === "x64" ? "x64" : "x64";
  const fileName = String(body.fileName ?? "").trim();
  const fileSize = Number(body.fileSize);
  const mimeType = String(body.mimeType ?? "").trim();
  if (!version) return { ok: false, msg: "version 不能为空" };
  try {
    const fileType = validateDesktopUpdateAsset(fileName, fileSize);
    return { ok: true, value: { version, platform, arch, fileType, fileName, fileSize, mimeType } };
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "自动更新文件不合法" };
  }
}

function normalizeDesktopUpdateCompletePayload(body: unknown):
  | {
      ok: true;
      value: {
        version: string;
        platform: "win32";
        arch: "x64";
        fileType: DesktopUpdateAssetType;
        bucket: string;
        key: string;
        hash: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
      };
    }
  | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const version = String(body.version ?? "").trim();
  const platform = body.platform === "win32" ? "win32" : "win32";
  const arch = body.arch === "x64" ? "x64" : "x64";
  const bucket = String(body.bucket ?? "").trim();
  const key = String(body.key ?? "").trim();
  const hash = String(body.hash ?? "").trim();
  const fileName = String(body.fileName ?? "").trim();
  const mimeType = String(body.mimeType ?? "").trim();
  const fileSize = Number(body.fileSize);
  if (!version) return { ok: false, msg: "version 不能为空" };
  if (!bucket) return { ok: false, msg: "bucket 不能为空" };
  if (!key.startsWith(`pisamusic/desktop-updates/${platform}/${arch}/`)) return { ok: false, msg: "七牛文件 key 与自动更新平台不匹配" };
  try {
    const fileType = validateDesktopUpdateAsset(fileName, fileSize);
    return { ok: true, value: { version, platform, arch, fileType, bucket, key, hash, fileName, mimeType, fileSize } };
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "自动更新文件不合法" };
  }
}

function normalizeDesktopUpdateActivatePayload(body: unknown):
  | { ok: true; value: { version: string; platform: "win32"; arch: "x64" } }
  | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "璇锋眰浣撳繀椤绘槸瀵硅薄" };
  const version = String(body.version ?? "").trim();
  if (!version) return { ok: false, msg: "version 涓嶈兘涓虹┖" };
  return { ok: true, value: { version, platform: "win32", arch: "x64" } };
}

function normalizeGatewaySignPayload(body: unknown): GatewaySignConfig | null {
  if (!isRecord(body)) return null;
  const secret = String(body.secret ?? "").trim();
  const as = String(body.as ?? "").trim();
  if (!secret || !as || secret.length > 256 || as.length > 256) return null;
  return { secret, as };
}

function normalizeAvailability(input: unknown): { ok: true; value: AvailabilityConfig } | { ok: false; msg: string } {
  if (!isRecord(input) || typeof input.appAvailable !== "boolean") {
    return { ok: false, msg: "availability.appAvailable ??????" };
  }
  const reason = normalizeRequiredString(input.unavailableReason, "availability.unavailableReason", 500);
  if (!reason.ok) return reason;
  return { ok: true, value: { appAvailable: input.appAvailable, unavailableReason: reason.value } };
}

function normalizeEmail(input: unknown): { ok: true; value: EmailConfig } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "email ?????" };
  const serviceUrl = normalizeRequiredString(input.serviceUrl, "email.serviceUrl", 1000);
  if (!serviceUrl.ok) return serviceUrl;
  try {
    const parsed = new URL(serviceUrl.value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, msg: "email.serviceUrl 蹇呴』鏄?http/https 閾炬帴" };
    }
  } catch {
    return { ok: false, msg: "email.serviceUrl ?????????" };
  }
  const provider = normalizeRequiredString(input.provider, "email.provider", 64);
  if (!provider.ok) return provider;
  if (!EMAIL_PROVIDER_CODE_REGEX.test(provider.value)) {
    return { ok: false, msg: "email.provider 蹇呴』浠ュ皬鍐欏瓧姣嶅紑澶达紝涓斿彧鑳藉寘鍚皬鍐欏瓧姣嶃€佹暟瀛椼€乢銆?" };
  }
  if (!Array.isArray(input.providers) || input.providers.length === 0) {
    return { ok: false, msg: "email.providers 鑷冲皯闇€瑕侀厤缃竴涓彁渚涘晢" };
  }
  if (input.providers.length > 20) {
    return { ok: false, msg: "email.providers ???? 20 ?" };
  }
  const providers: EmailConfig["providers"] = [];
  const codes = new Set<string>();
  for (const raw of input.providers) {
    if (!isRecord(raw)) return { ok: false, msg: "email.providers 姣忎竴椤瑰繀椤绘槸瀵硅薄" };
    const code = normalizeRequiredString(raw.code, "email.providers.code", 64);
    if (!code.ok) return code;
    if (!EMAIL_PROVIDER_CODE_REGEX.test(code.value)) {
      return { ok: false, msg: `email provider code 闈炴硶: ${code.value}` };
    }
    if (codes.has(code.value)) {
      return { ok: false, msg: `email provider code 閲嶅: ${code.value}` };
    }
    const name = normalizeRequiredString(raw.name, "email.providers.name", 100);
    if (!name.ok) return name;
    codes.add(code.value);
    providers.push({ code: code.value, name: name.value });
  }
  if (!codes.has(provider.value)) {
    return { ok: false, msg: "email.provider ????? email.providers ???" };
  }
  return { ok: true, value: { serviceUrl: serviceUrl.value, provider: provider.value, providers } };
}

function normalizeTextContent(input: unknown, section: string): { ok: true; value: TextContentConfig } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: `${section} ?????` };
  const title = normalizeRequiredString(input.title, `${section}.title`, 200);
  if (!title.ok) return title;
  const content = normalizeRequiredString(input.content, `${section}.content`, 50000);
  if (!content.ok) return content;
  return { ok: true, value: { title: title.value, content: content.value } };
}

function normalizeAbout(input: unknown): { ok: true; value: AboutConfig } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "about ?????" };
  const appName = normalizeRequiredString(input.appName, "about.appName", 100);
  if (!appName.ok) return appName;
  const websiteLabel = normalizeRequiredString(input.websiteLabel, "about.websiteLabel", 200);
  if (!websiteLabel.ok) return websiteLabel;
  const websiteUrl = normalizeRequiredString(input.websiteUrl, "about.websiteUrl", 500);
  if (!websiteUrl.ok) return websiteUrl;
  const description = normalizeRequiredString(input.description, "about.description", 5000);
  if (!description.ok) return description;
  const team = normalizeRequiredString(input.team, "about.team", 100);
  if (!team.ok) return team;
  const copyright = normalizeRequiredString(input.copyright, "about.copyright", 300);
  if (!copyright.ok) return copyright;
  return {
    ok: true,
    value: {
      appName: appName.value,
      websiteLabel: websiteLabel.value,
      websiteUrl: websiteUrl.value,
      description: description.value,
      team: team.value,
      copyright: copyright.value,
    },
  };
}

function normalizeDiscover(input: unknown): { ok: true; value: DiscoverConfig } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "discover ?????" };
  const url = normalizeRequiredString(input.url, "discover.url", 1000);
  if (!url.ok) return url;
  const value = url.value;
  if (value === "USE_LOCAL_FILE") {
    // App 绔瘑鍒鏍囪鍚庡姞杞藉唴缃?assets 绀轰緥椤点€?  } else {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, msg: "discover.url 浠呮敮鎸?USE_LOCAL_FILE 鎴栧畬鏁?http/https 閾炬帴" };
      }
    } catch {
      return { ok: false, msg: "discover.url ??? USE_LOCAL_FILE ???????" };
    }
  }
  const updatedAt = Number(input.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt < 0) {
    return { ok: false, msg: "discover.updatedAt 蹇呴』鏄湁鏁堟椂闂存埑" };
  }
  return { ok: true, value: { url: value, updatedAt } };
}

function normalizeEndpointRecord(input: unknown): { ok: true; value: Record<string, string> } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "bootstrap.endpoints 蹇呴』鏄瓧绗︿覆瀛楀吀" };
  const endpoints: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(input)) {
    if (!key.trim()) return { ok: false, msg: "bootstrap.endpoints 涓嶈兘鍖呭惈绌?key" };
    const value = normalizeRequiredString(rawValue, `bootstrap.endpoints.${key}`, 1000);
    if (!value.ok) return value;
    endpoints[key] = value.value;
  }
  return { ok: true, value: endpoints };
}

function normalizeBootstrap(input: unknown): { ok: true; value: Partial<BootstrapConfig> } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "bootstrap ?????" };
  const bootstrap: Partial<BootstrapConfig> = {};
  if ("version" in input) {
    const version = normalizeRequiredString(input.version, "bootstrap.version", 100);
    if (!version.ok) return version;
    bootstrap.version = version.value;
  }
  if ("updatedAt" in input) {
    const updatedAt = Number(input.updatedAt);
    if (!Number.isFinite(updatedAt) || updatedAt < 0) return { ok: false, msg: "bootstrap.updatedAt 蹇呴』鏄湁鏁堟椂闂存埑" };
    bootstrap.updatedAt = updatedAt;
  }
  if ("endpoints" in input) {
    const endpoints = normalizeEndpointRecord(input.endpoints);
    if (!endpoints.ok) return endpoints;
    bootstrap.endpoints = endpoints.value;
  }
  if ("gatewaySign" in input) {
    const gatewaySign = normalizeGatewaySignPayload(input.gatewaySign);
    if (!gatewaySign) return { ok: false, msg: "bootstrap.gatewaySign.secret 鍜?as 涓嶈兘涓虹┖锛屼笖闀垮害涓嶈兘瓒呰繃 256" };
    bootstrap.gatewaySign = gatewaySign;
  }
  if ("updater" in input) {
    if (!isRecord(input.updater) || !isRecord(input.updater.desktop)) {
      return { ok: false, msg: "bootstrap.updater.desktop ?????" };
    }
    const desktop = input.updater.desktop;
    const feedBaseUrl = normalizeRequiredString(desktop.feedBaseUrl, "bootstrap.updater.desktop.feedBaseUrl", 1000);
    if (!feedBaseUrl.ok) return feedBaseUrl;
    try {
      const parsed = new URL(feedBaseUrl.value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false, msg: "鑷姩鏇存柊鍦板潃蹇呴』鏄?http/https 閾炬帴" };
    } catch {
      return { ok: false, msg: "???????????????" };
    }
    const startupDelayMs = Number(desktop.startupDelayMs);
    if (!Number.isFinite(startupDelayMs) || startupDelayMs < 0) return { ok: false, msg: "bootstrap.updater.desktop.startupDelayMs ???????" };
    bootstrap.updater = {
      desktop: {
        enabled: Boolean(desktop.enabled),
        feedBaseUrl: feedBaseUrl.value.replace(/\/+$/, ""),
        checkOnStartup: Boolean(desktop.checkOnStartup),
        startupDelayMs,
      },
    };
  }
  if (Object.keys(bootstrap).length === 0) return { ok: false, msg: "bootstrap 鑷冲皯闇€瑕佸寘鍚竴涓彲淇濆瓨瀛楁" };
  return { ok: true, value: bootstrap };
}

function normalizeRelease(input: unknown, platform: ReleasePlatform): { ok: true; value: ReleaseInfo } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: `releases.${platform} ?????` };
  const latestVersion = normalizeRequiredString(input.latestVersion, `releases.${platform}.latestVersion`, 100);
  if (!latestVersion.ok) return latestVersion;
  const updateTime = normalizeRequiredString(input.updateTime, `releases.${platform}.updateTime`, 100);
  if (!updateTime.ok) return updateTime;
  const officialUrl = normalizeRequiredString(input.officialUrl, `releases.${platform}.officialUrl`, 1000);
  if (!officialUrl.ok) return officialUrl;
  const updateContent = normalizeRequiredString(input.updateContent, `releases.${platform}.updateContent`, 50000);
  if (!updateContent.ok) return updateContent;
  const platformLabel = normalizeRequiredString(input.platformLabel, `releases.${platform}.platformLabel`, 100);
  if (!platformLabel.ok) return platformLabel;
  const downloadUrl = typeof input.downloadUrl === "string" ? input.downloadUrl.trim() : "";
  if (platform === "android" && !downloadUrl) return { ok: false, msg: "Android 涓嬭浇鍦板潃涓嶈兘涓虹┖" };
  if (downloadUrl.length > 1000) return { ok: false, msg: `releases.${platform}.downloadUrl 闀垮害涓嶈兘瓒呰繃 1000` };
  const fileSizeText = typeof input.fileSizeText === "string" ? input.fileSizeText.trim() : "";
  if (fileSizeText.length > 60) return { ok: false, msg: `releases.${platform}.fileSizeText 闀垮害涓嶈兘瓒呰繃 60` };
  return {
    ok: true,
    value: {
      latestVersion: latestVersion.value,
      updateTime: updateTime.value,
      forceUpdate: Boolean(input.forceUpdate),
      downloadUrl,
      officialUrl: officialUrl.value,
      updateContent: updateContent.value,
      platformLabel: platformLabel.value,
      fileSizeText,
      available: Boolean(input.available) && Boolean(downloadUrl),
    },
  };
}

function normalizeReleases(input: unknown): { ok: true; value: Partial<ReleaseConfig> } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "releases ?????" };
  const releases: Partial<ReleaseConfig> = {};
  if ("android" in input) {
    const android = normalizeRelease(input.android, "android");
    if (!android.ok) return android;
    releases.android = android.value;
  }
  if ("desktop" in input) {
    const desktop = normalizeRelease(input.desktop, "desktop");
    if (!desktop.ok) return desktop;
    releases.desktop = desktop.value;
  }
  if (!releases.android && !releases.desktop) return { ok: false, msg: "releases 鑷冲皯闇€瑕佸寘鍚?android 鎴?desktop" };
  return { ok: true, value: releases };
}

function normalizeAppConfigSections(input: unknown): { ok: true; value: EditableAppConfigSections } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "璇锋眰浣撳繀椤绘槸瀵硅薄" };
  const sections: EditableAppConfigSections = {};
  if ("availability" in input) {
    const availability = normalizeAvailability(input.availability);
    if (!availability.ok) return availability;
    sections.availability = availability.value;
  }
  if ("email" in input) {
    const email = normalizeEmail(input.email);
    if (!email.ok) return email;
    sections.email = email.value;
  }
  if ("bootstrap" in input) {
    const bootstrap = normalizeBootstrap(input.bootstrap);
    if (!bootstrap.ok) return bootstrap;
    sections.bootstrap = bootstrap.value;
  }
  if ("releases" in input) {
    const releases = normalizeReleases(input.releases);
    if (!releases.ok) return releases;
    sections.releases = releases.value;
  }
  if ("agreement" in input) {
    const agreement = normalizeTextContent(input.agreement, "agreement");
    if (!agreement.ok) return agreement;
    sections.agreement = agreement.value;
  }
  if ("privacy" in input) {
    const privacy = normalizeTextContent(input.privacy, "privacy");
    if (!privacy.ok) return privacy;
    sections.privacy = privacy.value;
  }
  if ("about" in input) {
    const about = normalizeAbout(input.about);
    if (!about.ok) return about;
    sections.about = about.value;
  }
  if ("discover" in input) {
    const discover = normalizeDiscover(input.discover);
    if (!discover.ok) return discover;
    sections.discover = discover.value;
  }
  if (Object.keys(sections).length === 0) return { ok: false, msg: "鑷冲皯闇€瑕佹彁浜や竴涓彲淇濆瓨鐨勯厤缃?section" };
  return { ok: true, value: sections };
}

function normalizeAnnouncement(body: unknown): { ok: true; value: Announcement } | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "???????" };
  const id = normalizeRequiredString(body.id, "id", 120);
  if (!id.ok) return id;
  const content = normalizeRequiredString(body.content, "content", 50000);
  if (!content.ok) return content;
  const time = normalizeRequiredString(body.time, "time", 100);
  if (!time.ok) return time;
  const publisher = normalizeRequiredString(body.publisher, "publisher", 120);
  if (!publisher.ok) return publisher;
  const confirmText = normalizeRequiredString(body.confirmText, "confirmText", 60);
  if (!confirmText.ok) return confirmText;
  return {
    ok: true,
    value: {
      id: id.value,
      content: content.value,
      time: time.value,
      publisher: publisher.value,
      confirmText: confirmText.value,
      showEveryTime: Boolean(body.showEveryTime),
      showGotoButton: Boolean(body.showGotoButton),
      gotoUrl: typeof body.gotoUrl === "string" ? body.gotoUrl.trim() : "",
    },
  };
}

function sanitizePathList(input: unknown): { ok: true; paths: string[] } | { ok: false; msg: string } {
  if (!Array.isArray(input)) return { ok: false, msg: "plaintextPaths 蹇呴』鏄瓧绗︿覆鏁扮粍" };
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") return { ok: false, msg: "鐧藉悕鍗曢」蹇呴』鏄瓧绗︿覆" };
    const t = raw.trim();
    if (!t) continue;
    if (t.length > 256) return { ok: false, msg: `璺緞杩囬暱: ${t.slice(0, 32)}...` };
    if (!PATH_REGEX.test(t)) return { ok: false, msg: `闈炴硶璺緞鏍煎紡: ${t}` };
    const starIdx = t.indexOf("*");
    if (starIdx !== -1 && starIdx !== t.length - 1) return { ok: false, msg: `閫氶厤绗?* 浠呭厑璁稿嚭鐜板湪鏈熬: ${t}` };
    if (seen.has(t)) continue;
    seen.add(t);
    cleaned.push(t);
  }
  if (cleaned.length > 200) return { ok: false, msg: "鐧藉悕鍗曟潯鐩繃澶氾紙涓婇檺 200 鏉★級" };
  return { ok: true, paths: cleaned };
}

adminRouter.post("/login", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    if (!username || !password) return res.status(400).json(fail("?????????", 400));

    const auth = readAdminUser(username);
    if (!auth || !bcrypt.compareSync(password, auth.passwordHash)) {
      return res.status(401).json(fail("鐢ㄦ埛鍚嶆垨瀵嗙爜閿欒", 401));
    }

    const token = jwt.sign({ sub: username }, getAdminJwtSecret(), { expiresIn: JWT_EXPIRES });
    return res.json(ok({ token, username }, "鐧诲綍鎴愬姛"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "鐧诲綍澶辫触";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.use(requireAdminJwt);
adminRouter.use("/dynamic-configs", adminDynamicConfigRouter);
adminRouter.use("/feedback", adminFeedbackRouter);
adminRouter.use("/users", adminUsersRouter);

adminRouter.post("/change-password", async (req, res) => {
  try {
    const username = getUsernameFromJwt(req);
    if (!username) return res.status(401).json(fail("???", 401));
    const body = req.body as Record<string, unknown>;
    const currentPassword = String(body?.currentPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");
    if (!currentPassword || !newPassword) return res.status(400).json(fail("???????????", 400));
    if (newPassword.length < 6) return res.status(400).json(fail("????? 6 ?", 400));
    if (newPassword.length > 128) return res.status(400).json(fail("?????", 400));
    if (currentPassword === newPassword) return res.status(400).json(fail("鏂板瘑鐮佷笉鑳戒笌褰撳墠瀵嗙爜鐩稿悓", 400));

    const auth = readAnyAdminUser();
    if (!auth || auth.username !== username) return res.status(500).json(fail("璐﹀彿閰嶇疆寮傚父", 500));
    if (!bcrypt.compareSync(currentPassword, auth.passwordHash)) return res.status(400).json(fail("褰撳墠瀵嗙爜閿欒", 400));

    upsertAdminUser({ username: auth.username, passwordHash: bcrypt.hashSync(newPassword, 10) });
    return res.json(ok({ updated: true }, "?????"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "淇敼瀵嗙爜澶辫触";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.get("/app-config", (_req, res) => {
  try {
    return res.json(ok(readAppConfig()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "璇诲彇閰嶇疆澶辫触";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.post("/app-config-sections", (req, res) => {
  try {
    const result = normalizeAppConfigSections(req.body);
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    return res.json(ok(saveAppConfigSections(result.value), "?????"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "淇濆瓨閰嶇疆澶辫触";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.get("/announcements", (_req, res) => {
  try {
    return res.json(ok(readAnnouncements()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "璇诲彇鍏憡澶辫触";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.post("/announcements", (req, res) => {
  try {
    const result = normalizeAnnouncement(req.body);
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    return res.json(ok(saveAnnouncement(result.value), "?????"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "淇濆瓨鍏憡澶辫触";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.put("/announcements/:id", (req, res) => {
  try {
    const result = normalizeAnnouncement({ ...(req.body as Record<string, unknown>), id: req.params.id });
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    return res.json(ok(saveAnnouncement(result.value), "?????"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "淇濆瓨鍏憡澶辫触";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.delete("/announcements/:id", (req, res) => {
  try {
    const deleted = deleteAnnouncement(String(req.params.id ?? "").trim());
    if (!deleted) return res.status(404).json(fail("?????", 404));
    return res.json(ok(null, "?????"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "鍒犻櫎鍏憡澶辫触";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.get("/update-history", (_req, res) => {
  try {
    return res.json(ok(readUpdateHistory()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "璇诲彇鏇存柊鍘嗗彶澶辫触";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.get("/files", (req, res) => {
  try {
    const status = String(req.query.status ?? "uploaded");
    const usageType = String(req.query.usageType ?? "all");
    const platform = String(req.query.platform ?? "");
    const version = String(req.query.version ?? "");
    const keyword = String(req.query.keyword ?? "");
    const offset = Number(req.query.offset ?? 0);
    const limit = Number(req.query.limit ?? 20);
    return res.json(ok(listFileRecords({
      status: status === "deleted" || status === "all" ? status : "uploaded",
      usageType: usageType === "release-package" || usageType === "desktop-update" ? usageType : "all",
      platform,
      version,
      keyword,
      offset,
      limit,
    })));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取文件记录失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.delete("/files/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json(fail("文件记录 ID 不能为空", 400));
    const deleted = await deleteManagedFileRecord(id);
    return res.json(ok({ file: deleted }, "文件已删除"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除文件失败";
    const status = message === "文件记录不存在" ? 404 : 500;
    return res.status(status).json(fail(message, status));
  }
});

adminRouter.post("/release-files/upload-token", (req, res) => {
  try {
    const payload = normalizeUploadTokenPayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    return res.json(ok(createQiniuUploadToken(payload.value), "上传凭证已生成"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成上传凭证失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.post("/release-files/complete", (req, res) => {
  try {
    const payload = normalizeUploadCompletePayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    const file = createReleaseUploadRecord({
      id: randomUUID(),
      platform: payload.value.platform,
      version: payload.value.version,
      provider: "qiniu",
      bucket: payload.value.bucket,
      objectKey: payload.value.key,
      hash: payload.value.hash,
      fileName: payload.value.fileName,
      mimeType: payload.value.mimeType,
      fileSize: payload.value.fileSize,
    });
    return res.json(ok(file, "安装包已登记"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "登记安装包失败";
    return res.status(500).json(fail(message, 500));
  }
});
adminRouter.post("/desktop-updates/upload-token", (req, res) => {
  try {
    const payload = normalizeDesktopUpdateUploadTokenPayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    return res.json(ok(createDesktopUpdateUploadToken(payload.value), "自动更新上传凭证已生成"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成自动更新上传凭证失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.post("/desktop-updates/complete", (req, res) => {
  try {
    const payload = normalizeDesktopUpdateCompletePayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    const asset = createDesktopUpdateUploadRecord({
      id: randomUUID(),
      version: payload.value.version,
      platform: payload.value.platform,
      arch: payload.value.arch,
      fileType: payload.value.fileType,
      provider: "qiniu",
      bucket: payload.value.bucket,
      objectKey: payload.value.key,
      hash: payload.value.hash,
      fileName: payload.value.fileName,
      mimeType: payload.value.mimeType,
      fileSize: payload.value.fileSize,
    });
    return res.json(ok(asset, "自动更新文件已登记"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "登记自动更新文件失败";
    return res.status(500).json(fail(message, 500));
  }
});
adminRouter.post("/desktop-updates/activate", (req, res) => {
  try {
    const payload = normalizeDesktopUpdateActivatePayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    const assets = activateDesktopUpdateVersion(payload.value.version, payload.value.platform, payload.value.arch);
    return res.json(ok({ assets }, "PC 自动更新版本已启用"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "启用 PC 自动更新版本失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.post("/publish-update", (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    if (!payload) return res.status(400).json(fail("发布信息不完整", 400));
    const history = publishUpdate(payload.release, randomUUID(), payload.platform, payload.releaseFileId);
    return res.json(ok({ id: history.id, update: payload.release, platform: payload.platform }, "发布成功"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "发布更新失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.put("/update-history/:id", (req, res) => {
  try {
    const historyId = String(req.params.id ?? "").trim();
    if (!historyId) return res.status(400).json(fail("发布记录 ID 不能为空", 400));
    const payload = normalizePayload(req.body);
    if (!payload) return res.status(400).json(fail("发布信息不完整", 400));
    const history = updatePublishedUpdate(historyId, payload.release, payload.platform, payload.releaseFileId);
    return res.json(ok({ id: history.id, update: payload.release, platform: payload.platform, history }, "发布记录已保存"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存发布记录失败";
    const status = message === "发布记录不存在" ? 404 : message === "发布记录平台不能修改" ? 400 : 500;
    return res.status(status).json(fail(message, status));
  }
});

adminRouter.delete("/update-history/:id/release-file", async (req, res) => {
  try {
    const historyId = String(req.params.id ?? "").trim();
    if (!historyId) return res.status(400).json(fail("发布记录 ID 不能为空", 400));
    const deleted = await deleteManagedReleaseFileForHistory(historyId);
    return res.json(ok({ releaseFile: deleted }, "安装包已删除"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除安装包失败";
    const status = message === "该发布记录没有可删除的安装包" ? 404 : 500;
    return res.status(status).json(fail(message, status));
  }
});

adminRouter.delete("/update-history/:id", (req, res) => {
  try {
    const historyId = String(req.params.id ?? "").trim();
    if (!historyId) return res.status(400).json(fail("发布记录 ID 不能为空", 400));
    const result = softDeleteUpdateHistory(historyId);
    if (result.ok) return res.json(ok({ id: historyId }, "版本记录已删除"));
    if (result.reason === "NOT_FOUND") {
      return res.status(404).json(fail("发布记录不存在", 404));
    }
    return res.status(400).json(fail("当前最新版本不可删除", 400));
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除版本记录失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.get("/encryption-config", (_req, res) => {
  return res.json(ok({ plaintextPaths: getPlaintextPaths() }));
});

adminRouter.post("/encryption-config", (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const result = sanitizePathList(body?.plaintextPaths);
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    const paths = [...new Set([...result.paths, ...MANDATORY_PLAINTEXT_PATHS])];
    replacePlaintextPaths(paths);
    setPlaintextPaths(paths);
    return res.json(ok({ plaintextPaths: paths }, "鐧藉悕鍗曞凡鏇存柊"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "???????";
    return res.status(500).json(fail(message, 500));
  }
});

type DeviceInfoRow = {
  id: string;
  fingerprint: string;
  device_name: string;
  brand: string;
  model: string;
  os_version: string;
  sdk_version: number;
  app_version: string;
  app_version_code: number;
  locked: number;
  lock_end_time: number | null;
  first_seen_at: number;
  last_active_at: number;
  first_seen_ip: string | null;
  last_seen_ip: string | null;
  last_country_code: string | null;
  last_timezone: string | null;
  last_locale: string | null;
  extra_info: string;
};

function mapDeviceRow(row: DeviceInfoRow) {
  let extraInfo: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.extra_info) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) extraInfo = parsed as Record<string, unknown>;
  } catch {
    extraInfo = {};
  }
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    deviceName: row.device_name,
    brand: row.brand,
    model: row.model,
    osVersion: row.os_version,
    sdkVersion: row.sdk_version,
    appVersion: row.app_version,
    appVersionCode: row.app_version_code,
    locked: row.locked !== 0,
    lockEndTime: row.lock_end_time,
    firstSeenAt: row.first_seen_at,
    lastActiveAt: row.last_active_at,
    firstSeenIp: row.first_seen_ip,
    lastSeenIp: row.last_seen_ip,
    lastCountryCode: row.last_country_code,
    lastTimezone: row.last_timezone,
    lastLocale: row.last_locale,
    extraInfo,
  };
}

type DesktopDeviceInfoRow = {
  id: string;
  fingerprint: string;
  device_name: string;
  hostname: string;
  os_name: string;
  os_version: string;
  platform: string;
  arch: string;
  app_version: string;
  locked: number;
  lock_end_time: number | null;
  first_seen_at: number;
  last_active_at: number;
  first_seen_ip: string | null;
  last_seen_ip: string | null;
  extra_info: string;
};

function mapDesktopDeviceRow(row: DesktopDeviceInfoRow) {
  let extraInfo: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.extra_info) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) extraInfo = parsed as Record<string, unknown>;
  } catch {
    extraInfo = {};
  }
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    deviceName: row.device_name,
    hostname: row.hostname,
    osName: row.os_name,
    osVersion: row.os_version,
    platform: row.platform,
    arch: row.arch,
    appVersion: row.app_version,
    locked: row.locked !== 0,
    lockEndTime: row.lock_end_time,
    firstSeenAt: row.first_seen_at,
    lastActiveAt: row.last_active_at,
    firstSeenIp: row.first_seen_ip,
    lastSeenIp: row.last_seen_ip,
    extraInfo,
  };
}

adminRouter.get("/device/list", (req, res) => {
  try {
    const db = getDeviceDb();
    const search = String(req.query.search ?? "").trim();
    const lockedParam = req.query.locked;
    const brand = String(req.query.brand ?? "").trim();
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];
    if (search) {
      whereClauses.push("(brand LIKE ? OR model LIKE ? OR device_name LIKE ? OR id LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (lockedParam === "true" || lockedParam === "1") whereClauses.push("locked = 1");
    else if (lockedParam === "false" || lockedParam === "0") whereClauses.push("locked = 0");
    if (brand) {
      whereClauses.push("brand LIKE ?");
      params.push(`%${brand}%`);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM device_info ${where}`).get(...params) as { total: number };
    const rows = db.prepare(`SELECT * FROM device_info ${where} ORDER BY last_active_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as DeviceInfoRow[];

    return res.json(ok({ devices: rows.map(mapDeviceRow), total: countRow.total, offset, limit }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "鏌ヨ璁惧鍒楄〃澶辫触";
    return res.status(500).json(fail(msg, 500));
  }
});

adminRouter.get("/device/:id", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid device ID", 400));
  try {
    const db = getDeviceDb();
    const row = db.prepare("SELECT * FROM device_info WHERE id = ?").get(id) as DeviceInfoRow | undefined;
    if (!row) return res.status(404).json(fail("Device not found", 404));
    return res.json(ok(mapDeviceRow(row)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "鏌ヨ璁惧璇︽儏澶辫触";
    return res.status(500).json(fail(msg, 500));
  }
});

adminRouter.post("/device/:id/lock", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid device ID", 400));
  try {
    const body = req.body as Record<string, unknown>;
    const locked = Boolean(body.locked);
    const lockEndTime = body.lockEndTime != null ? Number(body.lockEndTime) : null;
    if (lockEndTime !== null && !Number.isFinite(lockEndTime)) {
      return res.status(400).json(fail("lockEndTime must be a valid timestamp or null", 400));
    }

    const db = getDeviceDb();
    const existing = db.prepare("SELECT id FROM device_info WHERE id = ?").get(id) as { id: string } | undefined;
    if (!existing) return res.status(404).json(fail("Device not found", 404));

    db.prepare("UPDATE device_info SET locked = ?, lock_end_time = ? WHERE id = ?").run(locked ? 1 : 0, lockEndTime, id);
    const updated = db.prepare("SELECT * FROM device_info WHERE id = ?").get(id) as DeviceInfoRow;
    return res.json(ok(mapDeviceRow(updated)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "鎿嶄綔澶辫触";
    return res.status(500).json(fail(msg, 500));
  }
});

adminRouter.delete("/device/:id", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid device ID", 400));
  try {
    const db = getDeviceDb();
    const existing = db.prepare("SELECT id FROM device_info WHERE id = ?").get(id) as { id: string } | undefined;
    if (!existing) return res.status(404).json(fail("Device not found", 404));
    db.prepare("DELETE FROM device_info WHERE id = ?").run(id);
    return res.json(ok(null, "?????"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "鍒犻櫎璁惧澶辫触";
    return res.status(500).json(fail(msg, 500));
  }
});

adminRouter.get("/desktop-device/list", (req, res) => {
  try {
    const db = getDeviceDb();
    const search = String(req.query.search ?? "").trim();
    const lockedParam = req.query.locked;
    const platform = String(req.query.platform ?? "").trim();
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];
    if (search) {
      whereClauses.push("(device_name LIKE ? OR hostname LIKE ? OR os_name LIKE ? OR id LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (lockedParam === "true" || lockedParam === "1") whereClauses.push("locked = 1");
    else if (lockedParam === "false" || lockedParam === "0") whereClauses.push("locked = 0");
    if (platform) {
      whereClauses.push("platform LIKE ?");
      params.push(`%${platform}%`);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM desktop_device_info ${where}`).get(...params) as { total: number };
    const rows = db.prepare(`SELECT * FROM desktop_device_info ${where} ORDER BY last_active_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as DesktopDeviceInfoRow[];

    return res.json(ok({ devices: rows.map(mapDesktopDeviceRow), total: countRow.total, offset, limit }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "鏌ヨ PC 璁惧鍒楄〃澶辫触";
    return res.status(500).json(fail(msg, 500));
  }
});

adminRouter.get("/desktop-device/:id", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid desktop device ID", 400));
  try {
    const db = getDeviceDb();
    const row = db.prepare("SELECT * FROM desktop_device_info WHERE id = ?").get(id) as DesktopDeviceInfoRow | undefined;
    if (!row) return res.status(404).json(fail("Desktop device not found", 404));
    return res.json(ok(mapDesktopDeviceRow(row)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "鏌ヨ PC 璁惧璇︽儏澶辫触";
    return res.status(500).json(fail(msg, 500));
  }
});

adminRouter.post("/desktop-device/:id/lock", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid desktop device ID", 400));
  try {
    const body = req.body as Record<string, unknown>;
    const locked = Boolean(body.locked);
    const lockEndTime = body.lockEndTime != null ? Number(body.lockEndTime) : null;
    if (lockEndTime !== null && !Number.isFinite(lockEndTime)) {
      return res.status(400).json(fail("lockEndTime must be a valid timestamp or null", 400));
    }

    const db = getDeviceDb();
    const existing = db.prepare("SELECT id FROM desktop_device_info WHERE id = ?").get(id) as { id: string } | undefined;
    if (!existing) return res.status(404).json(fail("Desktop device not found", 404));

    db.prepare("UPDATE desktop_device_info SET locked = ?, lock_end_time = ? WHERE id = ?").run(locked ? 1 : 0, lockEndTime, id);
    const updated = db.prepare("SELECT * FROM desktop_device_info WHERE id = ?").get(id) as DesktopDeviceInfoRow;
    return res.json(ok(mapDesktopDeviceRow(updated)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "鎿嶄綔 PC 璁惧澶辫触";
    return res.status(500).json(fail(msg, 500));
  }
});

adminRouter.delete("/desktop-device/:id", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid desktop device ID", 400));
  try {
    const db = getDeviceDb();
    const existing = db.prepare("SELECT id FROM desktop_device_info WHERE id = ?").get(id) as { id: string } | undefined;
    if (!existing) return res.status(404).json(fail("Desktop device not found", 404));
    db.prepare("DELETE FROM desktop_device_info WHERE id = ?").run(id);
    return res.json(ok(null, "PC ?????"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "鍒犻櫎 PC 璁惧澶辫触";
    return res.status(500).json(fail(msg, 500));
  }
});
