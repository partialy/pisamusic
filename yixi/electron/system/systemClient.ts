import { randomUUID } from "node:crypto";
import { getAppDatabase } from "../database";
import { decrypt, encrypt, randomFullKey } from "./encryption";
import { signGatewayUrl } from "./gatewaySigner";
import type {
  Announcement,
  ApiResponse,
  BootstrapConfig,
  FeedbackPayload,
  GatewaySignConfig,
  RuntimeEndpoints,
} from "./types";

const DEFAULT_SERVER_URL = "http://127.0.0.1:53380";
const DEFAULT_GATEWAY_SIGN: GatewaySignConfig = {
  secret: "partialypartialypartialypartialy",
  as: "yixivip",
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  encrypted?: boolean;
};

let cachedBootstrap: BootstrapConfig | null = null;
let bootstrapPromise: Promise<BootstrapConfig> | null = null;

export function getSystemBaseUrl() {
  return normalizeBaseUrl(process.env.PISA_SERVER_URL || process.env.PM_SERVER_URL || DEFAULT_SERVER_URL);
}

export async function refreshBootstrap() {
  const response = await requestSystem<BootstrapConfig>("/api/config/bootstrap");
  cachedBootstrap = unwrapResponse(response);
  return cachedBootstrap;
}

export async function getBootstrap() {
  return ensureBootstrap();
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

export async function submitFeedback(payload: FeedbackPayload) {
  const form = new FormData();
  form.set("feedback_type", payload.feedback_type);
  form.set("description", payload.description);
  if (payload.contact) form.set("contact", payload.contact);
  form.set("device", JSON.stringify(payload.device ?? {}));
  const url = new URL("/api/feedback", getSystemBaseUrl());
  let recorded = false;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: createEncryptionHeaders(),
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
    const response = await fetch(signed.url, {
      method,
      headers: {
        ...signed.headers,
        ...(body ? { "content-type": "application/json" } : {}),
      },
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

async function requestSystem<T>(path: string, options: RequestOptions = {}) {
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
    const response = await fetch(url, { method, headers, body });
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

function unwrapResponse<T>(response: ApiResponse<T>): T {
  if (!response.success || response.code !== 0 || response.data === null) {
    throw new Error(response.msg || "server request failed");
  }
  return response.data;
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
