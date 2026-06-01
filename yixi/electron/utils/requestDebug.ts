import { app } from "electron";

type DebugRequestInput = {
  scope: string;
  method: string;
  url: string;
  headers?: Record<string, unknown>;
  body?: unknown;
};

export function logDebugRequest(input: DebugRequestInput) {
  if (!isDevRuntime()) return;
  console.log("----- Electron Request Debug -----", {
    scope: input.scope,
    method: input.method,
    url: input.url,
    headers: sanitizeHeaders(input.headers),
    body: input.body,
  });
}

function isDevRuntime() {
  return process.env.NODE_ENV === "development" || !app.isPackaged;
}

function sanitizeHeaders(headers?: Record<string, unknown>) {
  if (!headers) return undefined;
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "cookie" || lowerKey === "authorization" || lowerKey.includes("token")) {
        return [key, redact(value)];
      }
      return [key, value];
    })
  );
}

function redact(value: unknown) {
  if (value === undefined || value === null || value === "") return value;
  return "[redacted]";
}
