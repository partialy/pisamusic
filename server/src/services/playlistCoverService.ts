import path from "node:path";
import { randomUUID } from "node:crypto";
import { createCoverSession, readCoverUpload, readOwnedCover, completeCoverSession, type CoverResource } from "../db/playlistCoverStore";
import { readFileRecordById } from "../db/files/fileRecordStore";
import { createPlaylistCoverUploadToken, statQiniuObjectInSpace, buildUrl } from "./qiniuReleaseFiles";
import { SyncValidationError } from "./syncPayloadPolicy";
const MIME: Record<string,string> = { ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png", ".webp":"image/webp" };
function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) throw new SyncValidationError(`${name} 无效`);
  return value.trim();
}
function generation(value: unknown): string {
  const result = text(value,"editGeneration",128);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(result)) throw new SyncValidationError("editGeneration 必须是稳定的字母数字标识");
  return result;
}
function dto(resource: CoverResource) {
  return { resourceId:resource.id, userId:resource.owner_user_id, playlistId:resource.playlist_id,
    uploadId:resource.upload_id, editGeneration:resource.edit_generation, url:resource.public_url,
    width:Number(resource.width),height:Number(resource.height) };
}
export async function createPlaylistCoverToken(userId: string, raw: unknown) {
  const b = raw as Record<string,unknown> | null;
  const playlistId = text(b?.playlistId,"playlistId",256);
  const editGeneration = generation(b?.editGeneration);
  const fileName = text(b?.fileName,"fileName",255);
  const mimeType = text(b?.mimeType,"mimeType",80).toLowerCase();
  const fileSize = b?.fileSize;
  if (typeof fileSize !== "number" || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > 5 * 1024 * 1024) throw new SyncValidationError("封面必须在 1B 至 5MiB 之间");
  if (MIME[path.extname(fileName).toLowerCase()] !== mimeType) throw new SyncValidationError("封面仅支持 JPG、PNG、WebP，扩展名与 MIME 必须一致");
  const uploadId = randomUUID(), resourceId = randomUUID();
  const token = createPlaylistCoverUploadToken({userId,playlistId,uploadId,editGeneration,fileName,fileSize});
  await createCoverSession(userId,{id:resourceId,uploadId,playlistId,editGeneration,publicUrl:token.downloadUrl,expiresAt:token.expiresAt,
    file:{id:randomUUID(),usageType:"playlist-cover",ownerType:"user",ownerUserId:userId,ownerSnapshot:{userId},platform:"",version:"",assetType:"image",provider:"qiniu",bucket:token.bucket,objectKey:token.key,hash:"",fileName,mimeType,fileSize}});
  return {...token,uploadId,userId,playlistId,editGeneration};
}
export async function completePlaylistCover(userId: string, raw: unknown) {
  const b = raw as Record<string,unknown> | null;
  const uploadId = text(b?.uploadId,"uploadId",128), editGeneration = generation(b?.editGeneration);
  const session = await readCoverUpload(userId,uploadId);
  if (!session || session.edit_generation !== editGeneration) throw new SyncValidationError("上传会话不存在或编辑代次不匹配");
  if (session.state === "ready") return readPlaylistCover(userId,session.id);
  if (session.state !== "pending" || Number(session.expires_at) < Date.now()) throw new SyncValidationError("上传会话已过期或失效，请重新上传");
  const file = await readFileRecordById(session.file_record_id);
  if (!file || file.status !== "pending") throw new SyncValidationError("封面对象账本不可用");
  const stat = await statQiniuObjectInSpace("public-image",file.bucket,file.objectKey);
  if (stat.fileSize !== file.fileSize || stat.mimeType !== file.mimeType || stat.fileSize > 5 * 1024 * 1024) throw new SyncValidationError("封面实际大小或 MIME 与会话不一致");
  // 仅访问服务端受控对象 URL，七牛解析图片实际格式/可解码性；禁止客户端 URL 和重定向。
  const response = await fetch(`${buildUrl(file.objectKey,"public-image")}?imageInfo`,{signal:AbortSignal.timeout(10000),redirect:"error"});
  if (!response.ok) throw new SyncValidationError("封面图片无法解码");
  const info = await response.json() as {format?:string;width?:number;height?:number};
  const format = String(info.format ?? "").toLowerCase();
  const detectedMime = format === "jpg" || format === "jpeg" ? "image/jpeg" : `image/${format}`;
  if (!["jpeg","jpg","png","webp"].includes(format) || detectedMime !== file.mimeType
    || !Number.isSafeInteger(info.width) || !Number.isSafeInteger(info.height)
    || Number(info.width) < 1 || Number(info.height) < 1 || Number(info.width) > 8192 || Number(info.height) > 8192
    || Number(info.width) * Number(info.height) > 32000000) throw new SyncValidationError("封面实际格式或尺寸不合法（单边≤8192，总像素≤3200万）");
  return dto(await completeCoverSession(userId,session,{hash:stat.hash,width:info.width!,height:info.height!}));
}
export async function readPlaylistCover(userId: string, resourceId: string) {
  const row = await readOwnedCover(userId,text(resourceId,"resourceId",128));
  if (!row || row.state !== "ready") throw new SyncValidationError("封面资源不存在或不可用，请重新上传");
  const file = await readFileRecordById(row.file_record_id);
  if (!file || file.status !== "uploaded") throw new SyncValidationError("封面对象不可用，请重新上传");
  return dto(row);
}
