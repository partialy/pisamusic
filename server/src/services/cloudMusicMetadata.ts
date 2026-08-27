import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  CLOUD_MUSIC_AUDIO_MAX_SIZE,
  CLOUD_MUSIC_COVER_MAX_SIZE,
  CLOUD_MUSIC_DEFAULT_COVER_PATH,
  CLOUD_MUSIC_LYRICS_MAX_SIZE,
  detectCoverMimeType,
} from "./cloudMusicAssets";

const TEMP_DIRECTORY = path.join(os.tmpdir(), "pisamusic-cloud-music");

export type MetadataExtractInput = {
  signedUrl: string;
  fileName: string;
  expectedSize: number;
};

export type CloudMusicExtractedCover = {
  data: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export type CloudMusicExtractedMetadata = {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  format: string;
  codec: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
  year: number | null;
  trackNo: number | null;
  metadata: Record<string, string | number | boolean | null | string[]>;
  warnings: string[];
  embeddedCover: CloudMusicExtractedCover | null;
};

export type CloudMusicCoverValidation = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export type CloudMusicLyricsValidation = {
  format: string;
  characterCount: number;
};

function requireExpectedSize(expectedSize: number, maxSize: number): void {
  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0) throw new Error("临时下载声明大小不正确");
  if (expectedSize > maxSize) throw new Error("临时下载文件超过大小限制");
}

function safeTempExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ".bin";
}

async function withDownloadedTempFile<T>(
  input: MetadataExtractInput,
  maxSize: number,
  reader: (tempPath: string) => Promise<T>,
): Promise<T> {
  requireExpectedSize(input.expectedSize, maxSize);
  await mkdir(TEMP_DIRECTORY, { recursive: true });
  const tempPath = path.join(TEMP_DIRECTORY, `${randomUUID()}${safeTempExtension(input.fileName)}`);
  const abortController = new AbortController();
  let fileHandle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    const response = await fetch(input.signedUrl, { signal: abortController.signal });
    if (!response.ok) throw new Error(`临时下载失败：HTTP ${response.status}`);
    const contentLengthHeader = response.headers.get("content-length");
    if (!contentLengthHeader || !/^\d+$/.test(contentLengthHeader)) throw new Error("临时下载缺少有效 Content-Length");
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength !== input.expectedSize || contentLength > maxSize) {
      throw new Error("临时下载 Content-Length 与预期不一致");
    }
    if (!response.body) throw new Error("临时下载响应没有文件内容");

    fileHandle = await open(tempPath, "wx");
    const streamReader = response.body.getReader();
    let received = 0;
    while (true) {
      const { done, value } = await streamReader.read();
      if (done) break;
      received += value.byteLength;
      if (received > input.expectedSize || received > maxSize) {
        abortController.abort();
        throw new Error("临时下载累计字节超过限制");
      }
      await fileHandle.write(value);
    }
    if (received !== input.expectedSize) throw new Error("临时下载累计字节与预期不一致");
    await fileHandle.close();
    fileHandle = null;
    return await reader(tempPath);
  } finally {
    abortController.abort();
    if (fileHandle) await fileHandle.close().catch(() => undefined);
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

function finiteNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function optionalInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function warningMessage(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "message" in value) return String(value.message ?? "").trim();
  return "";
}

export async function extractCloudMusicMetadata(input: MetadataExtractInput): Promise<CloudMusicExtractedMetadata> {
  return withDownloadedTempFile(input, CLOUD_MUSIC_AUDIO_MAX_SIZE, async (tempPath) => {
    const { parseFile } = await import("music-metadata");
    const parsed = await parseFile(tempPath, { duration: true });
    const { common, format } = parsed;
    const ext = path.extname(input.fileName);
    const artists = common.artists
      ?.map((artist) => artist.trim())
      .filter(Boolean)
      .join(" / ");
    const warnings = (parsed.quality.warnings ?? []).map(warningMessage).filter(Boolean);

    let embeddedCover: CloudMusicExtractedCover | null = null;
    const picture = common.picture?.[0];
    if (picture) {
      try {
        const data = Buffer.from(picture.data);
        const detectedMimeType = detectCoverMimeType(data);
        const declaredMimeType = String(picture.format ?? "").split(";", 1)[0].trim().toLowerCase();
        const normalizedDeclaredMimeType = declaredMimeType === "image/jpg" ? "image/jpeg" : declaredMimeType;
        if (!detectedMimeType || detectedMimeType !== normalizedDeclaredMimeType) {
          throw new Error("内嵌封面 MIME 与文件头不一致");
        }
        if (data.byteLength <= 0 || data.byteLength > CLOUD_MUSIC_COVER_MAX_SIZE) {
          throw new Error("内嵌封面超过 10 MiB");
        }
        embeddedCover = { data, mimeType: detectedMimeType };
      } catch (error) {
        warnings.push(`内嵌封面已忽略：${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      warnings.push("未发现内嵌封面，使用默认封面");
    }

    const durationMs = Math.max(0, Math.round(finiteNumber(format.duration) * 1000));
    const bitrate = Math.max(0, Math.round(finiteNumber(format.bitrate)));
    const sampleRate = Math.max(0, Math.round(finiteNumber(format.sampleRate)));
    const channels = Math.max(0, Math.round(finiteNumber(format.numberOfChannels)));
    const normalizedFormat = String(format.container ?? "").trim().toLowerCase() || ext.slice(1).toLowerCase();
    const codec = String(format.codec ?? "").trim().toLowerCase();
    const metadata: CloudMusicExtractedMetadata["metadata"] = {
      lossless: Boolean(format.lossless),
      numberOfSamples: Math.max(0, Math.round(finiteNumber(format.numberOfSamples))),
      tagTypes: Array.isArray(format.tagTypes) ? format.tagTypes.join(",") : "",
      coverFallback: embeddedCover ? "" : CLOUD_MUSIC_DEFAULT_COVER_PATH,
      warnings,
    };

    return {
      title: common.title?.trim() || path.basename(input.fileName, ext),
      artist: artists || common.artist?.trim() || "未知歌手",
      album: common.album?.trim() || "",
      durationMs,
      format: normalizedFormat,
      codec,
      bitrate,
      sampleRate,
      channels,
      year: optionalInteger(common.year),
      trackNo: optionalInteger(common.track?.no),
      metadata,
      warnings,
      embeddedCover,
    };
  });
}

export async function validateCloudMusicCover(input: MetadataExtractInput): Promise<CloudMusicCoverValidation> {
  return withDownloadedTempFile(input, CLOUD_MUSIC_COVER_MAX_SIZE, async (tempPath) => {
    const data = await readFile(tempPath);
    const mimeType = detectCoverMimeType(data);
    if (!mimeType) throw new Error("封面文件头不支持，仅允许 JPEG、PNG、WebP");
    return { mimeType };
  });
}

export async function validateCloudMusicLyrics(input: MetadataExtractInput): Promise<CloudMusicLyricsValidation> {
  return withDownloadedTempFile(input, CLOUD_MUSIC_LYRICS_MAX_SIZE, async (tempPath) => {
    const data = await readFile(tempPath);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(data).replace(/^\uFEFF/, "");
    } catch {
      throw new Error("歌词不是有效的 UTF-8 编码");
    }
    const ext = path.extname(input.fileName).slice(1).toLowerCase();
    return { format: ext || "txt", characterCount: text.length };
  });
}
