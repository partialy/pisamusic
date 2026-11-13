import { parseBlob, selectCover } from "music-metadata";
import { detectLyricsFormat, extractEmbeddedLyrics } from "./cloudMusicLyrics";
import type { CloudMusicBatchDraftItem, CloudMusicParsedSpecs } from "../types/cloudMusic";

const AUDIO_EXTENSIONS = new Set([".mp3", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".ape"]);
const COVER_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const LYRICS_EXTENSIONS = new Set([".lrc", ".txt"]);

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

function getBaseName(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return (idx >= 0 ? fileName.slice(0, idx) : fileName).trim();
}

function normalizeMatchKey(baseName: string): string {
  return baseName.trim().toLowerCase();
}

export function isSupportedAudioFile(file: File): boolean {
  const ext = getExtension(file.name);
  return AUDIO_EXTENSIONS.has(ext);
}

export function isSupportedCoverFile(file: File): boolean {
  const ext = getExtension(file.name);
  return COVER_EXTENSIONS.has(ext);
}

export function isSupportedLyricsFile(file: File): boolean {
  const ext = getExtension(file.name);
  return LYRICS_EXTENSIONS.has(ext);
}

export function formatMsToDurationStr(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function parseDurationStrToMs(str: string): number {
  const trimmed = str.trim();
  const parts = trimmed.split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!Number.isNaN(m) && !Number.isNaN(s) && m >= 0 && s >= 0 && s < 60) {
      return (m * 60 + s) * 1000;
    }
  }
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (!Number.isNaN(h) && !Number.isNaN(m) && !Number.isNaN(s) && h >= 0 && m >= 0 && m < 60 && s >= 0 && s < 60) {
      return (h * 3600 + m * 60 + s) * 1000;
    }
  }
  const numeric = parseInt(trimmed, 10);
  return !Number.isNaN(numeric) && numeric > 0 ? numeric : 0;
}

function inferTitleAndArtistFromFileName(baseName: string): { title: string; artist: string } {
  const dashMatch = baseName.split(/\s+-\s+/);
  if (dashMatch.length >= 2) {
    const artist = dashMatch[0].trim();
    const title = dashMatch.slice(1).join(" - ").trim();
    if (artist && title) {
      return { title, artist };
    }
  }
  return {
    title: baseName || "未命名",
    artist: "未知歌手",
  };
}

function measureAudioDurationFallback(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(0);
    }, 4000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const seconds = Number(audio.duration);
      cleanup();
      resolve(Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(0);
    };
    audio.src = url;
  });
}

async function parseSingleAudioDraft(
  audioFile: File,
  matchedCover?: File,
  matchedLyrics?: File,
): Promise<CloudMusicBatchDraftItem> {
  const baseName = getBaseName(audioFile.name);
  const ext = getExtension(audioFile.name).slice(1).toLowerCase();
  const fallbackNames = inferTitleAndArtistFromFileName(baseName);

  let title = fallbackNames.title;
  let artist = fallbackNames.artist;
  let album = "";
  let durationMs = 0;
  let parseWarning: string | undefined;
  let specs: CloudMusicParsedSpecs = {
    format: ext,
  };

  let coverSource: CloudMusicBatchDraftItem["coverSource"] = "none";
  let coverFile: File | null = null;
  let coverPreviewUrl: string | null = null;

  let lyricsSource: CloudMusicBatchDraftItem["lyricsSource"] = "none";
  let lyricsText = "";
  let lyricsFormat: "lrc" | "txt" = "lrc";
  let lyricsFileName = `${baseName || "lyrics"}.lrc`;

  try {
    const metadata = await parseBlob(audioFile, { duration: true });
    const { common, format } = metadata;

    const parsedTitle = common.title?.trim();
    const parsedArtists = common.artists
      ?.map((item) => item.trim())
      .filter(Boolean)
      .join(" / ");
    const parsedArtist = parsedArtists || common.artist?.trim();

    if (parsedTitle) title = parsedTitle;
    if (parsedArtist) artist = parsedArtist;
    if (common.album?.trim()) album = common.album.trim();

    if (typeof format.duration === "number" && Number.isFinite(format.duration) && format.duration > 0) {
      durationMs = Math.round(format.duration * 1000);
    }

    specs = {
      format: String(format.container ?? "").trim().toLowerCase() || ext,
      codec: String(format.codec ?? "").trim().toLowerCase(),
      bitrate: typeof format.bitrate === "number" && Number.isFinite(format.bitrate) && format.bitrate > 0
        ? Math.round(format.bitrate)
        : 0,
      sampleRate: typeof format.sampleRate === "number" && Number.isFinite(format.sampleRate) && format.sampleRate > 0
        ? Math.round(format.sampleRate)
        : 0,
      channels: typeof format.numberOfChannels === "number" && Number.isFinite(format.numberOfChannels) && format.numberOfChannels > 0
        ? Math.round(format.numberOfChannels)
        : 0,
      year: typeof common.year === "number" && Number.isInteger(common.year) && common.year > 0
        ? common.year
        : null,
      trackNo: typeof common.track?.no === "number" && Number.isInteger(common.track.no) && common.track.no > 0
        ? common.track.no
        : null,
    };

    if (!matchedCover) {
      const pic = selectCover(common.picture) ?? common.picture?.[0];
      if (pic && pic.data && pic.data.byteLength > 0) {
        const rawFormat = String(pic.format ?? "").toLowerCase();
        const mimeType = rawFormat.includes("png")
          ? "image/png"
          : rawFormat.includes("webp")
          ? "image/webp"
          : "image/jpeg";
        const coverExt = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
        const bytes = new Uint8Array(pic.data);
        coverFile = new File([bytes], `${baseName || "cover"}.${coverExt}`, { type: mimeType });
        coverPreviewUrl = URL.createObjectURL(coverFile);
        coverSource = "embedded";
      }
    }

    if (!matchedLyrics) {
      const embeddedLyrics = extractEmbeddedLyrics(metadata);
      if (embeddedLyrics) {
        lyricsText = embeddedLyrics;
        lyricsFormat = detectLyricsFormat(embeddedLyrics);
        lyricsFileName = `${baseName || "lyrics"}.${lyricsFormat}`;
        lyricsSource = "embedded";
      }
    }
  } catch (err) {
    parseWarning = `标签读取不完整 (${err instanceof Error ? err.message : "已使用文件名兜底"})`;
  }

  if (durationMs <= 0) {
    durationMs = await measureAudioDurationFallback(audioFile);
  }

  if (matchedCover) {
    coverFile = matchedCover;
    coverPreviewUrl = URL.createObjectURL(matchedCover);
    coverSource = "matched";
  }

  if (matchedLyrics) {
    try {
      const rawText = (await matchedLyrics.text()).replace(/^\uFEFF/, "").trim();
      if (rawText) {
        lyricsText = rawText;
        lyricsFormat = detectLyricsFormat(rawText);
        lyricsFileName = matchedLyrics.name;
        lyricsSource = "matched";
      }
    } catch {
      // 忽略外置歌词读取错误
    }
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    audioFile,
    parseWarning,
    title,
    artist,
    album,
    durationMs,
    durationStr: formatMsToDurationStr(durationMs),
    status: "active",
    statusReason: "",
    specs,
    coverSource,
    coverFile,
    coverPreviewUrl,
    lyricsSource,
    lyricsText,
    lyricsFormat,
    lyricsFileName,
  };
}

/**
 * 批量解析选入的音频文件，并自动按同名规则配对同时选入的封面图片与歌词文件
 */
export async function parseSelectedFilesBatch(
  files: File[],
  onItemParsed?: (completedCount: number, totalCount: number) => void,
): Promise<{
  items: CloudMusicBatchDraftItem[];
  unmatchedCoversCount: number;
  unmatchedLyricsCount: number;
}> {
  const audioFiles: File[] = [];
  const coverMap = new Map<string, File>();
  const lyricsMap = new Map<string, File>();

  for (const file of files) {
    if (isSupportedAudioFile(file)) {
      audioFiles.push(file);
    } else if (isSupportedCoverFile(file)) {
      coverMap.set(normalizeMatchKey(getBaseName(file.name)), file);
    } else if (isSupportedLyricsFile(file)) {
      lyricsMap.set(normalizeMatchKey(getBaseName(file.name)), file);
    }
  }

  const usedCoverKeys = new Set<string>();
  const usedLyricsKeys = new Set<string>();
  const items: CloudMusicBatchDraftItem[] = [];

  for (let i = 0; i < audioFiles.length; i += 1) {
    const audioFile = audioFiles[i];
    const key = normalizeMatchKey(getBaseName(audioFile.name));
    const matchedCover = coverMap.get(key);
    const matchedLyrics = lyricsMap.get(key);
    if (matchedCover) usedCoverKeys.add(key);
    if (matchedLyrics) usedLyricsKeys.add(key);

    const draft = await parseSingleAudioDraft(audioFile, matchedCover, matchedLyrics);
    items.push(draft);
    onItemParsed?.(i + 1, audioFiles.length);
  }

  return {
    items,
    unmatchedCoversCount: coverMap.size - usedCoverKeys.size,
    unmatchedLyricsCount: lyricsMap.size - usedLyricsKeys.size,
  };
}
