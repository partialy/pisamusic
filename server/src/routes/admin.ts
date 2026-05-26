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
  type DiscoverConfig,
  type EditableAppConfigSections,
  type GatewaySignConfig,
  type ReleaseConfig,
  type ReleaseInfo,
  type ReleasePlatform,
  type TextContentConfig,
  deleteAnnouncement,
  publishUpdate,
  readAdminUser,
  readAnnouncements,
  readAnyAdminUser,
  readAppConfig,
  readUpdateHistory,
  replacePlaintextPaths,
  saveAnnouncement,
  saveAppConfigSections,
  upsertAdminUser,
} from "../db/configStore";
import { getDeviceDb } from "../db/deviceInfoDb";
import { getPlaintextPaths, setPlaintextPaths } from "../middleware/encryption";
import { getAdminJwtSecret, requireAdminJwt } from "../middleware/requireAdminJwt";
import { fail, ok } from "../types/response";

export const adminRouter = Router();

const JWT_EXPIRES: jwt.SignOptions["expiresIn"] = "7d";
const PATH_REGEX = /^\/[A-Za-z0-9._\-/*]*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANDATORY_PLAINTEXT_PATHS = ["/api/config/releases", "/api/config/discover", "/discover/*"];

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
  if (!text) return { ok: false, msg: `${field} 不能为空` };
  if (text.length > maxLength) return { ok: false, msg: `${field} 长度不能超过 ${maxLength}` };
  return { ok: true, value: text };
}

function normalizePlatform(value: unknown): ReleasePlatform {
  return value === "desktop" ? "desktop" : "android";
}

function normalizePayload(body: unknown): { platform: ReleasePlatform; release: ReleaseInfo } | null {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== "object") return null;

  const platform = normalizePlatform(b.platform);
  const latestVersion = String(b.latestVersion ?? "").trim();
  const updateTime = String(b.updateTime ?? "").trim();
  const downloadUrl = String(b.downloadUrl ?? "").trim();
  const officialUrl = String(b.officialUrl ?? "").trim();
  const updateContent = String(b.updateContent ?? "").trim();
  const forceUpdate = Boolean(b.forceUpdate);
  const platformLabel = String(b.platformLabel ?? (platform === "desktop" ? "PC 版" : "Android")).trim();
  const fileSizeText = String(b.fileSizeText ?? "").trim();
  const available = Boolean(b.available) && Boolean(downloadUrl);

  if (!latestVersion || !updateTime || !officialUrl || !updateContent || !platformLabel) return null;
  if (available && !downloadUrl) return null;
  if (platform === "android" && !downloadUrl) return null;
  return {
    platform,
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

function normalizeTextContent(input: unknown, section: string): { ok: true; value: TextContentConfig } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: `${section} 必须是对象` };
  const title = normalizeRequiredString(input.title, `${section}.title`, 200);
  if (!title.ok) return title;
  const content = normalizeRequiredString(input.content, `${section}.content`, 50000);
  if (!content.ok) return content;
  return { ok: true, value: { title: title.value, content: content.value } };
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
  if (value === "USE_LOCAL_FILE") {
    // App 端识别该标记后加载内置 assets 示例页。
  } else {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, msg: "discover.url 仅支持 USE_LOCAL_FILE 或完整 http/https 链接" };
      }
    } catch {
      return { ok: false, msg: "discover.url 必须是 USE_LOCAL_FILE 或有效完整链接" };
    }
  }
  const updatedAt = Number(input.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt < 0) {
    return { ok: false, msg: "discover.updatedAt 必须是有效时间戳" };
  }
  return { ok: true, value: { url: value, updatedAt } };
}

function normalizeEndpointRecord(input: unknown): { ok: true; value: Record<string, string> } | { ok: false; msg: string } {
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
  if (Object.keys(bootstrap).length === 0) return { ok: false, msg: "bootstrap 至少需要包含一个可保存字段" };
  return { ok: true, value: bootstrap };
}

function normalizeRelease(input: unknown, platform: ReleasePlatform): { ok: true; value: ReleaseInfo } | { ok: false; msg: string } {
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
    const android = normalizeRelease(input.android, "android");
    if (!android.ok) return android;
    releases.android = android.value;
  }
  if ("desktop" in input) {
    const desktop = normalizeRelease(input.desktop, "desktop");
    if (!desktop.ok) return desktop;
    releases.desktop = desktop.value;
  }
  if (!releases.android && !releases.desktop) return { ok: false, msg: "releases 至少需要包含 android 或 desktop" };
  return { ok: true, value: releases };
}

function normalizeAppConfigSections(input: unknown): { ok: true; value: EditableAppConfigSections } | { ok: false; msg: string } {
  if (!isRecord(input)) return { ok: false, msg: "请求体必须是对象" };
  const sections: EditableAppConfigSections = {};
  if ("availability" in input) {
    const availability = normalizeAvailability(input.availability);
    if (!availability.ok) return availability;
    sections.availability = availability.value;
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

function normalizeAnnouncement(body: unknown): { ok: true; value: Announcement } | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "公告必须是对象" };
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
  if (!Array.isArray(input)) return { ok: false, msg: "plaintextPaths 必须是字符串数组" };
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") return { ok: false, msg: "白名单项必须是字符串" };
    const t = raw.trim();
    if (!t) continue;
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

adminRouter.post("/login", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    if (!username || !password) return res.status(400).json(fail("请输入用户名和密码", 400));

    const auth = readAdminUser(username);
    if (!auth || !bcrypt.compareSync(password, auth.passwordHash)) {
      return res.status(401).json(fail("用户名或密码错误", 401));
    }

    const token = jwt.sign({ sub: username }, getAdminJwtSecret(), { expiresIn: JWT_EXPIRES });
    return res.json(ok({ token, username }, "登录成功"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "登录失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.use(requireAdminJwt);

adminRouter.post("/change-password", async (req, res) => {
  try {
    const username = getUsernameFromJwt(req);
    if (!username) return res.status(401).json(fail("未登录", 401));
    const body = req.body as Record<string, unknown>;
    const currentPassword = String(body?.currentPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");
    if (!currentPassword || !newPassword) return res.status(400).json(fail("请填写当前密码和新密码", 400));
    if (newPassword.length < 6) return res.status(400).json(fail("新密码至少 6 位", 400));
    if (newPassword.length > 128) return res.status(400).json(fail("新密码过长", 400));
    if (currentPassword === newPassword) return res.status(400).json(fail("新密码不能与当前密码相同", 400));

    const auth = readAnyAdminUser();
    if (!auth || auth.username !== username) return res.status(500).json(fail("账号配置异常", 500));
    if (!bcrypt.compareSync(currentPassword, auth.passwordHash)) return res.status(400).json(fail("当前密码错误", 400));

    upsertAdminUser({ username: auth.username, passwordHash: bcrypt.hashSync(newPassword, 10) });
    return res.json(ok({ updated: true }, "密码已更新"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "修改密码失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.get("/app-config", (_req, res) => {
  try {
    return res.json(ok(readAppConfig()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.post("/app-config-sections", (req, res) => {
  try {
    const result = normalizeAppConfigSections(req.body);
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    return res.json(ok(saveAppConfigSections(result.value), "配置已保存"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存配置失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.get("/announcements", (_req, res) => {
  try {
    return res.json(ok(readAnnouncements()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取公告失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.post("/announcements", (req, res) => {
  try {
    const result = normalizeAnnouncement(req.body);
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    return res.json(ok(saveAnnouncement(result.value), "公告已保存"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存公告失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.put("/announcements/:id", (req, res) => {
  try {
    const result = normalizeAnnouncement({ ...(req.body as Record<string, unknown>), id: req.params.id });
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    return res.json(ok(saveAnnouncement(result.value), "公告已保存"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存公告失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.delete("/announcements/:id", (req, res) => {
  try {
    const deleted = deleteAnnouncement(String(req.params.id ?? "").trim());
    if (!deleted) return res.status(404).json(fail("公告不存在", 404));
    return res.json(ok(null, "公告已删除"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除公告失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.get("/update-history", (_req, res) => {
  try {
    return res.json(ok(readUpdateHistory()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取更新历史失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminRouter.post("/publish-update", (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    if (!payload) return res.status(400).json(fail("参数不完整或格式不正确", 400));
    const history = publishUpdate(payload.release, randomUUID(), payload.platform);
    return res.json(ok({ id: history.id, update: payload.release, platform: payload.platform }, "发布成功"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "发布更新失败";
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
    return res.json(ok({ plaintextPaths: paths }, "白名单已更新"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存白名单失败";
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
    const msg = e instanceof Error ? e.message : "查询设备列表失败";
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
    const msg = e instanceof Error ? e.message : "查询设备详情失败";
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
    const msg = e instanceof Error ? e.message : "操作失败";
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
    return res.json(ok(null, "设备已删除"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "删除设备失败";
    return res.status(500).json(fail(msg, 500));
  }
});
