import { dialog, nativeImage } from "electron";
import { randomUUID } from "node:crypto";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getAppDataPath } from "../core/appPaths";
import { getAppDatabase } from "../database";
import { captureAccountLibrary, isCurrentLibrary } from "../account/accountLibraryContext";
import type { PlaylistCoverSelection } from "../../src/types/playlistCover";
const ASSETS_KEY = "main/private/playlist-cover-assets";
type Asset = { userId: string; createdAt: number; importedOwners?: string[] };
const MAX = 5 * 1024 * 1024;
const validId = (value: string) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
export function coverAssetPath(assetId: string, userId: string) {
  const assets = getAppDatabase().getSetting<Record<string, Asset>>(ASSETS_KEY)?.value ?? {};
  if (!validId(assetId) || !(assets[assetId]?.userId === userId || assets[assetId]?.importedOwners?.includes(userId))) throw new Error("本机封面不可用，请重新选择");
  return path.join(getAppDataPath("covers", "playlists"), `${assetId}.jpg`);
}
export function coverAssetPreview(assetId: string, userId: string) {
  try { return `data:image/jpeg;base64,${readFileSync(coverAssetPath(assetId, userId)).toString("base64")}`; }
  catch { return ""; }
}
export async function selectManagedPlaylistCover(): Promise<PlaylistCoverSelection | null> {
  const context = captureAccountLibrary();
  const result = await dialog.showOpenDialog({ title: "选择歌单封面", properties: ["openFile"], filters: [{ name: "JPG / PNG / WebP（最大 5MiB）", extensions: ["jpg", "jpeg", "png", "webp"] }] });
  if (!isCurrentLibrary(context)) throw new Error("账号已变化，请重新选择");
  if (result.canceled || !result.filePaths.length) return null;
  const source = result.filePaths[0];
  const info = await stat(source);
  if (!info.isFile() || info.size <= 0 || info.size > MAX) throw new Error("封面必须是 5MiB 以内的 JPG、PNG 或 WebP 图片");
  const bytes = await readFile(source);
  if (bytes.length > MAX) throw new Error("封面不能超过 5MiB");
  const ext = path.extname(source).toLowerCase();
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!((jpeg && [".jpg", ".jpeg"].includes(ext)) || (png && ext === ".png") || (webp && ext === ".webp"))) throw new Error("图片内容与扩展名不一致");
  let image = nativeImage.createFromBuffer(bytes);
  const size = image.getSize();
  if (image.isEmpty() || !size.width || !size.height || size.width > 8192 || size.height > 8192 || size.width * size.height > 32000000) throw new Error("图片无法解码或尺寸过大");
  // 重新编码消除 EXIF/原文件附带数据；只保存受管副本，renderer 不接触文件路径。
  const scale = Math.min(1, 1024 / Math.max(size.width, size.height));
  image = image.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)), quality: "good" });
  const encoded = image.toJPEG(88);
  if (!encoded.length || encoded.length > MAX) throw new Error("图片压缩失败，请选择其他图片");
  if (!isCurrentLibrary(context)) throw new Error("账号已变化，请重新选择");
  const assetId = randomUUID();
  await mkdir(getAppDataPath("covers", "playlists"), { recursive: true });
  await writeFile(path.join(getAppDataPath("covers", "playlists"), `${assetId}.jpg`), encoded, { flag: "wx" });
  if (!isCurrentLibrary(context)) throw new Error("账号已变化，请重新选择");
  const assets = getAppDatabase().getSetting<Record<string, Asset>>(ASSETS_KEY)?.value ?? {};
  assets[assetId] = { userId: context.scope.accountId, createdAt: Date.now() };
  getAppDatabase().setSetting(ASSETS_KEY, assets);
  return { assetId, preview: `data:image/jpeg;base64,${encoded.toString("base64")}` };
}

/** 只能由 main 明确确认导入调用；共享受管副本，不更改未关联原件的归属。 */
export function authorizeImportedCoverAsset(assetId: string, targetUserId: string) {
  coverAssetPath(assetId, "");
  const assets = getAppDatabase().getSetting<Record<string, Asset>>(ASSETS_KEY)?.value ?? {};
  const asset = assets[assetId];
  asset.importedOwners = [...new Set([...(asset.importedOwners ?? []), targetUserId])];
  getAppDatabase().setSetting(ASSETS_KEY, assets);
}
