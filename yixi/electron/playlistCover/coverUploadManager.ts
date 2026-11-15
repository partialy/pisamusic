import { app, BrowserWindow, net } from "electron";
import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { captureAccountLibrary, isCurrentLibrary, type AccountLibraryContext } from "../account/accountLibraryContext";
import { onAccountIdentityChanged } from "../account/accountIdentity";
import { getAppDatabase } from "../database";
import { scheduleLibrarySync } from "../sync/syncService";
import type { PlaylistSnapshot, UserPlaylistItem } from "../database/types";
import { authorizeImportedCoverAsset, coverAssetPath, coverAssetPreview } from "./coverAssets";
import { completeCover, requestCoverToken, uploadCoverFile, type CoverReady } from "./coverClient";
import { PLAYLIST_COVER_PRESETS, type PlaylistCoverStatus, type PlaylistEditInput, type PlaylistLocalCoverView } from "../../src/types/playlistCover";
import { PLAYLIST_COVER_JOBS_KEY as KEY, playlistCoverFingerprint as fingerprint } from "./coverState";
let stopping = false;
type Job = { userId: string; playlistId: string; editGeneration: string; expectedLocalCover: string; assetId: string; editedAt: number; state: PlaylistCoverStatus["state"]; message: string; attempts: number; nextAt: number; uploadId?: string; uploaded?: boolean; ready?: CoverReady };
function jobs() { return getAppDatabase().getSetting<Record<string, Job>>(KEY)?.value ?? {}; }
function keyOf(userId: string, playlistId: string) { return JSON.stringify([userId, playlistId]); }
function put(job: Job) {
  const all = jobs();
  const key = keyOf(job.userId, job.playlistId);
  const previous = all[key];
  // 网络等待期间允许同一代次改名/改曲目，不能用捕获的旧任务回写倒退用户时钟。
  all[key] = previous?.editGeneration === job.editGeneration ? { ...job, editedAt: Math.max(job.editedAt, previous.editedAt) } : job;
  getAppDatabase().setSetting(KEY, all);
}
function forget(userId: string, playlistId: string) { const all = jobs(); delete all[keyOf(userId, playlistId)]; getAppDatabase().setSetting(KEY, all); }
function currentPlaylist(context: AccountLibraryContext, playlistId: string) { return context.repo.listUserPlaylists("local").find(item => item.playlistId === playlistId || item.payload.id === playlistId); }
function stillCurrent(context: AccountLibraryContext, job: Job) {
  if (stopping || !isCurrentLibrary(context) || context.scope.accountId !== job.userId) return false;
  const actual = jobs()[keyOf(job.userId, job.playlistId)];
  const playlist = currentPlaylist(context, job.playlistId);
  return actual?.editGeneration === job.editGeneration && !!playlist && fingerprint(playlist.payload) === job.expectedLocalCover;
}
export function notifyPlaylistCoverChanged() {
  BrowserWindow.getAllWindows().forEach(win => win.webContents.send("mine-library:changed"));
}
export function decoratePlaylist(context: AccountLibraryContext, item: UserPlaylistItem): UserPlaylistItem & { payload: PlaylistSnapshot & PlaylistLocalCoverView } {
  const job = jobs()[keyOf(context.scope.accountId, item.payload.id)];
  if (!job || !stillCurrent(context, job)) return item;
  const preview = coverAssetPreview(job.assetId, job.userId);
  return { ...item, payload: { ...item.payload, coverLocalPreview: preview || undefined, coverUploadStatus: { state: job.state, message: preview ? job.message : "本机封面副本缺失，可恢复默认或重新选择", canRetry: !!job.userId && !!preview } } };
}
function metadata(input: PlaylistEditInput) {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 40 || typeof input.desc !== "string" || input.desc.length > 160 || !Array.isArray(input.tags) || input.tags.length > 3) throw new Error("请检查歌单标题、描述和标签");
  const tags = input.tags.map(tag => { if (typeof tag.name !== "string" || !tag.name.trim() || tag.name.length > 12) throw new Error("标签格式无效"); return { id: tag.name.trim(), name: tag.name.trim() }; });
  return { name: input.name.trim(), desc: input.desc.trim(), tags };
}
export function savePlaylistEdit(context: AccountLibraryContext, input: PlaylistEditInput) {
  if (!isCurrentLibrary(context) || input.identityRevision !== context.revision) throw new Error("账号已变化，请重新编辑");
  const patch: Partial<PlaylistSnapshot> = metadata(input);
  const choice = input.coverChoice;
  if (!choice || !["keep", "local", "default", "preset"].includes(choice.kind)) throw new Error("封面选择无效");
  if (choice.kind === "local") coverAssetPath(choice.assetId, context.scope.accountId);
  if (choice.kind === "preset" && !(PLAYLIST_COVER_PRESETS as readonly string[]).includes(choice.preset)) throw new Error("封面预设无效");
  if (choice.kind !== "keep") Object.assign(patch, { cover: "", coverSize: { s: "", m: "", l: "", xl: "" }, coverResource: null, coverPreset: choice.kind === "preset" ? choice.preset : null });
  const db = getAppDatabase();
  const item = db.applySyncTransaction(() => {
    const result = input.playlistId ? context.repo.updateUserPlaylist(input.playlistId, patch) : context.repo.createUserPlaylist(patch).playlist;
    const id = result.payload.id;
    if (choice.kind !== "keep") forget(context.scope.accountId, id);
    if (choice.kind === "local") put({ userId: context.scope.accountId, playlistId: id, editGeneration: randomUUID(), expectedLocalCover: fingerprint(result.payload), assetId: choice.assetId, editedAt: Date.parse(result.updatedAt), state: context.scope.accountId ? "queued" : "local", message: context.scope.accountId ? "封面已保存在本机，等待上传" : "封面仅保存在本机，未关联账号", attempts: 0, nextAt: 0 });
    return result;
  });
  notifyPlaylistCoverChanged(); scheduleLibrarySync(); wakeCoverUploads();
  return decoratePlaylist(context, item);
}
export function discardPlaylistCover(context: AccountLibraryContext, playlistId: string) { forget(context.scope.accountId, playlistId); }
export function retryPlaylistCover(context: AccountLibraryContext, playlistId: string) {
  const previous = jobs()[keyOf(context.scope.accountId, playlistId)];
  if (!previous || !stillCurrent(context, previous)) throw new Error("当前封面已变化，请重新选择本机图片");
  coverAssetPath(previous.assetId, context.scope.accountId);
  if (!context.scope.accountId) throw new Error("未关联歌单不能上传至其他账号");
  // 已引用资源失效（同步400）时显式解绑并生成新 outbox，绝不替换 URL 假装成功。
  if (previous.state === "synced") {
    getAppDatabase().applySyncTransaction(() => {
      const result = context.repo.updateUserPlaylist(playlistId, { cover: "", coverResource: null, coverPreset: null });
      put({ ...previous, editGeneration: randomUUID(), editedAt: Date.parse(result.updatedAt), expectedLocalCover: fingerprint(result.payload), state: "queued", attempts: 0, nextAt: 0, ready: undefined, uploadId: undefined, uploaded: undefined, message: "使用本机副本重新上传" });
    });
    scheduleLibrarySync();
  } else put({ ...previous, state: previous.ready ? "ready" : "queued", attempts: 0, nextAt: 0, message: "等待重试上传" });
  notifyPlaylistCoverChanged(); wakeCoverUploads();
}
let started = false;
let draining = false;
let wakeAgain = false;
export function startCoverUploads() {
  if (started) return;
  started = true;
  onAccountIdentityChanged(wakeCoverUploads);
  app.once("before-quit", () => { stopping = true; });
  const timer = setInterval(wakeCoverUploads, 60000);
  timer.unref();
  wakeCoverUploads();
}
export function wakeCoverUploads() {
  if (stopping) return;
  if (draining) { wakeAgain = true; return; }
  draining = true;
  void drain().catch(() => { /* 每项错误已持久化；启动/身份变更继续恢复。 */ }).finally(() => { draining = false; if (wakeAgain) { wakeAgain = false; wakeCoverUploads(); } });
}
async function drain() {
  const context = captureAccountLibrary();
  if (!context.scope.accountId || !net.isOnline()) return;
  const pending = Object.values(jobs()).filter(job => job.userId === context.scope.accountId && job.state !== "synced" && job.attempts < 3 && job.nextAt <= Date.now());
  for (const saved of pending) {
    if (stopping || !isCurrentLibrary(context)) return;
    if (!stillCurrent(context, saved)) { if (jobs()[keyOf(saved.userId, saved.playlistId)]?.editGeneration === saved.editGeneration) forget(saved.userId, saved.playlistId); continue; }
    let job = { ...saved, state: "uploading" as Job["state"], message: "正在上传封面" };
    put(job); notifyPlaylistCoverChanged();
    try {
      const filePath = coverAssetPath(job.assetId, job.userId);
      const binding = { userId: job.userId, playlistId: job.playlistId, editGeneration: job.editGeneration };
      if (!job.ready) {
        if (!job.uploadId || !job.uploaded) {
          const token = await requestCoverToken(context, binding, (await stat(filePath)).size);
          if (!stillCurrent(context, job)) continue;
          // 不持久化 token/key/url，只保存可幂等 complete 的 uploadId。
          job = { ...job, uploadId: token.uploadId, uploaded: false }; put(job);
          await uploadCoverFile(token, filePath, () => stillCurrent(context, job));
          if (!stillCurrent(context, job)) continue;
          job = { ...job, uploaded: true }; put(job);
        }
        const ready = await completeCover(context, binding, job.uploadId!);
        if (!stillCurrent(context, job)) continue;
        job = { ...job, ready, state: "ready", message: "封面已上传，等待建立歌单引用" }; put(job);
      }
      if (!stillCurrent(context, job)) continue;
      getAppDatabase().applySyncTransaction(() => {
        if (!stillCurrent(context, job)) throw new Error("封面编辑已变化");
        // 同封面代次的改名/增删歌曲会推进真实用户时钟；不使用上传完成时间覆盖他端更新。
        const editedAt = jobs()[keyOf(job.userId, job.playlistId)].editedAt;
        const result = context.repo.updateUserPlaylist(job.playlistId, { cover: job.ready!.url, coverResource: { resourceId: job.ready!.resourceId }, coverPreset: null }, { clientUpdatedAt: new Date(editedAt).toISOString() });
        put({ ...job, editedAt, expectedLocalCover: fingerprint(result.payload), state: "synced", message: "封面上传完成；同步失败时可使用本机副本重新上传" });
      });
      notifyPlaylistCoverChanged(); scheduleLibrarySync();
    } catch (error) {
      if (!stillCurrent(context, job)) continue;
      const message = error instanceof Error ? error.message : "封面上传失败";
      // complete 400（过期/对象不存在）可由本机副本重新上传；ready 引用未提交则保留 ready 重试本地事务。
      if (!job.ready && (error as { code?: number }).code === 400) job = { ...job, uploadId: undefined, uploaded: undefined };
      const attempts = job.attempts + 1;
      put({ ...job, state: "failed", attempts, nextAt: Date.now() + [60000, 300000, 1800000][Math.min(attempts - 1, 2)], message: `${message}；本机图片已保留，可重试或恢复默认` });
      notifyPlaylistCoverChanged();
    }
  }
}

/** 仅在权威远端变更实际应用时调用；同设备空 cover 回声保留本机副本。 */
export function acceptRemotePlaylistCover(context: AccountLibraryContext, change: import("../system/systemClient").SyncChange, playlistId: string) {
  const job = jobs()[keyOf(context.scope.accountId, playlistId)];
  if (!job || change.deviceId === context.scope.deviceIdentity) return;
  const raw = change.payload as Record<string, unknown> | null;
  const explicitCover = raw && ["cover", "coverResource", "coverPreset"].some(field => Object.prototype.hasOwnProperty.call(raw, field));
  const existing = currentPlaylist(context, playlistId);
  // 他端只改名且仍引用同一已发布图片时，保留本机离线副本。
  if (change.action !== "delete" && job.state === "synced" && existing && raw && fingerprint({ ...existing.payload, ...raw } as PlaylistSnapshot) === job.expectedLocalCover) return;
  // 即使新图与旧图都是空 cover，其他设备较新的明确恢复默认也取消本机上传代次。
  if (change.action === "delete" || (explicitCover && Date.parse(change.clientUpdatedAt) >= job.editedAt)) forget(job.userId, job.playlistId);
}

/** 与显式导入歌单同一事务复制私有引用，源 guest 原件和物理图片保留。 */
export function importUnassociatedPlaylistCovers(context: AccountLibraryContext, imported: { originalId: string; importedId: string }[]) {
  if (!context.scope.accountId) throw new Error("导入封面需要登录账号");
  const sourceRepo = getAppDatabase().accountLibrary({ ...context.scope, accountId: "" });
  for (const mapping of imported) {
    const original = sourceRepo.listUserPlaylists("local").find(item => item.payload.id === mapping.originalId);
    const previous = jobs()[keyOf("", mapping.originalId)];
    const copy = currentPlaylist(context, mapping.importedId);
    if (!original || !previous || !copy || previous.expectedLocalCover !== fingerprint(original.payload)) continue;
    authorizeImportedCoverAsset(previous.assetId, context.scope.accountId);
    put({ userId: context.scope.accountId, playlistId: mapping.importedId, editGeneration: randomUUID(), expectedLocalCover: fingerprint(copy.payload), assetId: previous.assetId, editedAt: Date.parse(copy.updatedAt), state: "queued", message: "已导入本机封面，等待上传", attempts: 0, nextAt: 0 });
  }
}
