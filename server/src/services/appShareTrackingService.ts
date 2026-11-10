import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { deviceMessageIdentityFromRequest } from "../middleware/deviceMessageToken";
import {
  tokenFromRequest,
  verifyUserToken,
} from "../middleware/requireUserJwt";
import {
  hashVisitorId,
  maybeCleanupAnalytics,
  type DownloadRecordInput,
} from "../db/analyticsStore";
import {
  getOrCreateTrackingRecord,
  readTrackingCode,
  recordTrackingVisit,
  recordTrackedDownload,
  invalidateTrackingRecord,
  readTrackingDeviceName,
} from "../db/appShareTrackingStore";
import {
  listTrackingRecords,
  trackingRecordDetail,
  type TrackingFilters,
} from "../db/appShareTrackingAdminStore";
import { readPublicAppShare, renderAppShareCopy } from "./appShareService";
import { readAppShareConfig } from "../db/appShareStore";
import { readReleaseFileById } from "../db/configStore";
import { createPrivateQiniuDownloadUrl } from "./qiniuReleaseFiles";
export class AppShareTrackingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const SHARE_CODE_RE = /^[A-Za-z0-9]{6}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WEEK = 7 * 86400000;
const COOKIE = "pm_app_share_attribution";
const developmentSecret = randomBytes(32).toString("hex");
export function attributionSecret(): string {
  const configured = String(
    process.env.APP_SHARE_ATTRIBUTION_SECRET ?? "",
  ).trim();
  if (process.env.NODE_ENV === "production" && configured.length < 32)
    throw new Error("生产环境必须配置至少32字符 APP_SHARE_ATTRIBUTION_SECRET");
  return configured || developmentSecret;
}
if (process.env.NODE_ENV === "production") attributionSecret();
function signature(body: string) {
  return createHmac("sha256", attributionSecret())
    .update(body)
    .digest("base64url");
}
export function signAttribution(visitorHash: string, now = Date.now()): string {
  const body = Buffer.from(
    JSON.stringify({ v: 1, h: visitorHash, e: now + WEEK }),
  ).toString("base64url");
  return `${body}.${signature(body)}`;
}
export function verifyAttribution(
  value: string,
  now = Date.now(),
): string | undefined {
  try {
    const [body, sig, ...rest] = value.split(".");
    if (!body || !sig || rest.length) return;
    const actual = Buffer.from(sig),
      expected = Buffer.from(signature(body));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString());
    if (
      parsed.v === 1 &&
      /^[0-9a-f]{64}$/.test(parsed.h) &&
      Number.isSafeInteger(parsed.e) &&
      parsed.e > now &&
      parsed.e <= now + WEEK
    )
      return parsed.h;
  } catch {
    return;
  }
}
function cookieHash(req: Request): string | undefined {
  const raw = req.header("cookie") ?? "";
  const value = raw
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (!value) return;
  try {
    return verifyAttribution(decodeURIComponent(value));
  } catch {
    return;
  }
}
export function safeReferrer(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return /https?:/.test(url.protocol)
      ? `${url.origin}${url.pathname}`.slice(0, 512)
      : "";
  } catch {
    return "";
  }
}
export async function getIdentityAppShare(req: Request) {
  const share = (await readPublicAppShare());
  // 旧版客户端可能由拦截器自动附加登录 Authorization，但未发送设备凭证。
  // 此类请求必须继续返回通用配置，不能因旧登录态失效而破坏接口兼容。
  if (req.header("x-pm-device-token") === undefined)
    return { ...share, trackingEnabled: false };
  const authPresent = req.header("authorization") !== undefined;
  const user = authPresent ? (await verifyUserToken(tokenFromRequest(req))) : null;
  if (authPresent && !user)
    throw new AppShareTrackingError("账号登录已失效，请重新登录", 401);
  const identity = (await deviceMessageIdentityFromRequest(req));
  if (!identity || identity.kind !== "android")
    throw new AppShareTrackingError("设备凭证已失效，请重新上报", 401);
  const record = (await getOrCreateTrackingRecord({
    deviceKind: "android",
    deviceId: identity.deviceId,
    userId: user?.id ?? null,
    userName: user?.username ?? "游客",
    deviceName: (await readTrackingDeviceName(identity.deviceId)),
  }));
  let url: URL;
  try {
    url = new URL(share.qrCodeText);
  } catch {
    url = new URL("https://pisamusic.partialy.cn/app-share/");
  }
  // 旧配置可以读取，身份化链接始终迁往受支持的推广入口。
  if (
    url.origin !== "https://pisamusic.partialy.cn" ||
    !/^\/app-share\/?$/.test(url.pathname)
  )
    url = new URL("https://pisamusic.partialy.cn/app-share/");
  url.pathname = "/app-share/";
  url.searchParams.set("code", record.code);
  const qrCodeText = url.toString();
  return {
    ...share,
    qrCodeText,
    copyText: renderAppShareCopy((await readAppShareConfig()).copyTemplate, qrCodeText),
    shareCode: record.code,
    trackingEnabled: true,
  };
}
export async function publicTrackingCode(code: string) {
  if (!SHARE_CODE_RE.test(code) || !(await readTrackingCode(code)))
    throw new AppShareTrackingError("分享链接无效", 404);
  const share = (await readPublicAppShare());
  return {
    code,
    valid: true,
    appName: share.appName,
    iconUrl: share.iconUrl,
    description: share.description,
  };
}
function stringInput(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}
export async function acceptTrackingVisit(req: Request, res: Response) {
  const body = req.body as Record<string, unknown> | undefined;
  if (
    !body ||
    !UUID.test(String(body.eventId)) ||
    !UUID.test(String(body.visitorId)) ||
    !SHARE_CODE_RE.test(String(body.code))
  )
    throw new AppShareTrackingError("访问参数无效");
  const now = Date.now();
  const openedAt = Number(body.openedAt);
  const sequence = body.sequence === undefined ? 0 : Number(body.sequence);
  if (
    !Number.isSafeInteger(openedAt) ||
    openedAt < now - 10 * 60000 ||
    openedAt > now + 30000 ||
    !Number.isSafeInteger(sequence) ||
    sequence < 0
  )
    throw new AppShareTrackingError("访问时间或顺序无效");
  const visitorHash = hashVisitorId(String(body.visitorId));
  const ua = stringInput(req.header("user-agent"), 512);
  (await maybeCleanupAnalytics(now));
  const result = (await recordTrackingVisit({
    eventId: String(body.eventId),
    visitorHash,
    code: String(body.code),
    openedAt,
    sequence,
    referrerPath: safeReferrer(req.header("referer")),
    userAgent: ua,
    browserDeviceType: /android|iphone|mobile/i.test(ua) ? "mobile" : "desktop",
    now,
  }));
  // Cookie仅绑定匿名浏览器hash，最终触点从库中按导航顺序查询，迟到响应不会覆盖新触点。
  res.cookie(COOKIE, signAttribution(visitorHash, now), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || req.secure,
    sameSite: "lax",
    path: "/",
    maxAge: WEEK,
  });
  return result;
}
export async function trackWebsiteDownload(req: Request, input: DownloadRecordInput) {
  (await maybeCleanupAnalytics(input.occurredAt ?? Date.now()));
  const explicit = Object.prototype.hasOwnProperty.call(req.query, "code");
  const code =
    typeof req.query.code === "string" && SHARE_CODE_RE.test(req.query.code)
      ? req.query.code
      : undefined;
  (await recordTrackedDownload(input, {
    explicit,
    code,
    visitorHash: cookieHash(req),
    safeReferrerPath: safeReferrer(input.referrer),
  }));
}
export async function resolveTrackedDownloadTarget(
  downloadUrl: string,
  fileRecordId: string | null,
): Promise<string> {
  if (fileRecordId) {
    const file = (await readReleaseFileById(fileRecordId));
    if (!file || file.status !== "uploaded")
      throw new AppShareTrackingError("安装包不存在或已删除", 404);
    return createPrivateQiniuDownloadUrl(file.objectKey);
  }
  // 根相对站内安装包地址是既有配置能力；拒绝协议相对地址及反斜杠，避免变成站外跳转。
  const isRootRelative = downloadUrl.startsWith("/");
  if (/^[\s]*\/\//.test(downloadUrl) || /[\\\u0000-\u001f\u007f]/.test(downloadUrl))
    throw new AppShareTrackingError("下载地址无效", 500);
  const target = new URL(downloadUrl, isRootRelative ? "https://download-validation.invalid" : undefined);
  if (
    !["https:", "http:"].includes(target.protocol) ||
    target.username ||
    target.password
  )
    throw new AppShareTrackingError("下载地址无效", 500);
  if (/^\/api\/config\/download\/(android|desktop)\/?$/.test(target.pathname))
    throw new AppShareTrackingError("下载地址配置循环", 500);
  return downloadUrl;
}
function integer(value: unknown, fallback: number, max: number) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? Math.min(n, max) : fallback;
}
export function trackingFilters(
  query: Record<string, unknown>,
): TrackingFilters {
  const timeField = query.timeField ?? "createdAt",
    sort = query.sort ?? "createdAt";
  if (
    !["createdAt", "lastVisitAt", "lastDownloadAt"].includes(
      String(timeField),
    ) ||
    !["createdAt", "visitCount", "downloadCount", "lastActiveAt"].includes(
      String(sort),
    )
  )
    throw new AppShareTrackingError("排序或时间维度无效");
  if (
    query.valid !== undefined &&
    !["true", "false", "all"].includes(String(query.valid))
  )
    throw new AppShareTrackingError("状态无效");
  const timestamp = (value: unknown) => {
    if (value === undefined || value === "") return undefined;
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 0)
      throw new AppShareTrackingError("时间范围无效");
    return n;
  };
  const from = timestamp(query.from),
    to = timestamp(query.to);
  if (from !== undefined && to !== undefined && from > to)
    throw new AppShareTrackingError("时间范围无效");
  return {
    keyword: stringInput(query.keyword, 200).trim(),
    valid:
      query.valid === "true"
        ? true
        : query.valid === "false"
          ? false
          : undefined,
    timeField: timeField as TrackingFilters["timeField"],
    sort: sort as TrackingFilters["sort"],
    from,
    to,
    offset: integer(query.offset, 0, 1000000),
    limit: Math.max(1, integer(query.limit, 20, 100)),
  };
}
export async function managedTrackingList(query: Record<string, unknown>) {
  return (await listTrackingRecords(trackingFilters(query)));
}
export async function managedTrackingDetail(
  id: string,
  query: Record<string, unknown>,
) {
  if (!UUID.test(id)) throw new AppShareTrackingError("记录不存在", 404);
  const result = (await trackingRecordDetail(
    id,
    integer(query.visitOffset, 0, 1000000),
    integer(query.downloadOffset, 0, 1000000),
    Math.max(1, integer(query.limit, 20, 100)),
  ));
  if (!result) throw new AppShareTrackingError("记录不存在", 404);
  return result;
}
export async function invalidateManagedTracking(id: string) {
  if (!UUID.test(id) || !(await invalidateTrackingRecord(id)))
    throw new AppShareTrackingError("记录不存在", 404);
  return { id, valid: false };
}
export async function exportManagedTracking(query: Record<string, unknown>) {
  const rows = (await listTrackingRecords(trackingFilters(query), true)).items;
  const csvCell = (value: unknown) => {
    let text = value == null ? "" : String(value);
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const date = (n: number) =>
    new Date(n).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour12: false,
    });
  const lines: unknown[][] = [
    [
      "分享人",
      "账号ID",
      "设备名称",
      "设备ID",
      "短码",
      "创建时间（北京时间）",
      "有效状态",
      "PV",
      "累计日UV",
      "Android下载触发",
      "Windows下载触发",
      "总下载触发",
    ],
  ];
  for (const r of rows)
    lines.push([
      r.userName,
      r.userId,
      r.deviceName,
      r.deviceId,
      r.code,
      date(r.createdAt),
      r.valid ? "有效" : "失效",
      r.visitCount,
      r.visitUv,
      r.androidDownloadCount,
      r.desktopDownloadCount,
      r.downloadCount,
    ]);
  return {
    csv:
      "\uFEFF" + lines.map((line) => line.map(csvCell).join(",")).join("\r\n"),
  };
}
