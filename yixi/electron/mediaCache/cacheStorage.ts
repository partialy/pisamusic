import { randomUUID } from "node:crypto";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MANAGED_DIRECTORY = ".pisamusic-cache";
const CACHE_VERSION = "v1";

export type ManagedCacheLocation = {
  directory: string;
  fallbackDirectory: boolean;
};

export async function resolveManagedCacheRoot(
  configuredDirectory: string,
  defaultDirectory: string,
): Promise<ManagedCacheLocation> {
  const configured = configuredDirectory.trim();
  if (configured) {
    try {
      const directory = managedRoot(path.resolve(configured));
      await ensureWritableDirectory(directory);
      return { directory, fallbackDirectory: false };
    } catch {
      // 用户目录不可用时使用应用默认目录，缓存失败不能阻断在线播放。
    }
  }
  const directory = managedRoot(path.resolve(defaultDirectory));
  await ensureWritableDirectory(directory);
  return { directory, fallbackDirectory: Boolean(configured) };
}

export async function createSegmentTempPath(root: string, cacheKey: string, startByte: number) {
  const directory = segmentDirectory(root, cacheKey);
  await mkdir(directory, { recursive: true });
  return path.join(directory, `${startByte}.part-${randomUUID()}`);
}

export async function finalizeSegmentFile(
  tempPath: string,
  root: string,
  cacheKey: string,
  startByte: number,
  endByte: number,
) {
  const finalPath = path.join(segmentDirectory(root, cacheKey), `${startByte}-${endByte}.bin`);
  await rm(finalPath, { force: true });
  await rename(tempPath, finalPath);
  return finalPath;
}

export async function removeManagedFiles(filePaths: string[]) {
  let removed = 0;
  for (const filePath of new Set(filePaths)) {
    if (!isManagedCacheFile(filePath)) continue;
    try {
      await rm(filePath, { force: true });
      removed += 1;
    } catch {
      // 索引已经丢弃的文件允许下次启动清理，不能让单文件占用阻断整体清理。
    }
  }
  return removed;
}

export function isManagedCacheFile(filePath: string) {
  const normalized = path.resolve(filePath);
  const marker = `${path.sep}${MANAGED_DIRECTORY}${path.sep}${CACHE_VERSION}${path.sep}`;
  return normalized.includes(marker) && path.basename(normalized).endsWith(".bin");
}

function managedRoot(baseDirectory: string) {
  return path.join(baseDirectory, MANAGED_DIRECTORY, CACHE_VERSION);
}

function segmentDirectory(root: string, cacheKey: string) {
  if (!/^[a-f0-9]{64}$/.test(cacheKey)) throw new Error("缓存 key 无效");
  return path.join(root, "segments", cacheKey.slice(0, 2), cacheKey);
}

async function ensureWritableDirectory(directory: string) {
  await mkdir(directory, { recursive: true });
  await access(directory);
  const probePath = path.join(directory, `.write-probe-${randomUUID()}`);
  await writeFile(probePath, "");
  await rm(probePath, { force: true });
}
