import { promisify } from "node:util";
import { inflate } from "node:zlib";
import { readCloudMusicTrack } from "../../db/cloudMusicStore";
import { readFileRecordById } from "../../db/configStore";
import {
  CLOUD_MUSIC_LYRICS_MAX_SIZE,
  createCloudMusicAssetReadUrl,
  getCloudMusicLyricsFormat,
  type CloudMusicFileLocation,
  type CloudMusicLyricsFormat,
} from "../cloudMusicAssets";
import { readCloudMusicDownload } from "../cloudMusicMetadata";

export type CloudMusicLyricsText = { text: string; format: CloudMusicLyricsFormat; fileName: string };

const inflateLyrics = promisify(inflate);
const KRC_HEADER = Buffer.from("krc1");
const KRC_KEY = Buffer.from("@Gaw^2tGQ61-\xCE\xD2ni", "latin1");

export async function readCloudMusicLyricsText(file: CloudMusicFileLocation & { fileName: string; fileSize: number }): Promise<string> {
  const signedUrl = createCloudMusicAssetReadUrl(file, 60);
  const chunks: Uint8Array[] = [];
  await readCloudMusicDownload({ signedUrl, expectedSize: file.fileSize }, CLOUD_MUSIC_LYRICS_MAX_SIZE, (chunk) => {
    chunks.push(chunk);
  }, 15_000);

  let data = Buffer.concat(chunks);
  if (getCloudMusicLyricsFormat(file.fileName) === "krc" && data.subarray(0, KRC_HEADER.length).equals(KRC_HEADER)) {
    const payload = data.subarray(KRC_HEADER.length);
    for (let i = 0; i < payload.length; i++) payload[i] ^= KRC_KEY[i % KRC_KEY.length];
    try {
      data = await inflateLyrics(payload, { maxOutputLength: CLOUD_MUSIC_LYRICS_MAX_SIZE });
    } catch {
      throw new Error("无法解码 KRC 歌词文件");
    }
  }
  if (data[0] === 0xff && data[1] === 0xfe) return new TextDecoder("utf-16le").decode(data);
  if (data[0] === 0xfe && data[1] === 0xff) return new TextDecoder("utf-16be").decode(data);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return new TextDecoder("gb18030").decode(data);
  }
}

function notFound(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 404 });
}

/** 仅读取曲目当前歌词对象，禁止由请求指定下载地址；不写临时文件或数据库。 */
export async function getAdminLyricsText(uuid: string): Promise<CloudMusicLyricsText> {
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw notFound("网盘音乐曲目不存在");
  const asset = track.assets.find((item) => item.kind === "lyrics" && item.isCurrent && item.state === "uploaded" && item.deletedAt === null);
  if (!asset) throw notFound("该曲目暂无歌词");
  const file = await readFileRecordById(asset.fileRecordId);
  if (!file || file.status !== "uploaded" || file.deletedAt !== null || file.usageType !== "cloud-music") {
    throw notFound("歌词文件不存在");
  }
  return {
    text: await readCloudMusicLyricsText(file),
    format: getCloudMusicLyricsFormat(file.fileName, track.lyricsFormat),
    fileName: file.fileName,
  };
}
