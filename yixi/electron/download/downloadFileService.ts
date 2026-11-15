import { shell } from "electron";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { lstat, realpath, stat, unlink } from "node:fs/promises";
import { getAppDatabase } from "../database";
import { acquireFileLock, identifyFile } from "./downloadFileLocks";
import type { FileIdentity } from "./downloadFileLocks";
import { initializeDownloadService, taskSnapshot } from "./downloadService";
import { removeManagedPart } from "./downloadTransfer";
import { beginDownloadFileOperation } from "./downloadOperationGuard";
import type { DownloadDeleteItem, DownloadDeletePreview, DownloadDeleteResult, DownloadFileDetail, DownloadFileTarget, LocalFileRemoveResult } from "../../src/types/download";

const repo = () => getAppDatabase().downloads;
type ConfirmedFile = { canonicalPath: string; identity: string; size: number; error?: string };
const previews = new Map<string, { expires: number; targets: DownloadFileTarget[]; files: Map<string, ConfirmedFile> }>();
const key = (value: string) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
class PhysicalDeleteError extends Error {
  readonly audioDeleted: boolean;
  constructor(error: unknown, audioDeleted: boolean) { super(message(error)); this.audioDeleted = audioDeleted; }
}
function resolveTarget(target: DownloadFileTarget) {
  if (!target || (!target.fileId && !target.taskId)) throw new Error("请提供可信下载文件或任务 ID");
  const file = target.fileId ? repo().file(target.fileId) : null;
  const task = repo().task(target.taskId || file?.taskId || "");
  if (!task || (target.fileId && (!file || file.taskId !== task.taskId))) throw new Error("下载记录不存在或已变化");
  const actualFile = file || (task.fileId ? repo().file(task.fileId) : null);
  if (task.fileId && !actualFile) throw new Error("下载文件映射不完整，保留记录");
  return { task, file: actualFile };
}

export async function previewDownloadDelete(input: { targets?: DownloadFileTarget[]; all?: boolean }): Promise<DownloadDeletePreview> {
  await initializeDownloadService();
  if (!input || (input.all !== true && !Array.isArray(input.targets))) throw new Error("无效删除范围");
  const targets = input.all === true ? repo().tasks().map(task => ({ taskId: task.taskId, ...(task.fileId ? { fileId: task.fileId } : {}) }))
    : input.targets!.map(target => { const { task, file } = resolveTarget(target); return { taskId: task.taskId, ...(file ? { fileId: file.fileId } : {}) }; });
  const frozen = [...new Map(targets.map(target => [target.taskId, target])).values()];
  if (frozen.length > 20000) throw new Error("删除范围过大，请分批处理");
  for (const [id, preview] of previews) if (preview.expires <= Date.now()) previews.delete(id);
  if (previews.size >= 32) throw new Error("待确认删除过多，请稍后重试");
  const files = new Map<string, ConfirmedFile>();
  for (const target of frozen) {
    const { task, file } = resolveTarget(target);
    if (!file) continue;
    try { const actual = await identifyFile(file.filePath, true); files.set(task.taskId, actual); }
    catch (error: any) {
      files.set(task.taskId, { canonicalPath: path.resolve(file.filePath), identity: "", size: 0,
        ...(error?.code === "ENOENT" ? {} : { error: message(error) }) });
    }
  }
  const previewId = randomUUID();
  previews.set(previewId, { expires: Date.now() + 5 * 60_000, targets: structuredClone(frozen), files });
  return { previewId, targets: frozen, count: frozen.length };
}

/** 只从 main 索引收集引用；同路径、硬链接和未完成候选都参与保护。 */
export async function hasOtherReference(file: FileIdentity, excluded: { fileId?: string; taskId?: string; localId?: string }, lyricPath?: string) {
  const db = getAppDatabase();
  const paths: string[] = [];
  const retainedFiles = repo().files().filter(item => item.fileId !== excluded.fileId);
  paths.push(...retainedFiles.map(item => item.filePath));
  paths.push(...db.listLocalSongs().filter(item => item.id !== excluded.localId).map(item => item.filePath));
  paths.push(...repo().tasks().filter(item => item.taskId !== excluded.taskId && !["completed", "cancelled"].includes(item.status)).map(item => item.filePath).filter(Boolean));
  paths.push(...repo().tasks().filter(item => item.taskId !== excluded.taskId).flatMap(item => item.retainedCandidates?.map(candidate => candidate.filePath) || []));
  const mappedLegacy = new Set(repo().files().map(item => item.legacyId));
  const ownLegacy = excluded.fileId ? repo().file(excluded.fileId)?.legacyId : undefined;
  const legacy = db.listDownloadRecords().filter(item => item.id !== ownLegacy && !mappedLegacy.has(item.id));
  paths.push(...legacy.map(item => item.filePath).filter((item): item is string => Boolean(item)));
  if (lyricPath) {
    const explicitLyrics = [
      ...retainedFiles.flatMap(item => item.lyricPaths),
      ...legacy.flatMap(item => [item.lyricPath, ...(Array.isArray(item.payload.downloadLyricPaths) ? item.payload.downloadLyricPaths : [])]),
      ...repo().tasks().filter(item => item.taskId !== excluded.taskId).flatMap(item => item.assets.map(asset => asset.path)),
      ...repo().tasks().filter(item => item.taskId !== excluded.taskId).flatMap(item => item.retainedCandidates?.flatMap(candidate => candidate.assets.map(asset => asset.path)) || []),
    ];
    if (explicitLyrics.some(item => typeof item === "string" && key(item) === key(lyricPath))) return true;
    // 同目录同 basename 的不同音频也可能读取同一 sidecar。
    if (paths.some(item => key(path.join(path.dirname(item), path.parse(item).name)) === key(path.join(path.dirname(lyricPath), path.parse(lyricPath).name)))) return true;
    paths.push(...explicitLyrics.filter((item): item is string => typeof item === "string" && Boolean(item)));
  }
  for (const candidate of paths) {
    if (key(candidate) === key(file.canonicalPath)) return true;
    try { if ((await identifyFile(candidate)).identity === file.identity) return true; }
    catch (error: any) { if (error?.code !== "ENOENT") throw new Error("其他文件引用无法核验，保留物理文件"); }
  }
  return false;
}

async function recheck(identity: FileIdentity) {
  const current = await identifyFile(identity.canonicalPath);
  if (identity.identity !== current.identity || identity.size !== current.size) throw new Error("文件已被其他程序改变，保留记录后重试");
}

/** 下载和本地曲库共用的唯一物理删除入口。未知路径永远不能进入此函数。 */
export async function deleteTrustedAudio(filePath: string, owner: { fileId?: string; taskId?: string; localId?: string }, lyricPaths: string[], expected?: ConfirmedFile) {
  if (expected?.error) throw new Error(`预览时无法核验文件，拒绝物理删除：${expected.error}`);
  let lease;
  try { lease = await acquireFileLock(filePath, `delete:${randomUUID()}`, "exclusive", true); }
  catch (error: any) {
    if (error?.code === "ENOENT") {
      if (expected?.identity) throw new Error("预览后文件或目录已变化，请重新确认");
      return { deleted: false, status: "removed" as const, message: "原目录已缺失，仅移除记录" };
    }
    if (message(error).includes("占用")) return { deleted: false, status: "occupied" as const, message: message(error) };
    throw error;
  }
  let deleted = false;
  try {
    if (expected && (key(expected.canonicalPath) !== key(lease.file.canonicalPath) || expected.identity !== lease.file.identity || expected.size !== lease.file.size)) throw new Error("预览后文件身份、大小或缺失状态已变化，拒绝删除替换实体");
    const task = owner.taskId ? repo().task(owner.taskId) : null;
    if (lease.file.identity && task?.candidateIdentity && task.candidateIdentity !== lease.file.identity) throw new Error("音频已被替换，拒绝删除未知实体");
    const local = owner.localId ? getAppDatabase().listLocalSongs().find(item => item.id === owner.localId) : null;
    if (lease.file.identity && local && local.size !== lease.file.size) throw new Error("本地音频已改变，请先重新扫描");
    if (await hasOtherReference(lease.file, owner)) return { deleted: false, status: "shared" as const, message: "其他实体仍引用音频，已保留物理文件" };
    // 音频成功删除后才允许清理 sidecar；缺失音频的重试继续精确清理歌词。
    if (lease.file.identity) {
      await recheck(lease.file);
      await unlink(lease.file.canonicalPath);
      deleted = true;
    }
    const stem = path.join(path.dirname(filePath), path.parse(filePath).name);
    for (const lyric of new Set(lyricPaths)) {
      if (![".lrc", ".krc", ".yrc"].some(ext => key(lyric) === key(`${stem}${ext}`))) continue;
      let lyricLease;
      try { lyricLease = await acquireFileLock(lyric, `delete-lyric:${randomUUID()}`); }
      catch (error: any) { if (error?.code === "ENOENT") continue; throw error; }
      try {
        if (await hasOtherReference(lyricLease.file, owner, lyric)) continue;
        await recheck(lyricLease.file);
        await unlink(lyricLease.file.canonicalPath);
      } finally { lyricLease.release(); }
    }
    return { deleted, status: "removed" as const, message: deleted ? "已删除音频及可安全删除的歌词" : "音频已缺失，已清理可安全删除的歌词" };
  } catch (error) { throw new PhysicalDeleteError(error, deleted); }
  finally { lease.release(); }
}

export async function deleteDownloads(input: { previewId: string; deleteFiles?: boolean; confirmed?: boolean }): Promise<DownloadDeleteResult> {
  if (typeof input?.deleteFiles !== "boolean") throw new Error("请明确是否删除物理文件");
  if (input.deleteFiles && input.confirmed !== true) throw new Error("删除物理文件必须再次明确确认");
  const preview = previews.get(input.previewId);
  if (!preview || preview.expires <= Date.now()) throw new Error("删除预览已过期，请重新确认");
  previews.delete(input.previewId);
  const items: DownloadDeleteItem[] = [];
  for (const target of preview.targets) {
    const result: DownloadDeleteItem = { ...target, recordsRemoved: 0, filesDeleted: 0, status: "not-executed", message: "" };
    let finish: (() => void) | undefined;
    try {
      const { task, file } = resolveTarget(target);
      finish = beginDownloadFileOperation(task.taskId);
      if (!["completed", "failed", "cancelled"].includes(task.status)) {
        result.message = task.status === "processing" ? "后处理不可中断，请完成后重试" : "任务必须先取消后才能移除";
      } else {
        // 未完成任务仅清受管 part；归属不明的候选音频绝不删除。
        await removeManagedPart(task);
        if (file && input.deleteFiles) {
          const expected = preview.files.get(task.taskId);
          if (!expected) throw new Error("删除预览未包含此文件实体，请重新确认");
          const outcome = await deleteTrustedAudio(file.filePath, { fileId: file.fileId, taskId: task.taskId }, file.lyricPaths, expected);
          result.status = outcome.status; result.message = outcome.message; result.filesDeleted = Number(outcome.deleted);
        } else { result.status = "removed"; result.message = "仅移除记录，保留音频和歌词"; }
        // 再读状态防止与重试/继续竞态；repo 的删除在一次同步事务内提交。
        if (result.status !== "shared" && result.status !== "occupied") {
          const latest = repo().task(task.taskId);
          if (!latest || latest.generation !== task.generation || latest.status !== task.status) throw new Error("任务已变化，请重新预览");
          repo().removeEntry(task.taskId, file?.fileId);
          result.recordsRemoved = 1;
        } else if (file) repo().saveFile({ ...file, message: result.message });
      }
    } catch (error) {
      result.status = "failed"; result.message = message(error);
      if (error instanceof PhysicalDeleteError) result.filesDeleted = Number(error.audioDeleted);
      const file = target.fileId ? repo().file(target.fileId) : null;
      if (file) repo().saveFile({ ...file, message: `删除失败：${result.message}` });
      else if (target.taskId) {
        const task = repo().task(target.taskId);
        if (task) repo().save({ ...task, error: `移除失败：${result.message}` });
      }
    }
    finally { finish?.(); }
    items.push(result);
  }
  return {
    recordsRemoved: items.reduce((sum, item) => sum + item.recordsRemoved, 0),
    filesDeleted: items.reduce((sum, item) => sum + item.filesDeleted, 0),
    sharedSkipped: items.filter(item => item.status === "shared").length,
    occupied: items.filter(item => item.status === "occupied").length,
    failed: items.filter(item => item.status === "failed").length,
    notExecuted: items.filter(item => item.status === "not-executed").length, items,
  };
}

export async function getDownloadFileDetail(target: DownloadFileTarget): Promise<DownloadFileDetail> {
  await initializeDownloadService();
  const { task, file } = resolveTarget(target);
  let actual: DownloadFileDetail["stat"] = { exists: false, size: 0, modifiedAt: "", identity: "", error: "文件尚未生成" };
  if (file) {
    try {
      const identity = await identifyFile(file.filePath); const info = await stat(identity.canonicalPath);
      actual = { exists: true, size: info.size, modifiedAt: info.mtime.toISOString(), identity: identity.identity, error: "" };
      const latest = repo().task(task.taskId);
      if (latest && !latest.candidateIdentity && latest.fileId === file.fileId && repo().file(file.fileId)?.filePath === file.filePath) {
        // legacy 没有历史 inode；首次详情展示建立基线，后续修复不能改绑到替换实体。
        repo().save({ ...latest, candidateIdentity: identity.identity, candidateSize: identity.size });
      }
    } catch (error) { actual.error = message(error); }
  }
  return { task: taskSnapshot(task), file, configuration: task.configuration, stat: actual };
}
export async function revealDownloadFile(target: DownloadFileTarget) {
  await initializeDownloadService();
  const { file } = resolveTarget(target);
  if (!file) throw new Error("下载尚未生成文件，请打开下载目录");
  const actual = await identifyFile(file.filePath);
  shell.showItemInFolder(actual.canonicalPath);
}
export async function openDownloadDirectory(target: DownloadFileTarget) {
  await initializeDownloadService();
  const { task, file } = resolveTarget(target);
  const directory = file ? path.dirname(file.filePath) : task.directory;
  let cursor = path.resolve(directory);
  while (true) {
    if ((await lstat(cursor)).isSymbolicLink()) throw new Error("下载目录包含重解析点");
    const parent = path.dirname(cursor); if (parent === cursor) break; cursor = parent;
  }
  const actual = await realpath(directory);
  if (!(await stat(actual)).isDirectory()) throw new Error("下载目录不存在");
  const error = await shell.openPath(actual); if (error) throw new Error(error);
}

/** 旧 renderer 路径仅作索引查找提示；实际操作必须回到 main 实体。 */
export async function removeTrustedLocalSong(input: { filePath?: string; deleteFile?: boolean; localId?: string; fileId?: string }): Promise<LocalFileRemoveResult> {
  await initializeDownloadService();
  const db = getAppDatabase();
  const local = input.localId ? db.listLocalSongs().find(item => item.id === input.localId)
    : db.listLocalSongs().find(item => input.filePath && key(item.filePath) === key(input.filePath));
  const file = input.fileId ? repo().file(input.fileId) : repo().files().find(item => input.filePath && key(item.filePath) === key(input.filePath));
  if ((input.fileId && !file) || (input.localId && !local)) throw new Error("可信实体 ID 不存在，不能降级按路径删除");
  if (!local && !file) throw new Error("文件不在可信本地索引或下载实体中");
  if (file && (!local || input.fileId)) {
    const preview = await previewDownloadDelete({ targets: [{ fileId: file.fileId }] });
    const result = await deleteDownloads({ previewId: preview.previewId, deleteFiles: input.deleteFile === true, confirmed: input.deleteFile === true });
    const item = result.items[0];
    return { removed: result.recordsRemoved > 0, deleted: result.filesDeleted > 0,
      status: item?.status === "removed" ? input.deleteFile ? result.filesDeleted ? "deleted" : "missing" : "record-only" : item?.status || "failed",
      reason: item?.message || "移除失败" };
  }
  const trusted = local!;
  const finish = beginDownloadFileOperation(`local:${trusted.id}`);
  try {
    const outcome = input.deleteFile === true ? await deleteTrustedAudio(trusted.filePath, { localId: trusted.id }, []) : { deleted: false };
    if ("status" in outcome && (outcome.status === "shared" || outcome.status === "occupied")) return { removed: false, deleted: false, status: outcome.status, reason: outcome.message };
    db.removeLocalSongByFilePath(trusted.filePath);
    return { removed: true, deleted: outcome.deleted, status: input.deleteFile ? outcome.deleted ? "deleted" : "missing" : "record-only", reason: input.deleteFile ? "音频与索引已安全处理" : "仅移除索引，保留物理文件" };
  } catch (error) { return { removed: false, deleted: error instanceof PhysicalDeleteError && error.audioDeleted, status: "failed", reason: message(error) }; }
  finally { finish(); }
}
