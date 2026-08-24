import { app } from "electron";
import { getAppDatabase } from "../../database";
import { logger } from "../../utils/logger";
import { DISCOVERY_DOCUMENT_URL } from "./config";
import { resolveServiceDiscovery } from "./resolver";
import type { DiscoveryDocumentV1, ServiceDiscoverySnapshot } from "./types";

const CACHE_KEY = "desktop-service-discovery-cache-v1";
const DISCOVERY_TIMEOUT_MS = 5_000;
const HEALTH_TIMEOUT_MS = 3_000;

let snapshot: ServiceDiscoverySnapshot | null = null;
let pending: Promise<ServiceDiscoverySnapshot> | null = null;

function createResolveInput() {
  return {
    mode: app.isPackaged ? "production" as const : "development" as const,
    explicitBaseUrl: String(
      process.env.PISA_SERVER_URL ?? process.env.PM_SERVER_URL ?? "",
    ).trim(),
  };
}

function createDependencies() {
  return {
    fetchRemoteDocument: async () => {
      const response = await fetch(DISCOVERY_DOCUMENT_URL, {
        method: "GET",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`服务发现配置请求失败：HTTP ${response.status}`);
      return response.json();
    },
    readCachedDocument: () =>
      getAppDatabase().getSetting<unknown>(CACHE_KEY)?.value ?? null,
    writeCachedDocument: (document: DiscoveryDocumentV1) => {
      try {
        getAppDatabase().setSetting(CACHE_KEY, document, document.configVersion);
      } catch {
        logger.warn("服务发现缓存写入失败", { configVersion: document.configVersion });
      }
    },
    probeHealth: async (url: string) => {
      try {
        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

async function resolveSnapshot(): Promise<ServiceDiscoverySnapshot> {
  const nextSnapshot = await resolveServiceDiscovery(createResolveInput(), createDependencies());
  logger.info("服务发现解析完成", {
    source: nextSnapshot.source,
    configVersion: nextSnapshot.configVersion,
    originId: nextSnapshot.originId,
    origin: nextSnapshot.apiBaseUrl,
  });
  return nextSnapshot;
}

function startResolution(): Promise<ServiceDiscoverySnapshot> {
  const task = resolveSnapshot();
  pending = task;
  void task.then(
    (nextSnapshot) => {
      if (pending === task) snapshot = nextSnapshot;
    },
    () => undefined,
  ).finally(() => {
    if (pending === task) pending = null;
  });
  return task;
}

export function getServiceDiscoverySnapshot(): ServiceDiscoverySnapshot {
  if (!snapshot) throw new Error("服务发现尚未初始化");
  return snapshot;
}

export function initializeServiceDiscovery(): Promise<ServiceDiscoverySnapshot> {
  if (snapshot) return Promise.resolve(snapshot);
  return pending ?? startResolution();
}

export function refreshServiceDiscovery(): Promise<ServiceDiscoverySnapshot> {
  return startResolution();
}
