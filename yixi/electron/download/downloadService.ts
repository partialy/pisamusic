import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { writeCoverImageToFile, writeTags } from "@yortyrh/tagpilot-lib";
import { getAppDataPath } from "../core/appPaths";
import { getAppDatabase } from "../database";
import type {
  DownloadMetadataStatus,
  DownloadRecordInput,
  DownloadRecordItem,
  TrackSnapshot,
} from "../database/appDatabase";
import { fetchLyrics, resolvePlayableUrl } from "../music/musicService";
import { defaultQualityKeyForSource, qualityKeyMatchesSource } from "../music/quality";

type DownloadTrackPayload = {
  song: TrackSnapshot;
  qualityKey?: string;
  directory: string;
};

export type DownloadTaskStatus = "queued" | "running" | "completed" | "failed";

export type DownloadTaskSnapshot = {
  taskId: string;
  source: string;
  songId: string;
  qualityKey: string;
  name: string;
  status: DownloadTaskStatus;
  progress: number;
  receivedBytes: number;
  totalBytes: number;
  speedBytesPerSecond: number;
  directory: string;
  filePath: string;
  error: string;
  createdAt: string;
  updatedAt: string;
};

export type DownloadTrackResult = {
  success: boolean;
  filePath?: string;
  cachePath?: string;
  metadataStatus: DownloadMetadataStatus;
  message: string;
};

type DownloadTask = {
  snapshot: DownloadTaskSnapshot;
  promise: Promise<DownloadTrackResult>;
};

type SidecarPaths = {
  metadataJsonPath: string;
  lyricPath: string;
  coverPath: string;
};

type CoverAsset = {
  data: Buffer;
  mimeType: string;
};

const downloadTasks = new Map<string, DownloadTask>();

export function startDownloadTask(payload: DownloadTrackPayload): DownloadTaskSnapshot {
  const song = normalizeSong(payload.song);
  const source = normalizeSource(song.source);
  const qualityKey = normalizeQualityKey(source, payload.qualityKey);
  const directory = normalizeDirectory(payload.directory);
  const createdAt = new Date().toISOString();
  const snapshot: DownloadTaskSnapshot = {
    taskId: randomUUID(),
    source,
    songId: song.id,
    qualityKey,
    name: song.name || "未知歌曲",
    status: "queued",
    progress: 0,
    receivedBytes: 0,
    totalBytes: 0,
    speedBytesPerSecond: 0,
    directory,
    filePath: "",
    error: "",
    createdAt,
    updatedAt: createdAt,
  };

  const task: DownloadTask = {
    snapshot,
    promise: Promise.resolve().then(() => runDownloadTask(snapshot, song, directory, qualityKey)),
  };
  downloadTasks.set(snapshot.taskId, task);
  recordDownload({
    snapshot,
    song,
    status: "queued",
    metadataStatus: "sidecar",
    message: "等待下载",
  });
  task.promise.catch(() => null);
  return cloneSnapshot(snapshot);
}

export function listDownloadTasks() {
  return [...downloadTasks.values()].map((task) => cloneSnapshot(task.snapshot));
}

export function listDownloadRecords(): DownloadRecordItem[] {
  return getAppDatabase().listDownloadRecords();
}

export function listDownloadedSongs(): TrackSnapshot[] {
  return getAppDatabase().listDownloadedSongs();
}

export async function downloadTrack(payload: DownloadTrackPayload): Promise<DownloadTrackResult> {
  const task = startDownloadTask(payload);
  return downloadTasks.get(task.taskId)!.promise;
}

async function runDownloadTask(
  snapshot: DownloadTaskSnapshot,
  song: TrackSnapshot,
  directory: string,
  qualityKey: string
): Promise<DownloadTrackResult> {
  markTask(snapshot, { status: "running", error: "" });
  const source = normalizeSource(song.source);

  try {
    await mkdir(directory, { recursive: true });
    const url = await resolvePlayableUrl({ ...song, source, qualityKey });
    if (!url) throw new Error("下载失败：播放地址为空");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载失败：${response.status} ${response.statusText}`);
    }

    const extension = inferAudioExtension(url, response.headers.get("content-type"), qualityKey);
    const baseName = await createUniqueBaseName(directory, buildBaseName(song), extension);
    const filePath = path.join(directory, `${baseName}.${extension}`);
    const cacheRoot = getAppDataPath("downloads", "cache");
    await mkdir(cacheRoot, { recursive: true });
    const cachePath = path.join(cacheRoot, `${baseName}.${extension}`);
    const totalBytes = Number(response.headers.get("content-length")) || 0;
    markTask(snapshot, { totalBytes, filePath });

    await streamResponseToFile(response, cachePath, snapshot);
    await copyFile(cachePath, filePath);

    const sidecars = sidecarPaths(cacheRoot, baseName);
    const metadata = await buildDownloadMetadata(song, source, qualityKey);
    await writeSidecars(sidecars, metadata);

    let metadataStatus: DownloadMetadataStatus = "embedded";
    let message = "下载完成";
    try {
      await embedMetadata(filePath, metadata);
    } catch (error) {
      metadataStatus = "sidecar";
      message = `下载完成，元数据已写入缓存：${error instanceof Error ? error.message : String(error)}`;
    }

    markTask(snapshot, {
      status: "completed",
      progress: 100,
      receivedBytes: totalBytes || snapshot.receivedBytes,
      totalBytes: totalBytes || snapshot.receivedBytes,
      filePath,
    });
    recordDownload({
      snapshot,
      song,
      status: "completed",
      metadataStatus,
      cachePath,
      metadataJsonPath: sidecars.metadataJsonPath,
      lyricPath: sidecars.lyricPath,
      coverPath: sidecars.coverPath,
      message,
      completedAt: new Date().toISOString(),
    });
    return { success: true, filePath, cachePath, metadataStatus, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    markTask(snapshot, { status: "failed", error: message });
    recordDownload({
      snapshot,
      song,
      status: "failed",
      metadataStatus: "failed",
      message,
    });
    throw error;
  }
}

async function streamResponseToFile(response: Response, filePath: string, snapshot: DownloadTaskSnapshot) {
  const writer = createWriteStream(filePath);
  const startedAt = Date.now();
  let receivedBytes = 0;

  try {
    const body = response.body;
    if (!body) {
      const buffer = Buffer.from(await response.arrayBuffer());
      writer.write(buffer);
      receivedBytes = buffer.length;
      updateProgress(snapshot, receivedBytes, receivedBytes, startedAt);
      return;
    }

    const reader = body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      receivedBytes += chunk.length;
      if (!writer.write(chunk)) {
        await new Promise<void>((resolve) => writer.once("drain", resolve));
      }
      updateProgress(snapshot, receivedBytes, snapshot.totalBytes, startedAt);
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      writer.end((error?: Error | null) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

function updateProgress(
  snapshot: DownloadTaskSnapshot,
  receivedBytes: number,
  totalBytes: number,
  startedAt: number
) {
  const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
  markTask(snapshot, {
    receivedBytes,
    totalBytes: totalBytes || receivedBytes,
    progress: totalBytes > 0 ? Math.min(99, (receivedBytes / totalBytes) * 100) : 0,
    speedBytesPerSecond: Math.round(receivedBytes / elapsedSeconds),
  });
}

function recordDownload(input: {
  snapshot: DownloadTaskSnapshot;
  song: TrackSnapshot;
  status: DownloadTaskStatus;
  metadataStatus: DownloadMetadataStatus;
  cachePath?: string;
  metadataJsonPath?: string;
  lyricPath?: string;
  coverPath?: string;
  message?: string;
  completedAt?: string;
}) {
  const record: DownloadRecordInput = {
    source: input.snapshot.source,
    songId: input.snapshot.songId,
    qualityKey: input.snapshot.qualityKey,
    status: input.status,
    downloadDirectory: input.snapshot.directory,
    filePath: input.snapshot.filePath,
    cachePath: input.cachePath ?? "",
    metadataStatus: input.metadataStatus,
    metadataJsonPath: input.metadataJsonPath,
    lyricPath: input.lyricPath,
    coverPath: input.coverPath,
    totalBytes: input.snapshot.totalBytes,
    receivedBytes: input.snapshot.receivedBytes,
    completedAt: input.completedAt,
    payload: stripRuntimeFields(input.song),
    message: input.message ?? input.snapshot.error,
  };
  getAppDatabase().upsertDownloadRecord(record);
}

function markTask(snapshot: DownloadTaskSnapshot, patch: Partial<DownloadTaskSnapshot>) {
  Object.assign(snapshot, patch, { updatedAt: new Date().toISOString() });
}

function cloneSnapshot(snapshot: DownloadTaskSnapshot): DownloadTaskSnapshot {
  return { ...snapshot };
}

function normalizeSong(song: TrackSnapshot): TrackSnapshot {
  const id = toStringValue(song.id);
  const source = toStringValue(song.source);
  if (!id || !source) throw new Error("下载失败：歌曲缺少 source 或 id");
  return stripRuntimeFields({
    ...song,
    id,
    source,
    name: toStringValue(song.name),
    singer: toStringValue(song.singer),
    album: toStringValue(song.album),
    cover: toStringValue(song.cover),
    urlParam: toStringValue(song.urlParam) || id,
  });
}

function stripRuntimeFields(song: TrackSnapshot): TrackSnapshot {
  const {
    id,
    source,
    name,
    singer,
    album,
    cover,
    duration,
    urlParam,
    filePath,
    coverSize,
    size,
    d_cover,
    lyric,
    krc,
    vip,
  } = song;
  const track: TrackSnapshot = {
    id: toStringValue(id),
    source: toStringValue(source),
    name: toStringValue(name),
    singer: toStringValue(singer),
    album: toStringValue(album),
    cover: toStringValue(cover),
    duration: typeof duration === "number" ? duration : Number(duration) || 0,
  };
  const nextUrlParam = toStringValue(urlParam);
  if (nextUrlParam) track.urlParam = nextUrlParam;
  const nextFilePath = toStringValue(filePath);
  if (nextFilePath) track.filePath = nextFilePath;
  if (isPlainObject(coverSize)) track.coverSize = coverSize;
  if (isPlainObject(size)) track.size = size;
  const dCover = toStringValue(d_cover);
  if (dCover) track.d_cover = dCover;
  const nextLyric = toStringValue(lyric);
  if (nextLyric) track.lyric = nextLyric;
  const nextKrc = toStringValue(krc);
  if (nextKrc) track.krc = nextKrc;
  if (typeof vip === "boolean") track.vip = vip;
  return track;
}

function normalizeSource(source: string) {
  if (source === "kg" || source === "wy" || source === "kw") return source;
  throw new Error("当前歌曲来源暂不支持下载");
}

function normalizeQualityKey(source: "kg" | "wy" | "kw", qualityKey?: string) {
  if (qualityKeyMatchesSource(qualityKey, source)) return qualityKey as string;
  return defaultQualityKeyForSource(source);
}

function normalizeDirectory(directory: string) {
  const normalized = toStringValue(directory);
  if (!normalized) throw new Error("下载失败：未选择下载目录");
  return path.resolve(normalized);
}

function buildBaseName(song: TrackSnapshot) {
  const setting = getAppDatabase().getSetting<{ songNamingMode?: string }>("local-setting")?.value;
  const title = song.name || "未知歌曲";
  const artist = song.singer || "未知歌手";
  switch (setting?.songNamingMode) {
    case "title-artist":
      return sanitizeFileName(`${title} - ${artist}`);
    case "title":
      return sanitizeFileName(title);
    case "index-title-artist":
      return sanitizeFileName(`01 - ${title} - ${artist}`);
    case "artist-title":
    default:
      return sanitizeFileName(`${artist} - ${title}`);
  }
}

async function createUniqueBaseName(directory: string, baseName: string, extension: string) {
  let candidate = baseName || "未命名歌曲";
  let index = 1;
  while (await fileExists(path.join(directory, `${candidate}.${extension}`))) {
    index += 1;
    candidate = `${baseName} (${index})`;
  }
  return candidate;
}

async function buildDownloadMetadata(song: TrackSnapshot, source: string, qualityKey: string) {
  const [lyrics, cover] = await Promise.all([
    fetchLyrics({ source: source as "kg" | "wy" | "kw", id: song.id, hash: toStringValue(song.urlParam) }).catch(() => ({
      krc: "",
      lrc: "",
    })),
    fetchCover(song).catch(() => null),
  ]);
  return {
    title: song.name || "",
    artist: song.singer || "",
    album: song.album || "",
    source,
    songId: song.id,
    qualityKey,
    cover,
    lyrics: lyrics.lrc || lyrics.krc || toStringValue(song.lyric) || toStringValue(song.krc),
    payload: song,
  };
}

async function embedMetadata(
  filePath: string,
  metadata: Awaited<ReturnType<typeof buildDownloadMetadata>>
) {
  await writeTags(filePath, {
    title: metadata.title,
    artists: metadata.artist ? [metadata.artist] : [],
    album: metadata.album,
    comment: `source=${metadata.source}; songId=${metadata.songId}; quality=${metadata.qualityKey}`,
    image: metadata.cover
      ? {
          data: metadata.cover.data,
          mimeType: metadata.cover.mimeType,
          picType: "CoverFront" as any,
          description: "Cover",
        }
      : undefined,
  });
  if (metadata.cover) {
    await writeCoverImageToFile(filePath, metadata.cover.data);
  }
}

async function writeSidecars(
  paths: SidecarPaths,
  metadata: Awaited<ReturnType<typeof buildDownloadMetadata>>
) {
  await writeFile(paths.metadataJsonPath, JSON.stringify({
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    source: metadata.source,
    songId: metadata.songId,
    qualityKey: metadata.qualityKey,
    payload: metadata.payload,
  }, null, 2));
  if (metadata.lyrics) {
    await writeFile(paths.lyricPath, metadata.lyrics);
  }
  if (metadata.cover) {
    await writeFile(paths.coverPath, metadata.cover.data);
  }
}

function sidecarPaths(cacheRoot: string, baseName: string): SidecarPaths {
  return {
    metadataJsonPath: path.join(cacheRoot, `${baseName}.json`),
    lyricPath: path.join(cacheRoot, `${baseName}.lrc`),
    coverPath: path.join(cacheRoot, `${baseName}.jpg`),
  };
}

async function fetchCover(song: TrackSnapshot): Promise<CoverAsset | null> {
  const coverUrl = pickCoverUrl(song);
  if (!coverUrl || !coverUrl.startsWith("http")) return null;
  const response = await fetch(coverUrl);
  if (!response.ok) return null;
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  return {
    data: Buffer.from(await response.arrayBuffer()),
    mimeType,
  };
}

function pickCoverUrl(song: TrackSnapshot) {
  const coverSize = song.coverSize as Record<string, unknown> | undefined;
  return (
    toStringValue(coverSize?.xl) ||
    toStringValue(coverSize?.l) ||
    toStringValue(coverSize?.m) ||
    toStringValue(coverSize?.s) ||
    toStringValue(song.cover)
  );
}

function inferAudioExtension(url: string, contentType: string | null, qualityKey: string) {
  const content = contentType?.toLowerCase() ?? "";
  if (content.includes("flac")) return "flac";
  if (content.includes("mpeg") || content.includes("mp3")) return "mp3";
  if (content.includes("mp4") || content.includes("m4a") || content.includes("aac")) return "m4a";

  const pathname = safeUrlPathname(url).toLowerCase();
  const match = pathname.match(/\.([a-z0-9]{2,5})$/);
  if (match?.[1]) return normalizeExtension(match[1]);
  if (qualityKey.includes("flac") || qualityKey.includes("lossless") || qualityKey.includes("hires")) {
    return "flac";
  }
  return "mp3";
}

function normalizeExtension(extension: string) {
  if (extension === "jpeg") return "jpg";
  if (extension === "m4a" || extension === "mp4") return "m4a";
  if (extension === "flac") return "flac";
  return "mp3";
}

function safeUrlPathname(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function toStringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
