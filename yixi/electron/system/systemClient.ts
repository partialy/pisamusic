import { randomUUID } from "node:crypto";
import os from "node:os";
import { app } from "electron";
import { getAppDatabase } from "../database";
import { logDebugRequest } from "../utils/requestDebug";
import { decrypt, encrypt, randomFullKey } from "./encryption";
import { signGatewayUrl } from "./gatewaySigner";
import type {
  Announcement,
  AboutInfo,
  ApiResponse,
  BootstrapConfig,
  DesktopDeviceReportRequest,
  DesktopDeviceReportResult,
  FeedbackPayload,
  GatewaySignConfig,
  RuntimeEndpoints,
  StartupServiceState,
} from "./types";

const DEV_SERVER_URL = "http://127.0.0.1:53380";
const PRODUCTION_SERVER_URL = "http://pm-server.hs.partialy.cn/";
const DEFAULT_GATEWAY_SIGN: GatewaySignConfig = {
  secret: "partialypartialypartialypartialy",
  as: "yixivip",
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  encrypted?: boolean;
  headers?: Record<string, string>;
};

let cachedBootstrap: BootstrapConfig | null = null;
let bootstrapPromise: Promise<BootstrapConfig> | null = null;
let startupServiceState: StartupServiceState = {
  localMode: false,
  reason: "",
  deviceId: "",
};

class DesktopDeviceLockedError extends Error {
  readonly report: DesktopDeviceReportResult;

  constructor(report: DesktopDeviceReportResult) {
    super(desktopLockedMessage(report));
    this.report = report;
  }
}

export function getSystemBaseUrl() {
  const defaultServerUrl = app.isPackaged ? PRODUCTION_SERVER_URL : DEV_SERVER_URL;
  return normalizeBaseUrl(process.env.PISA_SERVER_URL || process.env.PM_SERVER_URL || defaultServerUrl);
}

export function getAppVersion() {
  return app.getVersion();
}

export async function refreshBootstrap() {
  const response = await requestSystem<BootstrapConfig>("/api/config/bootstrap");
  cachedBootstrap = unwrapResponse(response);
  return cachedBootstrap;
}

export async function getBootstrap() {
  return ensureBootstrap();
}

export async function prepareStartupServiceState() {
  try {
    await refreshBootstrap();
    const deviceReport = await reportDesktopDevice();
    if (isDesktopDeviceLocked(deviceReport)) {
      throw new DesktopDeviceLockedError(deviceReport);
    }
    startupServiceState = {
      localMode: false,
      reason: "",
      deviceId: deviceReport.id,
    };
  } catch (error) {
    if (error instanceof DesktopDeviceLockedError) throw error;
    startupServiceState = {
      localMode: true,
      reason: toErrorMessage(error) || "服务不可用",
      deviceId: startupServiceState.deviceId,
    };
  }
  return startupServiceState;
}

export function getStartupServiceState() {
  return startupServiceState;
}

export async function getGatewaySignConfigCached() {
  try {
    const bootstrap = await ensureBootstrap();
    return bootstrap.gatewaySign ?? DEFAULT_GATEWAY_SIGN;
  } catch {
    return cachedBootstrap?.gatewaySign ?? DEFAULT_GATEWAY_SIGN;
  }
}

export async function getAnnouncements() {
  const response = await requestSystem<Announcement[]>("/api/config/announcements");
  return unwrapResponse(response);
}

export async function getAboutInfo() {
  const response = await requestSystem<AboutInfo>("/api/config/about");
  return unwrapResponse(response);
}

export async function submitFeedback(payload: FeedbackPayload) {
  const form = new FormData();
  form.set("feedback_type", payload.feedback_type);
  form.set("description", payload.description);
  if (payload.contact) form.set("contact", payload.contact);
  form.set("device", JSON.stringify(payload.device ?? {}));
  const url = new URL("/api/feedback", getSystemBaseUrl());
  let recorded = false;
  try {
    const requestHeaders = createEncryptionHeaders();
    logDebugRequest({
      scope: "system:feedback",
      method: "POST",
      url: url.toString(),
      headers: requestHeaders,
      body: payload,
    });
    const response = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body: form,
    });
    const raw = await response.text();
    const parsed = parseResponseRaw<{ id: string; createdAt: string }>(response, raw);
    if (!response.ok || !isSystemEnvelopeSuccess(parsed)) {
      recorded = true;
      recordNetworkError({
        requestScope: "system",
        method: "POST",
        requestUrl: url.toString(),
        requestPath: url.pathname,
        requestParams: payload,
        httpStatus: response.status,
        businessCode: parsed.code,
        response: safeParseRaw(raw, parsed),
        errorMessage: parsed.msg || response.statusText || "feedback request failed",
      });
    }
    return unwrapResponse(parsed);
  } catch (error) {
    if (!recorded) {
      recordNetworkError({
        requestScope: "system",
        method: "POST",
        requestUrl: url.toString(),
        requestPath: url.pathname,
        requestParams: payload,
        response: null,
        errorMessage: toErrorMessage(error),
      });
    }
    throw error;
  }
}

async function reportDesktopDevice() {
  const response = await requestSystem<DesktopDeviceReportResult>("/api/device/desktop/report", {
    method: "POST",
    body: buildDesktopDeviceReport(),
  });
  return unwrapResponse(response);
}

export type AccountUser = {
  id: string;
  username: string;
  email: string;
  avatar: string;
  avatarKey: string;
  avatarUrl: string;
  createdAt: number;
};

export type AccountAuthResult = {
  token: string;
  expiresAt: number;
  user: AccountUser;
};

export type AccountSession = AccountAuthResult & {
  loggedIn: boolean;
};

const ACCOUNT_SESSION_KEY = "account-session";
const ACCOUNT_AVATAR_OPTIONS = [
  { key: "default", label: "默认", path: "/static/account-avatars/default.jpg" },
  { key: "anime_sky", label: "天空蓝", path: "/static/account-avatars/anime_sky.png" },
  { key: "anime_mint", label: "薄荷绿", path: "/static/account-avatars/anime_mint.png" },
  { key: "anime_peach", label: "蜜桃橙", path: "/static/account-avatars/anime_peach.png" },
  { key: "anime_lilac", label: "丁香紫", path: "/static/account-avatars/anime_lilac.png" },
  { key: "anime_sun", label: "暖阳黄", path: "/static/account-avatars/anime_sun.png" },
] as const;

export type AccountAvatarOption = {
  key: string;
  label: string;
  url: string;
};

export function getAccountSession(): AccountSession {
  const saved = getAppDatabase().getSetting<AccountAuthResult>(ACCOUNT_SESSION_KEY)?.value;
  if (!saved?.token || !saved.user?.id) return emptyAccountSession();
  return { ...normalizeAccountAuthResult(saved), loggedIn: true };
}

export function saveAccountSession(result: AccountAuthResult): AccountSession {
  const normalized = normalizeAccountAuthResult(result);
  getAppDatabase().setSetting(ACCOUNT_SESSION_KEY, normalized, 1);
  return { ...normalized, loggedIn: true };
}

export function clearAccountSession(): AccountSession {
  getAppDatabase().deleteSetting(ACCOUNT_SESSION_KEY);
  return emptyAccountSession();
}

export async function sendAccountEmailCode(payload: { email: string; purpose: "register" | "login" | "reset_password" }) {
  const response = await requestSystem<{ expiresAt: number; nextSendAt: number }>("/api/auth/email-code", {
    method: "POST",
    body: payload,
  });
  return unwrapResponse(response);
}

export function getAccountAvatarOptions(): AccountAvatarOption[] {
  return ACCOUNT_AVATAR_OPTIONS.map((item) => ({
    key: item.key,
    label: item.label,
    url: absoluteSystemUrl(item.path),
  }));
}

export async function registerAccount(payload: { email: string; username: string; password: string; code: string }) {
  const response = await requestSystem<AccountAuthResult>("/api/auth/register", {
    method: "POST",
    body: payload,
  });
  return saveAccountSession(unwrapResponse(response));
}

export async function loginAccountByPassword(payload: { identifier: string; password: string }) {
  const response = await requestSystem<AccountAuthResult>("/api/auth/login/password", {
    method: "POST",
    body: payload,
  });
  return saveAccountSession(unwrapResponse(response));
}

export async function loginAccountByCode(payload: { email: string; code: string }) {
  const response = await requestSystem<AccountAuthResult>("/api/auth/login/code", {
    method: "POST",
    body: payload,
  });
  return saveAccountSession(unwrapResponse(response));
}

export async function refreshAccountSession() {
  const session = getAccountSession();
  if (!session.loggedIn) return session;
  try {
    const response = await requestSystem<AccountAuthResult>("/api/auth/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
    });
    return saveAccountSession(unwrapResponse(response));
  } catch (error) {
    clearAccountSession();
    throw error;
  }
}

export async function sendProfileEmailCode(payload: { email: string }) {
  const session = getAccountSession();
  if (!session.loggedIn) throw new Error("请先登录账号");
  const response = await requestSystem<{ expiresAt: number; nextSendAt: number }>("/api/auth/profile/email-code", {
    method: "POST",
    body: payload,
    headers: { Authorization: `Bearer ${session.token}` },
  });
  return unwrapResponse(response);
}

export async function updateAccountProfile(payload: { username?: string; email?: string; code?: string; avatarKey?: string }) {
  const session = getAccountSession();
  if (!session.loggedIn) throw new Error("请先登录账号");
  const response = await requestSystem<AccountAuthResult>("/api/auth/profile", {
    method: "PATCH",
    body: payload,
    headers: { Authorization: `Bearer ${session.token}` },
  });
  return saveAccountSession(unwrapResponse(response));
}

export async function changeAccountPassword(payload: { currentPassword: string; newPassword: string }) {
  const session = getAccountSession();
  if (!session.loggedIn) throw new Error("璇峰厛鐧诲綍璐﹀彿");
  const response = await requestSystem<{ updated: boolean }>("/api/auth/password/change", {
    method: "POST",
    body: payload,
    headers: { Authorization: `Bearer ${session.token}` },
  });
  return unwrapResponse(response);
}

export async function resetAccountPassword(payload: { email: string; code: string; newPassword: string }) {
  const response = await requestSystem<{ updated: boolean }>("/api/auth/password/reset", {
    method: "POST",
    body: payload,
  });
  return unwrapResponse(response);
}

export type SyncChange = {
  version: number;
  opId: string;
  deviceId: string;
  itemType: string;
  itemKey: string;
  action: "upsert" | "delete";
  payload: unknown;
  clientUpdatedAt: string;
  serverUpdatedAt: number;
};

export type SyncChangeInput = {
  opId: string;
  itemType: string;
  itemKey: string;
  action: "upsert" | "delete";
  payload: unknown;
  clientUpdatedAt: string;
};

export async function getSyncChanges(token: string, since: number) {
  const response = await requestSystem<{ version: number; changes: SyncChange[] }>(
    `/api/sync/changes?since=${encodeURIComponent(String(since))}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-pm-device-id": getDesktopDeviceClientId(),
      },
    }
  );
  return unwrapResponse(response);
}

export async function pushSyncChanges(token: string, changes: SyncChangeInput[]) {
  const response = await requestSystem<{ version: number; accepted: number; skipped: number }>(
    "/api/sync/changes",
    {
      method: "POST",
      body: { changes },
      headers: {
        Authorization: `Bearer ${token}`,
        "x-pm-device-id": getDesktopDeviceClientId(),
      },
    }
  );
  return unwrapResponse(response);
}

export async function requestSignedGateway<T>(
  rawUrl: string,
  options: Omit<RequestOptions, "encrypted"> = {}
) {
  const bootstrap = cachedBootstrap ?? (await ensureBootstrap());
  const signConfig = bootstrap.gatewaySign ?? DEFAULT_GATEWAY_SIGN;
  const method = options.method ?? "GET";
  const body = options.body === undefined ? "" : JSON.stringify(options.body);
  const signed = signGatewayUrl(method, rawUrl, body, signConfig);
  const requestUrl = new URL(rawUrl);
  let recorded = false;
  try {
    const requestHeaders = {
      ...signed.headers,
      ...(body ? { "content-type": "application/json" } : {}),
    };
    logDebugRequest({
      scope: "gateway",
      method,
      url: rawUrl,
      headers: requestHeaders,
      body: options.body,
    });
    const response = await fetch(signed.url, {
      method,
      headers: requestHeaders,
      body: body || undefined,
    });
    const raw = await response.text();
    if (!response.ok) {
      recorded = true;
      recordNetworkError({
        requestScope: "gateway",
        method,
        requestUrl: rawUrl,
        requestPath: requestUrl.pathname,
        requestParams: options.body ?? Object.fromEntries(requestUrl.searchParams.entries()),
        httpStatus: response.status,
        response: safeParseRaw(raw, raw || null),
        errorMessage: response.statusText || `gateway request failed: ${response.status}`,
      });
      throw new Error(response.statusText || `gateway request failed: ${response.status}`);
    }
    const parsed = parseGatewayResponseRaw<T>(response, raw);
    const businessError = getExplicitGatewayBusinessError(parsed);
    if (!response.ok || businessError) {
      recorded = true;
      recordNetworkError({
        requestScope: "gateway",
        method,
        requestUrl: rawUrl,
        requestPath: requestUrl.pathname,
        requestParams: options.body ?? Object.fromEntries(requestUrl.searchParams.entries()),
        httpStatus: response.status,
        businessCode: businessError?.code ?? null,
        response: safeParseRaw(raw, parsed),
        errorMessage: businessError?.message || response.statusText || "gateway request failed",
      });
    }
    return parsed;
  } catch (error) {
    if (!recorded) {
      recordNetworkError({
        requestScope: "gateway",
        method,
        requestUrl: rawUrl,
        requestPath: requestUrl.pathname,
        requestParams: options.body ?? Object.fromEntries(requestUrl.searchParams.entries()),
        response: null,
        errorMessage: toErrorMessage(error),
      });
    }
    throw error;
  }
}

export function getRuntimeEndpoints(): RuntimeEndpoints {
  return toRuntimeEndpoints(cachedBootstrap?.endpoints ?? {});
}

export async function getRuntimeEndpointsCached() {
  try {
    const bootstrap = await ensureBootstrap();
    return toRuntimeEndpoints(bootstrap.endpoints);
  } catch {
    return toRuntimeEndpoints(cachedBootstrap?.endpoints ?? {});
  }
}

export async function getRuntimeEndpointsFresh() {
  try {
    const bootstrap = await refreshBootstrap();
    return toRuntimeEndpoints(bootstrap.endpoints);
  } catch {
    return toRuntimeEndpoints(cachedBootstrap?.endpoints ?? {});
  }
}

async function ensureBootstrap() {
  if (cachedBootstrap) return cachedBootstrap;
  if (!bootstrapPromise) {
    bootstrapPromise = refreshBootstrap().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

export async function requestSystem<T>(path: string, options: RequestOptions = {}) {
  const url = new URL(path, getSystemBaseUrl());
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};
  let body: string | undefined;
  const useEncryption = options.encrypted !== false;

  if (useEncryption) {
    const reqKey = applyEncryptionHeaders(headers);
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify({
        isEnc: true,
        encData: encrypt(
          reqKey,
          JSON.stringify({
            ts: Date.now(),
            nonce: randomUUID(),
            p: options.body,
          })
        ),
      });
    }
  } else if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  try {
    const requestHeaders = {
      ...headers,
      ...(options.headers ?? {}),
    };
    logDebugRequest({
      scope: "system",
      method,
      url: url.toString(),
      headers: requestHeaders,
      body: options.body,
    });
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body,
    });
    const raw = await response.text();
    const parsed = parseResponseRaw<T>(response, raw);
    if (!response.ok || !isSystemEnvelopeSuccess(parsed)) {
      recordNetworkError({
        requestScope: "system",
        method,
        requestUrl: url.toString(),
        requestPath: url.pathname,
        requestParams: options.body ?? Object.fromEntries(url.searchParams.entries()),
        httpStatus: response.status,
        businessCode: parsed.code,
        response: safeParseRaw(raw, parsed),
        errorMessage: parsed.msg || response.statusText || "system request failed",
      });
    }
    return parsed;
  } catch (error) {
    recordNetworkError({
      requestScope: "system",
      method,
      requestUrl: url.toString(),
      requestPath: url.pathname,
      requestParams: options.body ?? Object.fromEntries(url.searchParams.entries()),
      response: null,
      errorMessage: toErrorMessage(error),
    });
    throw error;
  }
}

function createEncryptionHeaders() {
  const headers: Record<string, string> = {};
  applyEncryptionHeaders(headers);
  return headers;
}

function applyEncryptionHeaders(headers: Record<string, string>) {
  const reqKey = randomFullKey();
  headers["x-pm-random"] = reqKey;
  headers["x-pm-enc-ver"] = "1";
  return reqKey;
}

function parseResponseRaw<T>(response: Response, raw: string): ApiResponse<T> {
  if (!raw) {
    return { success: response.ok, code: response.status, msg: response.statusText, data: null };
  }

  const parsed = JSON.parse(raw) as ApiResponse<T> | { isEnc?: boolean; encData?: string };
  if ("isEnc" in parsed && parsed.isEnc && typeof parsed.encData === "string") {
    const respKey = response.headers.get("x-pm-random");
    if (!respKey) throw new Error("encrypted response missing x-pm-random");
    return JSON.parse(decrypt(respKey, parsed.encData)) as ApiResponse<T>;
  }
  return parsed as ApiResponse<T>;
}

function parseGatewayResponseRaw<T>(response: Response, raw: string): T {
  if (!response.ok) {
    throw new Error(response.statusText || `gateway request failed: ${response.status}`);
  }
  if (!raw) {
    return null as T;
  }

  const parsed = JSON.parse(raw) as T | { isEnc?: boolean; encData?: string };
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "isEnc" in parsed &&
    parsed.isEnc &&
    typeof parsed.encData === "string"
  ) {
    const respKey = response.headers.get("x-pm-random");
    if (!respKey) throw new Error("encrypted gateway response missing x-pm-random");
    return JSON.parse(decrypt(respKey, parsed.encData)) as T;
  }
  return parsed as T;
}

function isSystemEnvelopeSuccess(response: ApiResponse<unknown>) {
  return response.success === true && response.code === 0 && response.data !== null;
}

function getExplicitGatewayBusinessError(response: unknown) {
  if (!response || typeof response !== "object") return null;
  const value = response as Record<string, unknown>;
  const code = typeof value.code === "number" || typeof value.code === "string" ? value.code : null;
  const status = typeof value.status === "number" || typeof value.status === "string" ? value.status : null;
  const message = typeof value.message === "string"
    ? value.message
    : typeof value.error === "string"
      ? value.error
      : "";

  if (value.success === false) {
    return { code, message: message || "gateway success=false" };
  }
  if (typeof code === "number" && code >= 400) {
    return { code, message: message || `gateway business code ${code}` };
  }
  if (typeof status === "number" && status >= 400) {
    return { code: status, message: message || `gateway business status ${status}` };
  }
  if (message && (message.toLowerCase().includes("error") || message.includes("失败"))) {
    return { code, message };
  }
  return null;
}

function recordNetworkError(input: {
  requestScope: "system" | "gateway";
  method: string;
  requestUrl: string;
  requestPath: string;
  requestParams?: unknown;
  httpStatus?: number | null;
  businessCode?: number | string | null;
  response?: unknown;
  errorMessage: string;
}) {
  try {
    getAppDatabase().addNetworkErrorRecord(input);
  } catch {
    // 记录失败不应反过来影响业务请求。
  }
}

function safeParseRaw(raw: string, fallback: unknown) {
  if (!raw) return fallback ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function buildDesktopDeviceReport(): DesktopDeviceReportRequest {
  return {
    clientId: getDesktopDeviceClientId(),
    deviceName: os.hostname() || `${process.platform}-${process.arch}`,
    hostname: os.hostname() || "",
    osName: os.type() || process.platform,
    osVersion: os.release() || "",
    platform: process.platform,
    arch: process.arch,
    appVersion: app.getVersion(),
    extras: {
      homedir: os.homedir(),
      totalMemory: os.totalmem(),
      cpus: os.cpus().length,
    },
  };
}

function getDesktopDeviceClientId() {
  const key = "desktop-device-client-id";
  const existing = getAppDatabase().getSetting<string>(key)?.value;
  if (typeof existing === "string" && existing.trim()) return existing.trim();
  const id = randomUUID();
  getAppDatabase().setSetting(key, id, 1);
  return id;
}

function isDesktopDeviceLocked(report: DesktopDeviceReportResult) {
  if (!report.locked) return false;
  return report.lockEndTime === null || report.lockEndTime > Date.now();
}

function desktopLockedMessage(report: DesktopDeviceReportResult) {
  if (!report.lockEndTime) return "当前 PC 设备已被封禁，App 服务不可用";
  return `当前 PC 设备已被封禁，解封时间：${new Date(report.lockEndTime).toLocaleString()}`;
}

function unwrapResponse<T>(response: ApiResponse<T>): T {
  if (!response.success || response.code !== 0 || response.data === null) {
    throw new Error(response.msg || "server request failed");
  }
  return response.data;
}

function emptyAccountSession(): AccountSession {
  return {
    token: "",
    expiresAt: 0,
    loggedIn: false,
    user: {
      id: "",
      username: "",
      email: "",
      avatar: "",
      avatarKey: "default",
      avatarUrl: "",
      createdAt: 0,
    },
  };
}

function normalizeAccountAuthResult(result: AccountAuthResult): AccountAuthResult {
  const avatarUrl = result.user.avatarUrl || result.user.avatar || "";
  const normalizedAvatarUrl = absoluteSystemUrl(avatarUrl);
  return {
    ...result,
    user: {
      ...result.user,
      avatarKey: result.user.avatarKey || "default",
      avatarUrl: normalizedAvatarUrl,
      avatar: normalizedAvatarUrl || result.user.avatar || "",
      createdAt: Number(result.user.createdAt || 0),
    },
  };
}

function absoluteSystemUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  return new URL(raw, getSystemBaseUrl()).toString();
}

function normalizeBaseUrl(raw: string) {
  const trimmed = raw.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function endpoint(endpoints: Record<string, string>, key: string, fallback: string) {
  const value = endpoints[key]?.trim();
  if (!value) return fallback;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toRuntimeEndpoints(endpoints: Record<string, string>): RuntimeEndpoints {
  const proxyBase = endpoint(endpoints, "proxyBaseUrl", "http://127.0.0.1:38888");
  return {
    kgServer: endpoint(endpoints, "kgBaseUrl", "http://127.0.0.1:31000"),
    wyServer: endpoint(endpoints, "wyBaseUrl", "http://127.0.0.1:31001"),
    kwServer: endpoint(endpoints, "kwBaseUrl", "http://127.0.0.1:31002"),
    kgProxy: endpoint(endpoints, "kgProxyUrl", `${proxyBase}/proxy/kg`),
    wyProxy: endpoint(endpoints, "wyProxyUrl", `${proxyBase}/proxy/wy`),
    kwProxy: endpoint(endpoints, "kwProxyUrl", `${proxyBase}/proxy/kw`),
  };
}
