import type { NetworkErrorRecordInput } from "../database/types";

export const FAULT_REPORT_LIMITS = {
  url: 2048,
  params: 4096,
  response: 4096,
  error: 2048,
  stack: 4096,
} as const;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "setcookie",
  "token",
  "accesstoken",
  "refreshtoken",
  "password",
  "currentpassword",
  "newpassword",
  "code",
  "secret",
  "signature",
  "sign",
  "s",
  "xpmrandom",
]);

export function sanitizeNetworkErrorInput(input: NetworkErrorRecordInput): NetworkErrorRecordInput {
  return {
    ...input,
    method: limitText(input.method, 16),
    requestUrl: sanitizeUrl(input.requestUrl),
    requestPath: limitText(input.requestPath, 128),
    requestParams: sanitizeValue(input.requestParams),
    response: sanitizeValue(input.response),
    errorMessage: limitText(input.errorMessage, FAULT_REPORT_LIMITS.error),
  };
}

export function sanitizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.username) url.username = "[REDACTED]";
    if (url.password) url.password = "[REDACTED]";
    [...url.searchParams.keys()].forEach((key) => {
      if (isSensitiveKey(key)) url.searchParams.set(key, "[REDACTED]");
    });
    return limitText(url.toString(), FAULT_REPORT_LIMITS.url);
  } catch {
    return limitText(raw, FAULT_REPORT_LIMITS.url);
  }
}

export function sanitizeValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") return limitText(value, FAULT_REPORT_LIMITS.response);
  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, seen));
  const output: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    output[key] = isSensitiveKey(key) ? "[REDACTED]" : sanitizeValue(item, seen);
  });
  return output;
}

export function sanitizedJson(value: unknown, maxLength: number): string {
  try {
    return limitText(JSON.stringify(sanitizeValue(value ?? null)), maxLength);
  } catch {
    return "[Unserializable]";
  }
}

export function limitText(value: unknown, maxLength: number): string {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}

function isSensitiveKey(key: string) {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""));
}
