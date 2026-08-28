import type { DiscoveryDocumentV1, ServiceOriginV1 } from "./types";

export const DISCOVERY_DOCUMENT_URL =
  "https://pisamusic.partialy.cn/pm-config/config-v1.json";

export const EMBEDDED_DISCOVERY_DOCUMENT: DiscoveryDocumentV1 = {
  schemaVersion: 1,
  configVersion: 2,
  publishedAt: "2026-08-28T12:00:00+08:00",
  desktop: {
    minimumSupportedVersion: "1.0.1",
    healthCheckPath: "/api/health",
    bootstrapPath: "/api/config/bootstrap",
    serviceOrigins: [
      {
        id: "primary",
        priority: 100,
        apiBaseUrl: "https://pm.yixivip.top",
        realtimeBaseUrl: "https://pm.yixivip.top",
      },
      {
        id: "backup",
        priority: 100,
        apiBaseUrl: "https://pm.hs.partialy.cn",
        realtimeBaseUrl: "https://pm.hs.partialy.cn",
      },
    ],
    updateFeedBaseUrls: [
      "https://pm.yixivip.top/api/config/desktop-updates/win32/x64",
      "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64",
    ],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${field} 必须是对象`);
  return value;
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${field} 必须是正整数`);
  }
  return value as number;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} 不能为空`);
  return value.trim();
}

function parseHttpsUrl(value: unknown, field: string): URL {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} 不能为空`);
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${field} 必须是有效 URL`);
  }
  if (url.protocol !== "https:") throw new Error(`${field} 必须使用 HTTPS`);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${field} 不能包含认证信息、查询参数或 hash`);
  }
  return url;
}

function normalizeHttpsOrigin(value: unknown, field: string): string {
  const url = parseHttpsUrl(value, field);
  if (url.pathname !== "/") throw new Error(`${field} 必须是 origin，不能包含路径`);
  return url.origin;
}

function normalizeHttpsFeedUrl(value: unknown, field: string): string {
  const url = parseHttpsUrl(value, field);
  return url.toString().replace(/\/+$/, "");
}

function parseRelativePath(value: unknown, field: string): string {
  const path = requireText(value, field);
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error(`${field} 必须是相对路径`);
  }
  const baseUrl = new URL("https://service-discovery.invalid/");
  let resolvedUrl: URL;
  try {
    resolvedUrl = new URL(path, baseUrl);
  } catch {
    throw new Error(`${field} 必须是相对路径`);
  }
  if (resolvedUrl.origin !== baseUrl.origin) {
    throw new Error(`${field} 必须是相对路径`);
  }
  return path;
}

function parseServiceOrigins(value: unknown): ServiceOriginV1[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("desktop.serviceOrigins 不能为空");
  }

  const ids = new Set<string>();
  return value.map((item, index) => {
    const field = `desktop.serviceOrigins[${index}]`;
    const origin = requireRecord(item, field);
    const id = requireText(origin.id, `${field}.id`);
    if (ids.has(id)) throw new Error(`desktop.serviceOrigins id 不能重复：${id}`);
    ids.add(id);

    const priority = origin.priority;
    if (typeof priority !== "number" || !Number.isInteger(priority) || !Number.isFinite(priority)) {
      throw new Error(`${field}.priority 必须是有限整数`);
    }

    return {
      id,
      priority,
      apiBaseUrl: normalizeHttpsOrigin(origin.apiBaseUrl, `${field}.apiBaseUrl`),
      realtimeBaseUrl: normalizeHttpsOrigin(origin.realtimeBaseUrl, `${field}.realtimeBaseUrl`),
    };
  });
}

function parseUpdateFeedBaseUrls(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("desktop.updateFeedBaseUrls 不能为空");
  }
  return value.map((item, index) =>
    normalizeHttpsFeedUrl(item, `desktop.updateFeedBaseUrls[${index}]`),
  );
}

export function parseDiscoveryDocument(input: unknown): DiscoveryDocumentV1 {
  const document = requireRecord(input, "discovery document");
  if (document.schemaVersion !== 1) throw new Error("schemaVersion 只支持 1");

  const configVersion = requirePositiveInteger(document.configVersion, "configVersion");
  const publishedAt = requireText(document.publishedAt, "publishedAt");
  if (Number.isNaN(Date.parse(publishedAt))) {
    throw new Error("publishedAt 必须是可解析日期");
  }

  const desktop = requireRecord(document.desktop, "desktop");
  const minimumSupportedVersion = requireText(
    desktop.minimumSupportedVersion,
    "desktop.minimumSupportedVersion",
  );
  if (!/^\d+\.\d+\.\d+$/.test(minimumSupportedVersion)) {
    throw new Error("desktop.minimumSupportedVersion 必须是 x.y.z");
  }

  return {
    schemaVersion: 1,
    configVersion,
    publishedAt,
    desktop: {
      minimumSupportedVersion,
      healthCheckPath: parseRelativePath(desktop.healthCheckPath, "desktop.healthCheckPath"),
      bootstrapPath: parseRelativePath(desktop.bootstrapPath, "desktop.bootstrapPath"),
      serviceOrigins: parseServiceOrigins(desktop.serviceOrigins),
      updateFeedBaseUrls: parseUpdateFeedBaseUrls(desktop.updateFeedBaseUrls),
    },
  };
}

export function sortServiceOrigins(document: DiscoveryDocumentV1): ServiceOriginV1[] {
  return document.desktop.serviceOrigins
    .map((origin, index) => ({ ...origin, index }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ index: _index, ...origin }) => origin);
}
