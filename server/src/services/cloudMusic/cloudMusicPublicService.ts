import path from "node:path";
import {
  readCloudMusicTrack,
  readVisibleCloudMusicSummary,
  searchVisibleCloudMusic,
  type CloudMusicSearchInput,
} from "../../db/cloudMusicStore";
import { readFileRecordById } from "../../db/configStore";
import {
  CLOUD_MUSIC_DEFAULT_COVER_PATH,
  createCloudMusicAssetUrl,
} from "../cloudMusicAssets";
import {
  findCurrentAsset,
  toCloudMusicPublicTrack,
  toCloudMusicTrackDto,
} from "./cloudMusicShared";
import type {
  CloudMusicLyricsUrlResponse,
  CloudMusicPlayUrlResponse,
  CloudMusicPublicSummary,
  CloudMusicPublicTrack,
  CloudMusicSearchResponse,
} from "./types";

export async function searchPublicTracks(input: CloudMusicSearchInput): Promise<CloudMusicSearchResponse> {
  const result = await searchVisibleCloudMusic(input);
  return {
    source: "cloud",
    items: (await Promise.all(result.items.map(toCloudMusicTrackDto))).map(toCloudMusicPublicTrack),
    total: result.total,
    offset: result.offset,
    limit: result.limit,
  };
}

export async function getPublicSummary(userId?: string): Promise<CloudMusicPublicSummary> {
  return await readVisibleCloudMusicSummary(userId);
}

export async function getPublicTrackDetail(uuid: string): Promise<CloudMusicPublicTrack | null> {
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) return null;
  if (track.status !== "active" && track.status !== "disabled") return null;
  return toCloudMusicPublicTrack(await toCloudMusicTrackDto(track));
}

export async function getPublicPlayUrl(uuid: string): Promise<CloudMusicPlayUrlResponse> {
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) {
    const err = new Error("曲目不存在");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }
  if (track.status === "disabled") {
    const err = new Error("曲目已禁用");
    (err as unknown as { statusCode: number; code: string }).statusCode = 403;
    (err as unknown as { code: string }).code = "CLOUD_MUSIC_DISABLED";
    throw err;
  }
  if (track.status !== "active") {
    const err = new Error("曲目不可播放");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const audioAsset = track.assets.find((item) => item.kind === "audio" && item.state === "uploaded" && item.isCurrent && item.deletedAt === null);
  if (!audioAsset) {
    const err = new Error("音频文件未就绪");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const audioFile = await readFileRecordById(audioAsset.fileRecordId);
  if (!audioFile || audioFile.status !== "uploaded") {
    const err = new Error("音频文件不存在");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const url = createCloudMusicAssetUrl(audioFile, 3600);
  return {
    uuid,
    source: "cloud",
    url,
    expiresAt: Date.now() + 3600 * 1000,
  };
}

export async function getPublicCoverRedirect(uuid: string): Promise<string> {
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null || (track.status !== "active" && track.status !== "disabled")) {
    const err = new Error("曲目不存在");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const coverAsset = findCurrentAsset(track.assets, "cover-uploaded")
    ?? findCurrentAsset(track.assets, "cover-extracted");
  if (!coverAsset) return CLOUD_MUSIC_DEFAULT_COVER_PATH;

  const coverFile = await readFileRecordById(coverAsset.fileRecordId);
  return coverFile && coverFile.status === "uploaded"
    ? createCloudMusicAssetUrl(coverFile, 3600)
    : CLOUD_MUSIC_DEFAULT_COVER_PATH;
}

export async function getPublicLyricsUrl(uuid: string): Promise<CloudMusicLyricsUrlResponse> {
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) {
    const err = new Error("曲目不存在");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }
  if (track.status === "disabled") {
    const err = new Error("曲目已禁用");
    (err as unknown as { statusCode: number; code: string }).statusCode = 403;
    (err as unknown as { code: string }).code = "CLOUD_MUSIC_DISABLED";
    throw err;
  }
  if (track.status !== "active") {
    const err = new Error("曲目当前不可用");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const lyricsAsset = track.assets.find((item) => item.kind === "lyrics" && item.state === "uploaded" && item.isCurrent && item.deletedAt === null);
  if (!lyricsAsset) {
    const err = new Error("该曲目暂无歌词");
    (err as unknown as { statusCode: number; code: string }).statusCode = 404;
    (err as unknown as { code: string }).code = "CLOUD_MUSIC_NO_LYRICS";
    throw err;
  }

  const lyricsFile = await readFileRecordById(lyricsAsset.fileRecordId);
  if (!lyricsFile || lyricsFile.status !== "uploaded") {
    const err = new Error("歌词文件不存在");
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const url = createCloudMusicAssetUrl(lyricsFile, 3600);
  const format = track.lyricsFormat === "txt" || path.extname(lyricsFile.fileName).toLowerCase() === ".txt"
    ? "txt"
    : "lrc";
  return {
    uuid,
    source: "cloud",
    url,
    expiresAt: Date.now() + 3600 * 1000,
    format,
  };
}
