import path from "node:path";
import { readCloudMusicTrack } from "../../db/cloudMusicStore";
import { readFileRecordById } from "../../db/configStore";
import { CLOUD_MUSIC_LYRICS_MAX_SIZE, createCloudMusicAssetUrl } from "../cloudMusicAssets";
import { validateCloudMusicSignedUrl } from "../cloudMusicMetadata";

export type CloudMusicLyricsText = { text: string; format: "lrc" | "txt"; fileName: string };

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
  const ext = path.extname(file.fileName).toLowerCase();
  if (ext !== ".lrc" && ext !== ".txt") throw new Error("不支持的歌词文件格式");
  if (!Number.isSafeInteger(file.fileSize) || file.fileSize <= 0 || file.fileSize > CLOUD_MUSIC_LYRICS_MAX_SIZE) {
    throw new Error("歌词文件大小超出限制 (2MB)");
  }
  const url = validateCloudMusicSignedUrl(createCloudMusicAssetUrl(file, 60));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new Error(`歌词文件读取失败：HTTP ${response.status}`);
    const size = response.headers.get("content-length");
    if (size !== null && (!/^\d+$/.test(size) || Number(size) !== file.fileSize)) {
      throw new Error("歌词文件 Content-Length 与登记大小不一致");
    }
    if (!response.body) throw new Error("歌词文件内容为空");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > file.fileSize || received > CLOUD_MUSIC_LYRICS_MAX_SIZE) throw new Error("歌词文件实际大小超出限制");
      chunks.push(value);
    }
    if (received !== file.fileSize) throw new Error("歌词文件实际大小与登记大小不一致");
    // 原样返回对象中的 UTF-8 文本，保留空白、时间标签与 metadata 标签。
    return { text: Buffer.concat(chunks).toString("utf8"), format: ext === ".txt" ? "txt" : "lrc", fileName: file.fileName };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
