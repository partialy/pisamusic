import { protocol } from "electron";
import { resolvePlayableUrl } from "../music/musicService";
import { logger } from "../utils/logger";
import type { MediaCacheTrack } from "./types";
import { MediaCacheManager } from "./mediaCacheManager";

const MEDIA_CACHE_SCHEME = "pisacache";
let manager: MediaCacheManager | null = null;
let protocolHandled = false;
let schemeRegistered = false;

export function registerMediaCacheScheme() {
  if (schemeRegistered) return;
  protocol.registerSchemesAsPrivileged([{
    scheme: MEDIA_CACHE_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  }]);
  schemeRegistered = true;
}

export async function setupMediaCacheProtocol() {
  try {
    if (!manager) {
      manager = new MediaCacheManager();
      await manager.initialize();
    }
    if (!protocolHandled) {
      protocol.handle(MEDIA_CACHE_SCHEME, (request) => requireManager().handleRequest(request));
      protocolHandled = true;
    }
  } catch (error) {
    manager?.close();
    manager = null;
    logger.warn("媒体缓存初始化失败，已回退为在线播放", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function prepareMediaPlaybackUrl(track: MediaCacheTrack) {
  if (!manager) return resolvePlayableUrl(track);
  try {
    return await manager.preparePlaybackUrl(track);
  } catch (error) {
    logger.warn("媒体缓存准备失败，已回退为在线播放", {
      message: error instanceof Error ? error.message : String(error),
    });
    return resolvePlayableUrl(track);
  }
}

export function getMediaCacheStatus() {
  return manager ? manager.getStatus() : Promise.resolve(emptyStatus());
}

export async function refreshMediaCachePolicy() {
  if (!manager) await setupMediaCacheProtocol();
  return manager ? manager.refreshPolicy() : emptyStatus();
}

export function clearMediaCache() {
  return manager ? manager.clear() : Promise.resolve(emptyStatus());
}

export function closeMediaCache() {
  manager?.close();
  manager = null;
}

function requireManager() {
  if (!manager) throw new Error("媒体缓存尚未初始化");
  return manager;
}

function emptyStatus() {
  return {
    enabled: false,
    directory: "",
    limitBytes: 0,
    usedBytes: 0,
    entryCount: 0,
    readyCount: 0,
    writingCount: 0,
    fallbackDirectory: true,
  };
}
