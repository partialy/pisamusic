import { app } from "electron";
import { getAppDatabase } from "../../database";
import { logger } from "../../utils/logger";
import { DISCOVERY_DOCUMENT_URL } from "./config";
import { resolveServiceDiscovery, type ResolveServiceDiscoveryOptions } from "./resolver";
import type { DiscoveryDocumentV1, ServiceDiscoverySnapshot } from "./types";

const DISCOVERY_TIMEOUT_MS = 5_000;
const HEALTH_TIMEOUT_MS = 3_000;

let snapshot: ServiceDiscoverySnapshot | null = null;
let pending: Promise<ServiceDiscoverySnapshot> | null = null;
let queuedRefresh: Promise<ServiceDiscoverySnapshot> | null = null;
let backgroundRefreshTriggered = false;

function createResolveInput() {
  return {
    mode: app.isPackaged ? "production" as const : "development" as const,
    explicitBaseUrl: String(
      process.env.PISA_SERVER_URL ?? process.env.PM_SERVER_URL ?? "",
    ).trim(),
  };
}

function createDependencies(minimumConfigVersion: number) {
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
      getAppDatabase().getServiceDiscoveryCache<unknown>()?.document ?? null,
    writeCachedDocument: (document: DiscoveryDocumentV1) => {
      if (document.configVersion < minimumConfigVersion) return;
      try {
        getAppDatabase().setServiceDiscoveryCache(document, document.configVersion);
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

async function resolveSnapshot(
  options: ResolveServiceDiscoveryOptions = {},
): Promise<ServiceDiscoverySnapshot> {
  const minimumConfigVersion = snapshot?.configVersion ?? 0;
  const nextSnapshot = await resolveServiceDiscovery(
    createResolveInput(),
    createDependencies(minimumConfigVersion),
    options,
  );
  const currentSnapshot = snapshot;
  if (currentSnapshot && nextSnapshot.configVersion < currentSnapshot.configVersion) {
    return currentSnapshot;
  }
  logger.info("服务发现解析完成", {
    source: nextSnapshot.source,
    configVersion: nextSnapshot.configVersion,
    originId: nextSnapshot.originId,
    origin: nextSnapshot.apiBaseUrl,
  });
  return nextSnapshot;
}

function startResolution(
  options: ResolveServiceDiscoveryOptions = {},
): Promise<ServiceDiscoverySnapshot> {
  const task = resolveSnapshot(options);
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

/**
 * 冷启动 SWR 服务发现：优先命中有效本地缓存并跳过健康探测，同时在后台静默刷新配置。
 */
export function initializeServiceDiscovery(): Promise<ServiceDiscoverySnapshot> {
  if (snapshot) return Promise.resolve(snapshot);
  if (pending) return pending;

  const task = startResolution({
    preferCacheFirst: true,
    skipHealthProbe: true,
  }).then((resolved) => {
    if (resolved.source === "cache" && !backgroundRefreshTriggered) {
      backgroundRefreshTriggered = true;
      void refreshServiceDiscoveryInBackground();
    }
    return resolved;
  });
  return task;
}

/**
 * 后台静默刷新服务发现文档：跳过额外健康探测避免占用启动期资源，新配置自动写回缓存供后续使用。
 */
export function refreshServiceDiscoveryInBackground(): Promise<ServiceDiscoverySnapshot> {
  if (!pending) {
    return startResolution({ preferCacheFirst: false, skipHealthProbe: true });
  }
  return refreshServiceDiscovery({ skipHealthProbe: true });
}

export function refreshServiceDiscovery(
  options: ResolveServiceDiscoveryOptions = {},
): Promise<ServiceDiscoverySnapshot> {
  if (!pending) return startResolution(options);
  if (queuedRefresh) return queuedRefresh;

  const activeResolution = pending;
  const runNext = () => startResolution(options);
  const task = activeResolution.then(runNext, runNext);
  queuedRefresh = task;
  const clearQueuedRefresh = () => {
    if (queuedRefresh === task) queuedRefresh = null;
  };
  void task.then(clearQueuedRefresh, clearQueuedRefresh);
  return task;
}
