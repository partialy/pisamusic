import { randomUUID } from "node:crypto";
import path from "node:path";
import { readAppShareConfig, saveAppShareConfig, rememberAppShareUpload, readAppShareUpload, completeAppShareUpload, type AppShareConfig } from "../db/appShareStore";
import { createFileRecord, readAppConfig, readFileRecordById } from "../db/configStore";
import { buildUrl, createAppShareIconUploadToken, statQiniuObjectInSpace } from "./qiniuReleaseFiles";
import { deletingAppShareIcons } from "./appShareIconLifecycle";

export const DEFAULT_APP_SHARE_ICON = "/static/app-share/default.png";
const MIME_BY_EXT: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
function text(value: unknown, name: string, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error(`${name}格式不正确，最多 ${max} 字`);
  return value.trim();
}
export async function normalizeAppShareConfig(body: unknown): Promise<Omit<AppShareConfig, "updatedAt">> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("请求体必须是对象");
  const b = body as Record<string, unknown>;
  const qrCodeText = text(b.qrCodeText, "二维码链接", 1000, true);
  if (Buffer.byteLength(qrCodeText, "utf8") > 2000) throw new Error("二维码链接 UTF-8 长度不能超过 2000 字节");
  let url: URL;
  try { url = new URL(qrCodeText); } catch { throw new Error("二维码链接必须是完整 HTTP/HTTPS URL"); }
  if (url.origin !== "https://pisamusic.partialy.cn" || url.username || url.password || !/^\/app-share\/?$/.test(url.pathname) || url.hash || url.searchParams.has("code")) throw new Error("二维码链接必须是本站 HTTPS /app-share/ 路径，不能包含 code 或锚点");
  if ([...url.searchParams].some(([key, value]) => !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key) || value.length > 200)) throw new Error("二维码链接查询参数无效");
  url.pathname = "/app-share/";
  const iconFileId = b.iconFileId === null ? null : text(b.iconFileId, "图标文件 ID", 120, true);
  if (iconFileId) {
    const file = (await readFileRecordById(iconFileId));
    if (!file || file.usageType !== "app-share-icon" || file.status !== "uploaded" || deletingAppShareIcons.has(iconFileId)) throw new Error("图标文件无效或正在删除");
  }
  return { appName: text(b.appName, "App 名称", 60, true), versionOverride: text(b.versionOverride, "版本覆盖", 40),
    iconFileId, description: text(b.description, "描述", 500), qrCodeText: url.toString(), copyTemplate: text(b.copyTemplate, "复制模板", 1000) };
}
export function renderAppShareCopy(template: string, url: string): string {
  return template.includes("{url}") ? template.split("{url}").join(url) : [template, url].filter(Boolean).join("\n");
}
export async function readPublicAppShare() {
  const cfg = (await readAppShareConfig());
  const rawVersion = cfg.versionOverride || (await readAppConfig()).releases.android.latestVersion;
  const version = !rawVersion || /^v?0\.0\.0$/i.test(rawVersion) ? "" : rawVersion;
  const file = cfg.iconFileId ? (await readFileRecordById(cfg.iconFileId)) : null;
  const iconUrl = file?.status === "uploaded" ? buildUrl(file.objectKey, "public-image") : DEFAULT_APP_SHARE_ICON;
  return { appName: cfg.appName, version, iconUrl, description: cfg.description, qrCodeText: cfg.qrCodeText,
    copyText: renderAppShareCopy(cfg.copyTemplate, cfg.qrCodeText), updatedAt: cfg.updatedAt };
}
export async function readAdminAppShare() { return { ...(await readAppShareConfig()), ...(await readPublicAppShare()) }; }
export async function saveManagedAppShare(body: unknown) { (await saveAppShareConfig((await normalizeAppShareConfig(body)))); return (await readAdminAppShare()); }
export async function createAppShareIconToken(body: unknown) {
  const b = body as Record<string, unknown> | null;
  const fileName = text(b?.fileName, "文件名", 255, true);
  const mimeType = text(b?.mimeType, "图片类型", 80, true).toLowerCase();
  const fileSize = b?.fileSize;
  if (typeof fileSize !== "number" || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > 2 * 1024 * 1024) throw new Error("图标大小必须在 1B 至 2MiB 之间");
  if (MIME_BY_EXT[path.extname(fileName).toLowerCase()] !== mimeType) throw new Error("图标仅支持 JPG、PNG、WebP，扩展名与 MIME 必须一致");
  const input = { fileName, fileSize, mimeType };
  const token = createAppShareIconUploadToken(input);
  (await rememberAppShareUpload(token.key, { ...input, bucket: token.bucket }, token.expiresAt));
  return token;
}
function iconDto(file: NonNullable<Awaited<ReturnType<typeof readFileRecordById>>>) {
  return { fileId: file.id, url: buildUrl(file.objectKey, "public-image"), fileName: file.fileName, fileSize: file.fileSize, mimeType: file.mimeType };
}
export async function completeAppShareIcon(body: unknown) {
  const b = body as Record<string, unknown> | null;
  const key = text(b?.key, "对象 Key", 500, true);
  const bucket = text(b?.bucket, "空间", 255, true);
  const session = (await readAppShareUpload(key));
  if (!session) throw new Error("上传会话不存在");
  const input = JSON.parse(session.input_json) as { fileName: string; fileSize: number; mimeType: string; bucket: string };
  if (input.bucket !== bucket) throw new Error("上传空间不匹配");
  if (session.file_id) {
    const existing = (await readFileRecordById(session.file_id));
    if (!existing || existing.status !== "uploaded") throw new Error("图标已删除，请重新上传");
    return iconDto(existing);
  }
  if (session.expires_at < Date.now()) throw new Error("上传会话已过期，请重新上传");
  const stat = await statQiniuObjectInSpace("public-image", bucket, key);
  if (stat.fileSize !== input.fileSize || stat.mimeType !== input.mimeType) throw new Error("图片实际大小或类型与声明不一致");
  // imageInfo 由七牛解析实际对象，不信任客户端提交的宽高或文件扩展名。
  const response = await fetch(`${buildUrl(key, "public-image")}?imageInfo`, { signal: AbortSignal.timeout(10000), redirect: "error" });
  if (!response.ok) throw new Error("七牛图片信息核验失败");
  const info = await response.json() as { format?: string; width?: number; height?: number };
  const format = String(info.format ?? "").toLowerCase();
  if (!["jpeg", "jpg", "png", "webp"].includes(format) || !Number.isSafeInteger(info.width) || Number(info.width) <= 0 || info.width !== info.height) throw new Error("图标必须是 JPG、PNG、WebP 正方形图片");
  const detectedMime = format === "jpg" || format === "jpeg" ? "image/jpeg" : `image/${format}`;
  if (detectedMime !== input.mimeType) throw new Error("图片实际格式与声明不一致");
  // 并发 complete 可能已先登记，避免旧请求将已删除对象重新标记为 uploaded。
  const completed = (await readAppShareUpload(key));
  if (completed?.file_id) {
    const existing = (await readFileRecordById(completed.file_id));
    if (!existing || existing.status !== "uploaded" || deletingAppShareIcons.has(existing.id)) throw new Error("图标已删除或正在删除，请重新上传");
    return iconDto(existing);
  }
  const file = (await createFileRecord({ id: randomUUID(), usageType: "app-share-icon", platform: "", version: "", assetType: "image", provider: "qiniu", bucket, objectKey: key,
    hash: stat.hash, fileName: input.fileName, mimeType: stat.mimeType, fileSize: stat.fileSize, downloadUrl: "" }));
  (await completeAppShareUpload(key, file.id));
  return iconDto(file);
}
