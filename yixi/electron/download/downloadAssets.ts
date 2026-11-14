import { nativeImage } from "electron";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAppDatabase } from "../database";
import type { TrackSnapshot } from "../database/types";
import { fetchLyrics } from "../music/musicService";
import { getCurrentQualityAccessLevel } from "../music/qualityAccess";
import { normalizeQualityKeyForAccess } from "../../src/musicQuality/musicQualityPolicy";
import { getSongCoverCandidates } from "../../src/utils/songCoverUrl";
import { normalizeDownloadSettings } from "../../src/utils/downloadSettings";
import { buildDownloadLyrics, selectDownloadLyrics } from "./downloadLyrics";
import { writeAudioMetadata } from "./audioMetadataWriter";
import type { DownloadConfiguration } from "../../src/types/download";
import { identifyFile } from "./downloadFileLocks";
type SidecarPaths = { metadataJsonPath: string; coverPath: string; directory: string; baseName: string };
type CoverAsset = { data: Buffer; mimeType: string };
type DownloadMetadataSetting = Record<string, unknown> & { songNamingMode?: string };
export async function processDownloadAssets(filePath: string, cacheRoot: string, taskId: string, song: TrackSnapshot, qualityKey: string, options: DownloadConfiguration, journal: { assets: { path: string; identity: string }[]; record: (asset: { path: string; identity: string }) => void }) {
  const metadata = await buildDownloadMetadata(song, song.source, qualityKey, options);
  const assets = await writeSidecars(sidecarPaths(cacheRoot, path.dirname(filePath), path.parse(filePath).name, taskId), metadata, options, journal);
  let metadataStatus: "embedded" | "sidecar" = "embedded";
  const warnings = [...assets.warnings];
  try { const result = await embedMetadata(filePath, metadata, options); if (!result.ok) warnings.push(...result.warnings); }
  catch (error) { warnings.push(error instanceof Error ? error.message : String(error)); }
  if (warnings.length) metadataStatus = "sidecar";
  return { ...assets, metadataStatus, message: warnings.length ? `下载完成，资产警告：${warnings.join("；")}` : "下载完成" };
}
export { toSafeDownloadSong as normalizeSong } from "../../src/utils/downloadSong";

export function normalizeSource(source: string) {
  if (source === "kg" || source === "wy" || source === "kw") return source;
  throw new Error("当前歌曲来源暂不支持下载");
}

export function normalizeQualityKey(source: "kg" | "wy" | "kw", qualityKey?: string) {
  const access = getCurrentQualityAccessLevel();
  return normalizeQualityKeyForAccess(source, qualityKey, access);
}

export function normalizeDirectory(directory: string) {
  const normalized = toStringValue(directory);
  if (!normalized) throw new Error("下载失败：未选择下载目录");
  return path.resolve(normalized);
}

export function buildBaseName(song: TrackSnapshot, setting: { songNamingMode?: string }) {
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

export function getDownloadMetadataOptions() {
  const setting = getAppDatabase().getSetting<DownloadMetadataSetting>("local-setting")?.value;
  return normalizeDownloadSettings(setting);
}

export async function createUniqueBaseName(directory: string, baseName: string, extension: string) {
  let candidate = baseName || "未命名歌曲";
  let index = 1;
  while ((await Promise.all([extension, "mp3", "flac", "m4a", "aac", "wav", "ogg", "krc", "yrc", "lrc"].map(ext => fileExists(path.join(directory, `${candidate}.${ext}`))))).some(Boolean)) {
    index += 1;
    candidate = `${baseName} (${index})`;
  }
  return candidate;
}

async function buildDownloadMetadata(song: TrackSnapshot, source: string, qualityKey: string, options: ReturnType<typeof getDownloadMetadataOptions>) {
  const [lyrics, cover] = await Promise.all([
    options.embedDownloadLyrics || options.downloadLyricsMode !== "off" ? fetchLyrics({ source: source as "kg" | "wy" | "kw", id: song.id, hash: toStringValue(song.urlParam) }).catch(() => ({
      krc: "",
      lrc: "",
    })) : Promise.resolve({ krc: "", lrc: "" }),
    options.embedDownloadCover ? fetchCover(song).catch(() => null) : Promise.resolve(null),
  ]);
  const lyricAssets = buildDownloadLyrics(source, lyrics, { lyric: toStringValue(song.lyric), krc: toStringValue(song.krc) });
  return {
    title: song.name || "",
    artist: song.singer || "",
    album: song.album || "",
    source,
    songId: song.id,
    qualityKey,
    cover,
    lyrics: lyricAssets.standardLrc,
    lyricAssets: lyricAssets.assets,
    payload: song,
  };
}

async function embedMetadata(
  filePath: string,
  metadata: Awaited<ReturnType<typeof buildDownloadMetadata>>,
  options: ReturnType<typeof getDownloadMetadataOptions>
) {
  return writeAudioMetadata(filePath, metadata, {
    embedTags: options.embedDownloadTags,
    embedCover: options.embedDownloadCover,
    embedLyrics: options.embedDownloadLyrics,
  });
}

async function writeSidecars(
  paths: SidecarPaths,
  metadata: Awaited<ReturnType<typeof buildDownloadMetadata>>,
  options: ReturnType<typeof getDownloadMetadataOptions>,
  journal: { assets: { path: string; identity: string }[]; record: (asset: { path: string; identity: string }) => void }
) {
  const warnings: string[] = [];
  const lyricPaths: string[] = [];
  const optionalWrite = async (target: string, data: string | Buffer, exclusive = true) => {
    let identity = "";
    try {
      const known = exclusive ? journal.assets.find(asset => asset.path === target) : undefined;
      if (known) {
        if ((await identifyFile(target)).identity !== known.identity) throw new Error("已记录歌词文件已改变，保留原文件");
        return true;
      }
      await writeFile(target, data, exclusive ? { flag: "wx" } : undefined);
      if (exclusive) identity = (await identifyFile(target)).identity;
    } catch (error) {
      warnings.push(`${path.basename(target)}：${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
    if (exclusive) journal.record({ path: target, identity });
    return true;
  };
  const metadataWritten = await optionalWrite(paths.metadataJsonPath, JSON.stringify({
    title: metadata.title, artist: metadata.artist, album: metadata.album,
    source: metadata.source, songId: metadata.songId, qualityKey: metadata.qualityKey,
    lyrics: metadata.lyrics, lyricAssets: metadata.lyricAssets, payload: metadata.payload,
  }, null, 2));
  for (const asset of selectDownloadLyrics(metadata.lyricAssets, options.downloadLyricsMode)) {
    const target = path.join(paths.directory, `${paths.baseName}.${asset.format}`);
    if (await optionalWrite(target, asset.text, true)) lyricPaths.push(target);
  }
  const coverWritten = metadata.cover ? await optionalWrite(paths.coverPath, metadata.cover.data) : false;
  return { warnings, lyricPaths, metadataJsonPath: metadataWritten ? paths.metadataJsonPath : "", coverPath: coverWritten ? paths.coverPath : "" };
}

function sidecarPaths(cacheRoot: string, directory: string, baseName: string, taskId: string): SidecarPaths {
  return {
    metadataJsonPath: path.join(cacheRoot, `${taskId}.json`),
    directory,
    baseName,
    coverPath: path.join(cacheRoot, `${taskId}.png`),
  };
}

async function fetchCover(song: TrackSnapshot): Promise<CoverAsset | null> {
  for (const url of getSongCoverCandidates(song, 1024)) {
    if (!/^https?:/.test(url)) continue;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) continue;
      const data = Buffer.from(await response.arrayBuffer());
      // 校验实际可解码图片，拒绝 HTML/JSON 错误页；统一 PNG 与标签 MIME。
      const image = nativeImage.createFromBuffer(data);
      if (image.isEmpty()) continue;
      return { data: image.toPNG(), mimeType: "image/png" };
    } catch { /* 封面失败降档，不阻断音频下载 */ }
  }
  return null;
}

export function inferAudioExtension(url: string, contentType: string | null, qualityKey: string) {
  const content = contentType?.toLowerCase() ?? "";
  if (content.includes("flac")) return "flac";
  if (content.includes("mpeg") || content.includes("mp3")) return "mp3";
  if (content.includes("mp4") || content.includes("m4a")) return "m4a";
  if (content.includes("aac")) return "aac";
  if (content.includes("ogg")) return "ogg";
  if (content.includes("wav")) return "wav";

  const pathname = safeUrlPathname(url).toLowerCase();
  const match = pathname.match(/\.([a-z0-9]{2,5})$/);
  if (match?.[1]) return normalizeExtension(match[1]);
  if (qualityKey.includes("flac") || qualityKey.includes("lossless") || qualityKey.includes("hires")) {
    return "flac";
  }
  return "mp3";
}

function normalizeExtension(extension: string) {
  if (["ogg", "wav", "aac", "opus", "wma"].includes(extension)) return extension;
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
