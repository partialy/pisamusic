import { randomUUID } from "node:crypto";
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

export function getSystemBaseUrl() {
  return normalizeBaseUrl(process.env.PISA_SERVER_URL || process.env.PM_SERVER_URL || DEFAULT_SERVER_URL);
}

export async function refreshBootstrap() {
  const response = await requestSystem<BootstrapConfig>("/api/config/bootstrap");
  cachedBootstrap = unwrapResponse(response);
  return cachedBootstrap;
}

export async function getBootstrap() {
  return refreshBootstrap();
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
  const response = await fetch(new URL("/api/feedback", getSystemBaseUrl()), {
    method: "POST",
    body: form,
  });
  return unwrapResponse(await parseResponse<{ id: string; createdAt: string }>(response));
}

export async function requestSignedGateway<T>(
  rawUrl: string,
  options: Omit<RequestOptions, "encrypted"> = {}
) {
  const bootstrap = cachedBootstrap ?? (await refreshBootstrap());
  const signConfig = bootstrap.gatewaySign ?? DEFAULT_GATEWAY_SIGN;
  const method = options.method ?? "GET";
  const body = options.body === undefined ? "" : JSON.stringify(options.body);
  const signed = signGatewayUrl(method, rawUrl, body, signConfig);
  const response = await fetch(signed.url, {
    method,
    headers: {
      ...signed.headers,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body || undefined,
  });
  return parseResponse<T>(response);
}

export function getRuntimeEndpoints(): RuntimeEndpoints {
  return toRuntimeEndpoints(cachedBootstrap?.endpoints ?? {});
}

export async function getRuntimeEndpointsFresh() {
  try {
    const bootstrap = await refreshBootstrap();
    return toRuntimeEndpoints(bootstrap.endpoints);
  } catch {
    return toRuntimeEndpoints(cachedBootstrap?.endpoints ?? {});
  }
}

async function requestSystem<T>(path: string, options: RequestOptions = {}) {
  const url = new URL(path, getSystemBaseUrl());
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};
  let body: string | undefined;

  if (options.encrypted) {
    const reqKey = randomFullKey();
    headers["x-pm-random"] = reqKey;
    headers["x-pm-enc-ver"] = "1";
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

  const response = await fetch(url, { method, headers, body });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const raw = await response.text();
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
