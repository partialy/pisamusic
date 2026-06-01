import { signGatewayUrl } from "../system/gatewaySigner";
import { getGatewaySignConfigCached } from "../system/systemClient";
import { decrypt } from "../system/encryption";
import { logDebugRequest } from "../utils/requestDebug";
import { UserCookieStore } from "./cookieStore";

export type CookieRequestResult<T = unknown> = {
  code: number;
  ok: boolean;
  data: T;
  raw: string;
  cookieHeaderForNextRequest: string;
};

export type SignedCookieGatewayOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  cookie?: string;
  store?: UserCookieStore;
};

export async function requestSignedGatewayWithCookie<T>(
  rawUrl: string,
  options: SignedCookieGatewayOptions = {}
): Promise<CookieRequestResult<T>> {
  const method = options.method ?? "GET";
  const body = options.body === undefined ? "" : JSON.stringify(options.body);
  const currentCookie = options.cookie ?? options.store?.getHeader() ?? "";
  const signed = signGatewayUrl(method, rawUrl, body, await getGatewaySignConfigCached());
  const requestHeaders = {
    ...signed.headers,
    ...(body ? { "content-type": "application/json" } : {}),
    ...(currentCookie ? { Cookie: currentCookie } : {}),
  };
  logDebugRequest({
    scope: "gateway:cookie",
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
  const mergedCookie = mergeCookieHeaders(currentCookie, getSetCookieLines(response));
  if (options.store && mergedCookie && mergedCookie !== currentCookie) {
    options.store.updateFromHeader(mergedCookie);
  }
  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText || "gateway request failed"}${raw ? `: ${raw}` : ""}`
    );
  }
  return {
    code: response.status,
    ok: response.ok,
    data: parseGatewayResponseRaw<T>(response, raw),
    raw,
    cookieHeaderForNextRequest: mergedCookie,
  };
}

export function buildUrl(
  baseUrl: string,
  pathname: string,
  params: Record<string, string | number | undefined | null>
) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(pathname.replace(/^\//, ""), normalizedBase);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function parseGatewayResponseRaw<T>(response: Response, raw: string): T {
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

function mergeCookieHeaders(previous: string, setCookieLines: string[]) {
  const map = new Map<string, string>();
  mergeHeaderIntoMap(previous, map);
  setCookieLines.forEach((line) => {
    const firstPart = line.split(";")[0]?.trim() ?? "";
    const eq = firstPart.indexOf("=");
    if (eq <= 0) return;
    map.set(firstPart.slice(0, eq).trim(), firstPart.slice(eq + 1).trim());
  });
  return [...map.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

function mergeHeaderIntoMap(header: string, map: Map<string, string>) {
  header.split(";").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) return;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  });
}

function getSetCookieLines(response: Response) {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };
  const explicit = headers.getSetCookie?.();
  if (explicit?.length) return explicit;
  const raw = headers.raw?.()["set-cookie"];
  if (raw?.length) return raw;
  const collapsed = response.headers.get("set-cookie");
  if (!collapsed) return [];
  return collapsed.split(/,(?=\s*[^;,=\s]+=[^;,]*)/).map((item) => item.trim());
}
