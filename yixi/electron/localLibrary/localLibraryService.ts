import { BrowserWindow } from "electron";
import { createHash } from "crypto";
import { readdir, stat } from "fs/promises";
import { basename, dirname, extname, normalize, resolve } from "path";
import { parseFile } from "music-metadata";
import { getAppDatabase } from "../database";
import type { LocalLibraryScanMeta, LocalSongItem, TrackSnapshot } from "../database/appDatabase";
import { logger } from "../utils/logger";

type LocalSettingRecord = {
  scanDirectory?: string;
  scanDirectories?: string[];
};

export type LocalLibraryScanStatus = {
  scanning: boolean;
  lastStartedAt: string;
  lastFinishedAt: string;
  lastError: string;
  total: number;
  directories: string[];
  skipped: boolean;
};

type AudioFileCandidate = {
  filePath: string;
  directory: string;
  fileName: string;
  extension: string;
  size: number;
  mtimeMs: number;
};

const LOCAL_SETTING_KEY = "local-setting";
const AUDIO_EXTENSIONS = new Set([".mp3", ".flac", ".wav", ".ogg", ".aac", ".m4a"]);

let scanPromise: Promise<LocalLibraryScanStatus> | null = null;
let status: LocalLibraryScanStatus = {
  scanning: false,
  lastStartedAt: "",
  lastFinishedAt: "",
  lastError: "",
  total: 0,
  directories: [],
  skipped: false,
};

export function getLocalLibraryScanStatus() {
  return { ...status };
}

export function listLocalSongs() {
  return getAppDatabase().listLocalSongs().map((item) => item.payload);
}

export function startLocalLibrarySmartScan() {
  void scanLocalLibrary(false);
}

export function refreshLocalLibrary() {
  return scanLocalLibrary(true);
}

async function scanLocalLibrary(force: boolean): Promise<LocalLibraryScanStatus> {
  if (scanPromise) return scanPromise;
  scanPromise = runScan(force).finally(() => {
    scanPromise = null;
  });
  return scanPromise;
}

async function runScan(force: boolean): Promise<LocalLibraryScanStatus> {
  const startedAt = new Date().toISOString();
  const directories = getScanDirectories();
  setStatus({
    scanning: true,
    lastStartedAt: startedAt,
    lastError: "",
    directories,
    skipped: false,
  });
  notifyStatus("local-library:scan-started");

  try {
    const candidates = await collectAudioFiles(directories);
    const fingerprint = createFingerprint(directories, candidates);
    const previousMeta = getAppDatabase().getLocalLibraryScanMeta();

    if (!force && shouldSkipScan(previousMeta, fingerprint)) {
      const finishedAt = new Date().toISOString();
      setStatus({
        scanning: false,
        lastFinishedAt: finishedAt,
        total: previousMeta?.totalFiles ?? getAppDatabase().listLocalSongs().length,
        skipped: true,
      });
      notifyStatus("local-library:scan-finished");
      return getLocalLibraryScanStatus();
    }

    const songs = await buildLocalSongs(candidates);
    const meta: LocalLibraryScanMeta = {
      fingerprint,
      directories,
      totalFiles: songs.length,
      scannedAt: new Date().toISOString(),
    };
    getAppDatabase().replaceLocalSongs(songs, meta);

    setStatus({
      scanning: false,
      lastFinishedAt: meta.scannedAt,
      total: songs.length,
      skipped: false,
    });
    notifyStatus("local-library:scan-finished");
    return getLocalLibraryScanStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("local library scan failed", {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    setStatus({
      scanning: false,
      lastFinishedAt: new Date().toISOString(),
      lastError: message,
      skipped: false,
    });
    notifyStatus("local-library:scan-failed");
    return getLocalLibraryScanStatus();
  }
}

function getScanDirectories() {
  const record = getAppDatabase().getSetting<LocalSettingRecord>(LOCAL_SETTING_KEY);
  return normalizeDirectories(record?.value);
}

function normalizeDirectories(input?: LocalSettingRecord | null) {
  const values = Array.isArray(input?.scanDirectories)
    ? input.scanDirectories
    : input?.scanDirectory
      ? [input.scanDirectory]
      : [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalize(value.trim()))
        .filter(Boolean)
    )
  ).slice(0, 10);
}

async function collectAudioFiles(directories: string[]) {
  const files: AudioFileCandidate[] = [];
  for (const directory of directories) {
    await walkDirectory(resolve(directory), files);
  }
  return files.sort((a, b) => a.filePath.localeCompare(b.filePath));
}

async function walkDirectory(directory: string, files: AudioFileCandidate[]) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(filePath, files);
      continue;
    }
    if (!entry.isFile()) continue;

    const extension = extname(entry.name).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(extension)) continue;

    try {
      const info = await stat(filePath);
      files.push({
        filePath,
        directory,
        fileName: entry.name,
        extension: extension.slice(1),
        size: info.size,
        mtimeMs: info.mtimeMs,
      });
    } catch {
      // 文件扫描期间被移动或删除时跳过，下一次扫描会重新同步。
    }
  }
}

function createFingerprint(directories: string[], files: AudioFileCandidate[]) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(directories));
  files.forEach((file) => {
    hash.update(`${file.filePath}|${file.size}|${Math.round(file.mtimeMs)}\n`);
  });
  return hash.digest("hex");
}

function shouldSkipScan(meta: LocalLibraryScanMeta | null, fingerprint: string) {
  return Boolean(meta?.fingerprint && meta.fingerprint === fingerprint);
}

async function buildLocalSongs(files: AudioFileCandidate[]) {
  const songs: LocalSongItem[] = [];
  for (const file of files) {
    songs.push(await buildLocalSong(file));
  }
  return songs;
}

async function buildLocalSong(file: AudioFileCandidate): Promise<LocalSongItem> {
  const fallback = parseFileName(file.fileName);
  let title = fallback.title;
  let artist = fallback.artist;
  let album = "";
  let duration = 0;

  try {
    const metadata = await parseFile(file.filePath, { duration: true });
    title = firstString(metadata.common.title) || title;
    artist = firstString(metadata.common.artist) || firstString(metadata.common.artists) || artist;
    album = firstString(metadata.common.album);
    duration = metadata.format.duration ? Math.round(metadata.format.duration) : 0;
  } catch {
    // 标签读取失败时使用文件名兜底，避免单个坏文件中断整次扫描。
  }

  const id = createHash("sha1").update(file.filePath).digest("hex");
  const payload: TrackSnapshot = {
    id,
    source: "local",
    name: title,
    singer: artist,
    album,
    cover: "",
    duration,
    urlParam: file.filePath,
    filePath: file.filePath,
  };

  return {
    id,
    title,
    artist,
    album,
    duration,
    filePath: file.filePath,
    directory: dirname(file.filePath),
    fileName: basename(file.fileName),
    extension: file.extension,
    size: file.size,
    mtimeMs: file.mtimeMs,
    payload,
    updatedAt: new Date().toISOString(),
  };
}

function parseFileName(fileName: string) {
  const name = basename(fileName, extname(fileName)).trim();
  const parts = name.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(" - ").trim(),
    };
  }
  return { artist: "未知歌手", title: name || "未知歌曲" };
}

function firstString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const item = value.find((entry) => typeof entry === "string" && entry.trim());
    return typeof item === "string" ? item.trim() : "";
  }
  return "";
}

function setStatus(next: Partial<LocalLibraryScanStatus>) {
  status = { ...status, ...next };
}

function notifyStatus(channel: string) {
  const snapshot = getLocalLibraryScanStatus();
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, snapshot);
  });
}
