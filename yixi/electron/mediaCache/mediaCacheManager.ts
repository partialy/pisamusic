import { createReadStream, createWriteStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { net } from "electron";
import { getAppDataPath, getDatabasePath } from "../core/appPaths";
import { getAppDatabase } from "../database";
import { resolvePlayableUrl } from "../music/musicService";
import { logger } from "../utils/logger";
import { createMediaCacheKey, getMediaCacheIdentity } from "./cacheKey";
import { MediaCacheRepository } from "./cacheRepository";
import {
  createSegmentTempPath,
  finalizeSegmentFile,
  isManagedCacheFile,
  removeManagedFiles,
  resolveManagedCacheRoot,
} from "./cacheStorage";
import { formatByteRange, parseByteRange, parseContentRange } from "./range";
import type {
  ByteRange,
  MediaCacheDescriptor,
  MediaCachePolicy,
  MediaCacheSegment,
  MediaCacheStatus,
  MediaCacheTrack,
} from "./types";

type LocalCacheSetting = {
  cacheDirectory?: string;
  cacheLimitGb?: number;
};

type RemoteRange = {
  start: number;
  end: number | null;
  total: number;
};

const BYTES_PER_GB = 1024 ** 3;
const ORIGIN_URL_TTL_MS = 5 * 60_000;
const MAX_DESCRIPTORS = 500;

export class MediaCacheManager {
  private readonly repository: MediaCacheRepository;
  private readonly descriptors = new Map<string, MediaCacheDescriptor>();
  private readonly inflightWrites = new Map<string, Promise<void>>();
  private policy: MediaCachePolicy | null = null;
  private cacheEpoch = 0;
  private closed = false;

  constructor() {
    this.repository = new MediaCacheRepository(getDatabasePath("media-cache-index.db"));
  }

  async initialize() {
    await this.refreshPolicy();
  }

  async preparePlaybackUrl(track: MediaCacheTrack) {
    if (track.source === "local") return resolvePlayableUrl(track);
    if (!isCacheableSource(track.source)) return resolvePlayableUrl(track);

    const policy = await this.getPolicy();
    if (!policy.enabled) return resolvePlayableUrl(track);

    const identity = getMediaCacheIdentity(track);
    const cacheKey = createMediaCacheKey(track);
    this.repository.upsertEntry({ cacheKey, ...identity });
    this.descriptors.delete(cacheKey);
    this.descriptors.set(cacheKey, {
      cacheKey,
      track: { ...track },
      originUrl: "",
      originResolvedAt: 0,
    });
    this.trimDescriptors();
    return `pisacache://media/${cacheKey}`;
  }

  async handleRequest(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const cacheKey = parseCacheKey(request.url);
    if (!cacheKey) return new Response("Not Found", { status: 404 });

    try {
      const entry = this.repository.getEntry(cacheKey);
      const rangeHeader = request.headers.get("range");
      const range = parseByteRange(rangeHeader, entry?.totalBytes ?? 0);
      if (rangeHeader && !range) {
        return new Response(null, {
          status: 416,
          headers: entry?.totalBytes
            ? { "content-range": `bytes */${entry.totalBytes}` }
            : undefined,
        });
      }

      const localResponse = await this.tryServeLocal(cacheKey, range, request.method === "HEAD");
      if (localResponse) return localResponse;

      const descriptor = this.descriptors.get(cacheKey);
      if (!descriptor) return new Response("Cache descriptor expired", { status: 404 });
      return this.fetchAndCache(request, descriptor, range);
    } catch (error) {
      logger.warn("媒体缓存协议处理失败", {
        message: error instanceof Error ? error.message : String(error),
      });
      return new Response("Media cache unavailable", { status: 502 });
    }
  }

  async getStatus(): Promise<MediaCacheStatus> {
    const policy = await this.getPolicy();
    const stats = this.repository.getStats();
    return {
      enabled: policy.enabled,
      directory: policy.directory,
      limitBytes: policy.limitBytes,
      usedBytes: stats.usedBytes,
      entryCount: stats.entryCount,
      readyCount: stats.readyCount,
      writingCount: this.inflightWrites.size,
      fallbackDirectory: policy.fallbackDirectory,
    };
  }

  async refreshPolicy() {
    this.cacheEpoch += 1;
    const setting = getAppDatabase().getSetting<LocalCacheSetting>("local-setting")?.value;
    const configuredDirectory = typeof setting?.cacheDirectory === "string"
      ? setting.cacheDirectory.trim()
      : "";
    const limitGb = normalizeLimitGb(setting?.cacheLimitGb);
    const location = await resolveManagedCacheRoot(
      configuredDirectory,
      getAppDataPath("media-cache"),
    );
    this.policy = {
      enabled: limitGb > 0,
      configuredDirectory,
      directory: location.directory,
      limitBytes: Math.round(limitGb * BYTES_PER_GB),
      fallbackDirectory: location.fallbackDirectory,
    };
    await this.evictIfNeeded();
    return this.getStatus();
  }

  async clear() {
    this.cacheEpoch += 1;
    const filePaths = this.repository.clearAll();
    await removeManagedFiles(filePaths);
    return this.getStatus();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.cacheEpoch += 1;
    this.repository.close();
  }

  private async tryServeLocal(cacheKey: string, range: ByteRange | null, headOnly: boolean) {
    const entry = this.repository.getEntry(cacheKey);
    if (!entry || entry.totalBytes <= 0) return null;

    const requested = range ?? (entry.status === "ready"
      ? { start: 0, end: entry.totalBytes - 1 }
      : null);
    if (!requested || requested.end === null) return null;
    const segments = this.repository.findCoveringSegments(cacheKey, requested.start, requested.end);
    if (!segments.length || segments.some((segment) => !isManagedCacheFile(segment.filePath))) {
      return null;
    }

    try {
      await Promise.all(segments.map((segment) => stat(segment.filePath)));
      this.repository.touchHit(cacheKey);
      const headers = createMediaHeaders(
        entry.mimeType,
        requested.end - requested.start + 1,
        range ? { start: requested.start, end: requested.end, total: entry.totalBytes } : null,
      );
      return new Response(
        headOnly ? null : createLocalRangeStream(segments, requested.start, requested.end),
        { status: range ? 206 : 200, headers },
      );
    } catch {
      const staleFiles = this.repository.deleteEntry(cacheKey);
      await removeManagedFiles(staleFiles);
      return null;
    }
  }

  private async fetchAndCache(
    request: Request,
    descriptor: MediaCacheDescriptor,
    requestedRange: ByteRange | null,
  ) {
    const signature = `${descriptor.cacheKey}:${request.headers.get("range") || "full"}`;
    const activeWrite = this.inflightWrites.get(signature);
    if (activeWrite) {
      await activeWrite.catch(() => undefined);
      const cached = await this.tryServeLocal(
        descriptor.cacheKey,
        requestedRange,
        request.method === "HEAD",
      );
      if (cached) return cached;
    }

    let response = await this.fetchOrigin(descriptor, requestedRange, request.method);
    if (response.status === 401 || response.status === 403) {
      descriptor.originUrl = "";
      response = await this.fetchOrigin(descriptor, requestedRange, request.method);
    }
    if (request.method === "HEAD" || !response.ok || !response.body) return response;

    const policy = await this.getPolicy();
    if (!policy.enabled) return response;
    const [playerBody, cacheBody] = response.body.tee();
    const remoteRange = resolveRemoteRange(response, requestedRange);
    const epoch = this.cacheEpoch;
    const persistTask = this.persistRemoteBody(
      descriptor,
      cacheBody,
      remoteRange,
      response.headers.get("content-type") || "application/octet-stream",
      policy.directory,
      epoch,
    ).catch((error) => {
      logger.warn("媒体缓存分片写入失败", {
        cacheKey: descriptor.cacheKey,
        message: error instanceof Error ? error.message : String(error),
      });
    }).finally(() => {
      if (this.inflightWrites.get(signature) === persistTask) {
        this.inflightWrites.delete(signature);
      }
    });
    this.inflightWrites.set(signature, persistTask);

    return new Response(playerBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  private async fetchOrigin(
    descriptor: MediaCacheDescriptor,
    requestedRange: ByteRange | null,
    method: string,
  ) {
    const originUrl = await this.getOriginUrl(descriptor);
    const headers = new Headers();
    if (requestedRange) headers.set("range", formatByteRange(requestedRange));
    return net.fetch(originUrl, {
      method,
      headers,
      redirect: "follow",
    });
  }

  private async getOriginUrl(descriptor: MediaCacheDescriptor) {
    if (descriptor.originUrl && Date.now() - descriptor.originResolvedAt < ORIGIN_URL_TTL_MS) {
      return descriptor.originUrl;
    }
    const originUrl = await resolvePlayableUrl(descriptor.track);
    if (!originUrl) throw new Error("播放地址为空");
    const parsed = new URL(originUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("播放地址协议不受支持");
    }
    descriptor.originUrl = originUrl;
    descriptor.originResolvedAt = Date.now();
    return originUrl;
  }

  private async persistRemoteBody(
    descriptor: MediaCacheDescriptor,
    body: ReadableStream<Uint8Array>,
    remoteRange: RemoteRange,
    mimeType: string,
    root: string,
    epoch: number,
  ) {
    const tempPath = await createSegmentTempPath(root, descriptor.cacheKey, remoteRange.start);
    let finalPath = "";
    try {
      await pipeline(
        Readable.fromWeb(body as never),
        createWriteStream(tempPath, { flags: "wx" }),
      );
      const fileStat = await stat(tempPath);
      if (!fileStat.size) return;
      if (epoch !== this.cacheEpoch) return;

      const endByte = remoteRange.start + fileStat.size - 1;
      const totalBytes = remoteRange.total || (remoteRange.start === 0 ? fileStat.size : 0);
      finalPath = await finalizeSegmentFile(
        tempPath,
        root,
        descriptor.cacheKey,
        remoteRange.start,
        endByte,
      );
      if (epoch !== this.cacheEpoch) {
        await rm(finalPath, { force: true });
        return;
      }
      const identity = getMediaCacheIdentity(descriptor.track);
      this.repository.upsertEntry({
        cacheKey: descriptor.cacheKey,
        ...identity,
        totalBytes,
        mimeType,
      });
      this.repository.recordSegment({
        cacheKey: descriptor.cacheKey,
        startByte: remoteRange.start,
        endByte,
        filePath: finalPath,
        sizeBytes: fileStat.size,
        totalBytes,
        mimeType,
      });
      await this.evictIfNeeded(descriptor.cacheKey);
    } finally {
      if (!finalPath) await rm(tempPath, { force: true }).catch(() => undefined);
    }
  }

  private async evictIfNeeded(currentCacheKey?: string) {
    const policy = this.policy;
    if (!policy) return;
    let usedBytes = this.repository.getStats().usedBytes;
    if (policy.enabled && usedBytes <= policy.limitBytes) return;

    const targetBytes = policy.enabled ? Math.floor(policy.limitBytes * 0.9) : 0;
    const excluded = Array.from(this.inflightWrites.keys(), (key) => key.split(":", 1)[0])
      .filter((cacheKey) => cacheKey !== currentCacheKey);
    for (const entry of this.repository.listEvictionCandidates(excluded)) {
      const paths = this.repository.deleteEntry(entry.cacheKey);
      await removeManagedFiles(paths);
      usedBytes = Math.max(0, usedBytes - entry.cachedBytes);
      if (usedBytes <= targetBytes) break;
    }
  }

  private async getPolicy() {
    if (!this.policy) await this.refreshPolicy();
    return this.policy as MediaCachePolicy;
  }

  private trimDescriptors() {
    while (this.descriptors.size > MAX_DESCRIPTORS) {
      const oldestKey = this.descriptors.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.descriptors.delete(oldestKey);
    }
  }
}

function isCacheableSource(source: string) {
  return source === "kg" || source === "wy" || source === "kw";
}

function normalizeLimitGb(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(0, Math.min(1024, Math.round(parsed * 10) / 10));
}

function parseCacheKey(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "pisacache:" || url.hostname !== "media") return "";
    const cacheKey = url.pathname.replace(/^\/+/, "");
    return /^[a-f0-9]{64}$/.test(cacheKey) ? cacheKey : "";
  } catch {
    return "";
  }
}

function resolveRemoteRange(response: Response, requestedRange: ByteRange | null): RemoteRange {
  const contentRange = parseContentRange(response.headers.get("content-range"));
  if (contentRange) {
    return { start: contentRange.start, end: contentRange.end, total: contentRange.total ?? 0 };
  }
  const contentLength = Number(response.headers.get("content-length"));
  const size = Number.isSafeInteger(contentLength) && contentLength > 0 ? contentLength : 0;
  const start = response.status === 200 ? 0 : requestedRange?.start ?? 0;
  return {
    start,
    end: size ? start + size - 1 : requestedRange?.end ?? null,
    total: response.status === 200 ? size : 0,
  };
}

function createMediaHeaders(
  mimeType: string,
  contentLength: number,
  range: { start: number; end: number; total: number } | null,
) {
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": "no-store",
    "content-length": String(contentLength),
    "content-type": mimeType || "application/octet-stream",
  });
  if (range) headers.set("content-range", `bytes ${range.start}-${range.end}/${range.total}`);
  return headers;
}

function createLocalRangeStream(segments: MediaCacheSegment[], startByte: number, endByte: number) {
  const stream = Readable.from(readSegmentRange(segments, startByte, endByte));
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

async function* readSegmentRange(
  segments: MediaCacheSegment[],
  startByte: number,
  endByte: number,
) {
  let nextByte = startByte;
  for (const segment of segments) {
    const sliceStart = Math.max(nextByte, segment.startByte);
    const sliceEnd = Math.min(endByte, segment.endByte);
    if (sliceStart > sliceEnd) continue;
    const fileStart = sliceStart - segment.startByte;
    const fileEnd = sliceEnd - segment.startByte;
    for await (const chunk of createReadStream(segment.filePath, { start: fileStart, end: fileEnd })) {
      yield chunk;
    }
    nextByte = sliceEnd + 1;
    if (nextByte > endByte) break;
  }
}
