import { readFile } from "node:fs/promises";
import { requestSystem, unwrapResponse } from "../system/systemClient";
import { isCurrentLibrary, type AccountLibraryContext } from "../account/accountLibraryContext";
export type CoverBinding = { userId: string; playlistId: string; editGeneration: string };
export type CoverReady = CoverBinding & { resourceId: string; uploadId: string; url: string; width: number; height: number };
type CoverToken = CoverBinding & { provider: string; uploadToken: string; uploadUrl: string; key: string; uploadId: string; expiresAt: number };
function assertBinding(value: CoverBinding, binding: CoverBinding) {
  if (!value || value.userId !== binding.userId || value.playlistId !== binding.playlistId || value.editGeneration !== binding.editGeneration) throw new Error("封面响应身份不匹配");
}
function publicHttps(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("封面服务返回无效地址");
  return url.toString();
}
async function request<T>(context: AccountLibraryContext, endpoint: string, body: unknown) {
  if (!isCurrentLibrary(context) || !context.session.loggedIn) throw new Error("封面上传身份已变化");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const response = await Promise.race([
    requestSystem<T>(endpoint, { method: "POST", token: context.session.token, body, recordFailure: false }),
    new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("封面服务请求超时")), 30000); timer.unref(); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
  if (!isCurrentLibrary(context)) throw new Error("封面上传身份已变化");
  // 不调用会在失败时清会话的 refreshAccountSession；401 保留本机待上传项，用户重新登录后续传。
  if (response.code === 401) throw new Error("账号授权已过期，请重新登录后重试封面上传");
  if (!response.success || response.code !== 0) { const error = new Error(response.msg || "封面服务请求失败") as Error & { code: number }; error.code = response.code; throw error; }
  return unwrapResponse(response);
}
export async function requestCoverToken(context: AccountLibraryContext, binding: CoverBinding, fileSize: number) {
  const value = await request<CoverToken>(context, "/api/playlist-covers/upload-token", { playlistId: binding.playlistId, editGeneration: binding.editGeneration, fileName: "cover.jpg", fileSize, mimeType: "image/jpeg" });
  assertBinding(value, binding);
  if (value.provider !== "qiniu" || !value.uploadId || !value.uploadToken || !value.key || value.expiresAt <= Date.now()) throw new Error("封面上传凭据无效");
  publicHttps(value.uploadUrl);
  return value;
}
export async function uploadCoverFile(token: CoverToken, filePath: string, isCurrent: () => boolean) {
  const buffer = await readFile(filePath);
  if (!isCurrent()) throw new Error("封面编辑已变化");
  const form = new FormData();
  form.set("token", token.uploadToken);
  form.set("key", token.key);
  form.set("file", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), "cover.jpg");
  const response = await fetch(publicHttps(token.uploadUrl), { method: "POST", body: form, redirect: "error", signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`封面直传失败（HTTP ${response.status}）`);
  const receipt = await response.json() as { key?: string };
  if (receipt.key !== token.key) throw new Error("封面直传回执不匹配");
}
export async function completeCover(context: AccountLibraryContext, binding: CoverBinding, uploadId: string) {
  const value = await request<CoverReady>(context, "/api/playlist-covers/complete", { uploadId, editGeneration: binding.editGeneration });
  assertBinding(value, binding);
  if (!value.resourceId || value.uploadId !== uploadId || !Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height) || value.width <= 0 || value.height <= 0 || value.width > 8192 || value.height > 8192 || value.width * value.height > 32000000) throw new Error("封面完成回执无效");
  publicHttps(value.url);
  return value;
}
