import {
  EMBEDDED_DISCOVERY_DOCUMENT,
  parseDiscoveryDocument,
  sortServiceOrigins,
} from "./config";
import type {
  DiscoveryDocumentV1,
  DiscoverySource,
  ServiceDiscoveryDependencies,
  ServiceDiscoverySnapshot,
  ServiceOriginV1,
} from "./types";

const DEVELOPMENT_BASE_URL = "http://127.0.0.1:53380";

export type ResolveServiceDiscoveryInput = {
  mode: "development" | "production";
  explicitBaseUrl: string;
};

function normalizeExplicitBaseUrl(value: string, mode: ResolveServiceDiscoveryInput["mode"]): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("PISA_SERVER_URL 必须是有效 URL");
  }

  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
  if (url.protocol !== "https:" && !(mode === "development" && isLocalHttp)) {
    throw new Error("PISA_SERVER_URL 仅允许 HTTPS，开发环境可使用 localhost HTTP");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("PISA_SERVER_URL 不能包含认证信息、查询参数或 hash");
  }
  if (url.pathname !== "/") {
    throw new Error("PISA_SERVER_URL 必须是 origin，不能包含路径");
  }
  return url.origin;
}

function createSnapshot(
  source: DiscoverySource,
  document: DiscoveryDocumentV1,
  origin: ServiceOriginV1,
): ServiceDiscoverySnapshot {
  return {
    source,
    schemaVersion: document.schemaVersion,
    configVersion: document.configVersion,
    publishedAt: document.publishedAt,
    minimumSupportedVersion: document.desktop.minimumSupportedVersion,
    originId: origin.id,
    apiBaseUrl: origin.apiBaseUrl,
    realtimeBaseUrl: origin.realtimeBaseUrl,
    healthCheckPath: document.desktop.healthCheckPath,
    bootstrapPath: document.desktop.bootstrapPath,
    updateFeedBaseUrls: [...document.desktop.updateFeedBaseUrls],
  };
}

function createOverrideSnapshot(
  source: "environment" | "development",
  apiBaseUrl: string,
): ServiceDiscoverySnapshot {
  return createSnapshot(source, EMBEDDED_DISCOVERY_DOCUMENT, {
    id: source,
    priority: 0,
    apiBaseUrl,
    realtimeBaseUrl: apiBaseUrl,
  });
}

async function safelyParse(
  getter: () => Promise<unknown> | unknown,
): Promise<DiscoveryDocumentV1 | null> {
  try {
    return parseDiscoveryDocument(await getter());
  } catch {
    return null;
  }
}

async function selectHealthyOrigin(
  document: DiscoveryDocumentV1,
  probeHealth: ServiceDiscoveryDependencies["probeHealth"],
): Promise<ServiceOriginV1> {
  const origins = sortServiceOrigins(document);
  const [firstOrigin] = origins;

  for (const origin of origins) {
    const healthUrl = new URL(
      document.desktop.healthCheckPath,
      `${origin.apiBaseUrl}/`,
    ).toString();
    try {
      if (await probeHealth(healthUrl)) return origin;
    } catch {
      // 单个候选探测失败时继续尝试下一个候选。
    }
  }

  return firstOrigin;
}

export async function resolveServiceDiscovery(
  input: ResolveServiceDiscoveryInput,
  dependencies: ServiceDiscoveryDependencies,
): Promise<ServiceDiscoverySnapshot> {
  const explicitBaseUrl = input.explicitBaseUrl.trim();
  if (explicitBaseUrl) {
    return createOverrideSnapshot(
      "environment",
      normalizeExplicitBaseUrl(explicitBaseUrl, input.mode),
    );
  }

  if (input.mode === "development") {
    return createOverrideSnapshot("development", DEVELOPMENT_BASE_URL);
  }

  const remote = await safelyParse(dependencies.fetchRemoteDocument);
  const cache = await safelyParse(dependencies.readCachedDocument);
  const useCache = Boolean(cache && (!remote || remote.configVersion < cache.configVersion));
  const selectedDocument = useCache
    ? cache!
    : remote ?? cache ?? EMBEDDED_DISCOVERY_DOCUMENT;
  const source: DiscoverySource = useCache
    ? "cache"
    : remote
      ? "remote"
      : cache
        ? "cache"
        : "embedded";

  if (source === "remote") {
    try {
      dependencies.writeCachedDocument(selectedDocument);
    } catch {
      // 写缓存失败不得影响本次已验证的远程服务发现结果。
    }
  }

  const origin = await selectHealthyOrigin(selectedDocument, dependencies.probeHealth);
  return createSnapshot(source, selectedDocument, origin);
}
