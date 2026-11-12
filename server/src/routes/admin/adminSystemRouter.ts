import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  type AboutConfig,
  type AvailabilityConfig,
  type BootstrapConfig,
  type DiscoverConfig,
  type EditableAppConfigSections,
  type EmailConfig,
  type GatewaySignConfig,
  type ReleaseConfig,
  type ReleaseInfo,
  type ReleasePlatform,
  type TextContentConfig,
  readAdminUser,
  readAnyAdminUser,
  readAppConfig,
  replacePlaintextPaths,
  saveAppConfigSections,
  upsertAdminUser,
} from "../../db/configStore";
import { normalizePlainTextContent } from "../../db/plainTextContent";
import { getPlaintextPaths, setPlaintextPaths } from "../../middleware/encryption";
import { getAdminJwtSecret } from "../../middleware/requireAdminJwt";
import { fail, ok } from "../../types/response";
import { normalizeDesktopUpdateFeedUrl } from "../adminValidation";

export const adminSystemRouter = Router();

const PATH_REGEX = /^\/[A-Za-z0-9._\-/*]*$/;
const EMAIL_PROVIDER_CODE_REGEX = /^[a-z][a-z0-9_-]*$/;
const MANDATORY_PLAINTEXT_PATHS = [
  "/api/health",
  "/api/setup/*",
  "/api/app-share/public/*",
  "/api/app-share/visits",
  "/api/config/releases",
  "/api/config/release-files/*",
  "/api/config/desktop-updates/*",
  "/api/config/discover",
  "/api/cloud-music/tracks/*/cover",
  "/discover/*",
];
const MANDATORY_PLAINTEXT_PATH_SET = new Set(MANDATORY_PLAINTEXT_PATHS);

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

function normalizeRequiredString(
  value: unknown,
  field: string,
  maxLength: number,
): { ok: true; value: string } | { ok: false; msg: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: false, msg: `${field} 不能为空` };
  if (text.length > maxLength) return { ok: false, msg: `${field} 长度不能超过 ${maxLength}` };
  return { ok: true, value: text };
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
    return { ok: false, msg: "availability.appAvailable 必须是布尔值" };
  }
  const reason = normalizeRequiredString(input.unavailableReason, "availability.unavailableReason", 500);
  if (!reason.ok) return reason;
  return { ok: true, value: { appAvailable: input.appAvailable, unavailableReason: reason.value } };
}

function normalizeEmail(input: unknown): { ok: true; value: EmailConfig } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "email 必须是对象" };
  const serviceUrl = normalizeRequiredString(input.serviceUrl, "email.serviceUrl", 1000);
  if (!serviceUrl.ok) return serviceUrl;
  try {
    const parsed = new URL(serviceUrl.value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, msg: "email.serviceUrl 必须是 http/https 链接" };
    }
  } catch {
    return { ok: false, msg: "email.serviceUrl 格式不正确" };
  }
  const provider = normalizeRequiredString(input.provider, "email.provider", 64);
  if (!provider.ok) return provider;
  if (!EMAIL_PROVIDER_CODE_REGEX.test(provider.value)) {
    return { ok: false, msg: "email.provider 必须以小写字母开头，且只能包含小写字母、数字、_、-" };
  }
  if (!Array.isArray(input.providers) || input.providers.length === 0) {
    return { ok: false, msg: "email.providers 至少需要配置一个提供商" };
  }
  if (input.providers.length > 20) {
    return { ok: false, msg: "email.providers 最多支持 20 项" };
  }
  const providers: EmailConfig["providers"] = [];
  const codes = new Set<string>();
  for (const raw of input.providers) {
    if (!isRecord(raw)) return { ok: false, msg: "email.providers 每一项必须是对象" };
    const code = normalizeRequiredString(raw.code, "email.providers.code", 64);
    if (!code.ok) return code;
    if (!EMAIL_PROVIDER_CODE_REGEX.test(code.value)) {
      return { ok: false, msg: `email provider code 非法: ${code.value}` };
    }
    if (codes.has(code.value)) {
      return { ok: false, msg: `email provider code 重复: ${code.value}` };
    }
    const name = normalizeRequiredString(raw.name, "email.providers.name", 100);
    if (!name.ok) return name;
    codes.add(code.value);
    providers.push({ code: code.value, name: name.value });
  }
  if (!codes.has(provider.value)) {
    return { ok: false, msg: "email.provider 必须存在于 email.providers 列表中" };
  }
  return { ok: true, value: { serviceUrl: serviceUrl.value, provider: provider.value, providers } };
}

function normalizeTextContent(
  input: unknown,
  section: string,
): { ok: true; value: Omit<TextContentConfig, "version"> } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: `${section} 必须是对象` };
  const title = normalizeRequiredString(input.title, `${section}.title`, 200);
  if (!title.ok) return title;
  const content = typeof input.content === "string" ? normalizePlainTextContent(input.content) : "";
  if (!content) return { ok: false, msg: `${section}.content 不能为空` };
  if (content.length > 50000) return { ok: false, msg: `${section}.content 长度不能超过 50000` };
  return { ok: true, value: { title: title.value, content } };
}

function normalizeAbout(input: unknown): { ok: true; value: AboutConfig } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "about 必须是对象" };
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
  if (!isRecord(input)) return { ok: false, msg: "discover 必须是对象" };
  const url = normalizeRequiredString(input.url, "discover.url", 1000);
  if (!url.ok) return url;
  const value = url.value;
  if (value !== "USE_LOCAL_FILE") {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, msg: "discover.url 仅支持 USE_LOCAL_FILE 或完整 http/https 链接" };
      }
    } catch {
      return { ok: false, msg: "discover.url 不是有效链接" };
    }
  }
  const updatedAt = Number(input.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt < 0) {
    return { ok: false, msg: "discover.updatedAt 必须是有效时间戳" };
  }
  return { ok: true, value: { url: value, updatedAt } };
}

function normalizeEndpointRecord(
  input: unknown,
): { ok: true; value: Record<string, string> } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "bootstrap.endpoints 必须是字符串字典" };
  const endpoints: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(input)) {
    if (!key.trim()) return { ok: false, msg: "bootstrap.endpoints 不能包含空 key" };
    const value = normalizeRequiredString(rawValue, `bootstrap.endpoints.${key}`, 1000);
    if (!value.ok) return value;
    endpoints[key] = value.value;
  }
  return { ok: true, value: endpoints };
}

function normalizeBootstrap(input: unknown): { ok: true; value: Partial<BootstrapConfig> } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "bootstrap 必须是对象" };
  const bootstrap: Partial<BootstrapConfig> = {};
  if ("version" in input) {
    const version = normalizeRequiredString(input.version, "bootstrap.version", 100);
    if (!version.ok) return version;
    bootstrap.version = version.value;
  }
  if ("updatedAt" in input) {
    const updatedAt = Number(input.updatedAt);
    if (!Number.isFinite(updatedAt) || updatedAt < 0) return { ok: false, msg: "bootstrap.updatedAt 必须是有效时间戳" };
    bootstrap.updatedAt = updatedAt;
  }
  if ("endpoints" in input) {
    const endpoints = normalizeEndpointRecord(input.endpoints);
    if (!endpoints.ok) return endpoints;
    bootstrap.endpoints = endpoints.value;
  }
  if ("gatewaySign" in input) {
    const gatewaySign = normalizeGatewaySignPayload(input.gatewaySign);
    if (!gatewaySign) return { ok: false, msg: "bootstrap.gatewaySign.secret 和 as 不能为空，且长度不能超过 256" };
    bootstrap.gatewaySign = gatewaySign;
  }
  if ("updater" in input) {
    if (!isRecord(input.updater) || !isRecord(input.updater.desktop)) {
      return { ok: false, msg: "bootstrap.updater.desktop 必须是对象" };
    }
    const desktop = input.updater.desktop;
    const feedBaseUrl = normalizeRequiredString(desktop.feedBaseUrl, "bootstrap.updater.desktop.feedBaseUrl", 1000);
    if (!feedBaseUrl.ok) return feedBaseUrl;
    const normalizedFeedBaseUrl = normalizeDesktopUpdateFeedUrl(feedBaseUrl.value);
    if (!normalizedFeedBaseUrl.ok) return normalizedFeedBaseUrl;
    const startupDelayMs = Number(desktop.startupDelayMs);
    if (!Number.isFinite(startupDelayMs) || startupDelayMs < 0) {
      return { ok: false, msg: "bootstrap.updater.desktop.startupDelayMs 必须是合法毫秒数" };
    }
    bootstrap.updater = {
      desktop: {
        enabled: Boolean(desktop.enabled),
        feedBaseUrl: normalizedFeedBaseUrl.value,
        checkOnStartup: Boolean(desktop.checkOnStartup),
        startupDelayMs,
      },
    };
  }
  if (Object.keys(bootstrap).length === 0) return { ok: false, msg: "bootstrap 至少需要包含一个可保存字段" };
  return { ok: true, value: bootstrap };
}

function normalizeReleaseInput(
  input: unknown,
  platform: ReleasePlatform,
): { ok: true; value: ReleaseInfo } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: `releases.${platform} 必须是对象` };
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
  if (platform === "android" && !downloadUrl) return { ok: false, msg: "Android 下载地址不能为空" };
  if (downloadUrl.length > 1000) return { ok: false, msg: `releases.${platform}.downloadUrl 长度不能超过 1000` };
  const fileSizeText = typeof input.fileSizeText === "string" ? input.fileSizeText.trim() : "";
  if (fileSizeText.length > 60) return { ok: false, msg: `releases.${platform}.fileSizeText 长度不能超过 60` };
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
  if (!isRecord(input)) return { ok: false, msg: "releases 必须是对象" };
  const releases: Partial<ReleaseConfig> = {};
  if ("android" in input) {
    const android = normalizeReleaseInput(input.android, "android");
    if (!android.ok) return android;
    releases.android = android.value;
  }
  if ("desktop" in input) {
    const desktop = normalizeReleaseInput(input.desktop, "desktop");
    if (!desktop.ok) return desktop;
    releases.desktop = desktop.value;
  }
  if (!releases.android && !releases.desktop) return { ok: false, msg: "releases 至少需要包含 android 或 desktop" };
  return { ok: true, value: releases };
}

function normalizeAppConfigSections(
  input: unknown,
): { ok: true; value: EditableAppConfigSections } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "请求体必须是对象" };
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
  if (Object.keys(sections).length === 0) return { ok: false, msg: "至少需要提交一个可保存的配置 section" };
  return { ok: true, value: sections };
}

function sanitizePathList(input: unknown): { ok: true; paths: string[] } | { ok: false; msg: string } {
  if (!Array.isArray(input)) return { ok: false, msg: "plaintextPaths 必须是字符串数组" };
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") return { ok: false, msg: "白名单项必须是字符串" };
    const t = raw.trim();
    if (!t) continue;
    if (MANDATORY_PLAINTEXT_PATH_SET.has(t)) continue;
    if (t.length > 256) return { ok: false, msg: `路径过长: ${t.slice(0, 32)}...` };
    if (!PATH_REGEX.test(t)) return { ok: false, msg: `非法路径格式: ${t}` };
    const starIdx = t.indexOf("*");
    if (starIdx !== -1 && starIdx !== t.length - 1) return { ok: false, msg: `通配符 * 仅允许出现在末尾: ${t}` };
    if (seen.has(t)) continue;
    seen.add(t);
    cleaned.push(t);
  }
  if (cleaned.length > 200) return { ok: false, msg: "白名单条目过多（上限 200 条）" };
  return { ok: true, paths: cleaned };
}

// Routes
adminSystemRouter.post("/change-password", async (req, res) => {
  try {
    const username = getUsernameFromJwt(req);
    if (!username) return res.status(401).json(fail("未授权", 401));
    const body = req.body as Record<string, unknown>;
    const currentPassword = String(body?.currentPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");
    if (!currentPassword || !newPassword) return res.status(400).json(fail("当前密码和新密码不能为空", 400));
    if (newPassword.length < 6) return res.status(400).json(fail("新密码至少 6 位", 400));
    if (newPassword.length > 128) return res.status(400).json(fail("新密码过长", 400));
    if (currentPassword === newPassword) return res.status(400).json(fail("新密码不能与当前密码相同", 400));

    const auth = await readAnyAdminUser();
    if (!auth || auth.username !== username) return res.status(500).json(fail("账号配置异常", 500));
    if (!bcrypt.compareSync(currentPassword, auth.passwordHash)) return res.status(400).json(fail("当前密码错误", 400));

    await upsertAdminUser({ username: auth.username, passwordHash: bcrypt.hashSync(newPassword, 10) });
    return res.json(ok({ updated: true }, "密码已修改"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "修改密码失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminSystemRouter.get("/app-config", async (_req, res) => {
  try {
    return res.json(ok(await readAppConfig()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminSystemRouter.post("/app-config-sections", async (req, res) => {
  try {
    const result = normalizeAppConfigSections(req.body);
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    return res.json(ok(await saveAppConfigSections(result.value), "配置已保存"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存配置失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminSystemRouter.get("/encryption-config", (_req, res) => {
  return res.json(ok({ plaintextPaths: getPlaintextPaths() }));
});

adminSystemRouter.post("/encryption-config", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const result = sanitizePathList(body?.plaintextPaths);
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    const paths = [...new Set([...result.paths, ...MANDATORY_PLAINTEXT_PATHS])];
    await replacePlaintextPaths(paths);
    setPlaintextPaths(paths);
    return res.json(ok({ plaintextPaths: paths }, "白名单已更新"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新白名单失败";
    return res.status(500).json(fail(message, 500));
  }
});
