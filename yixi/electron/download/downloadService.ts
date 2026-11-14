import { identityRevision } from "../account/accountIdentity";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile } from "node:fs/promises";
import path from "node:path";
import { getAppDatabase } from "../database";
import type { DownloadRecordItem, TrackSnapshot } from "../database/types";
import type { PersistedDownloadTask } from "../database/downloadTypes";
import type { DownloadEnqueueItem, DownloadEnqueueOptions, DownloadEnqueueResult, DownloadTaskSnapshot, DownloadDetail, DownloadFileSnapshot } from "../../src/types/download";
import { resolvePlayableUrl } from "../music/musicService";
import { normalizeSong, normalizeSource, normalizeQualityKey, normalizeDirectory, buildBaseName, createUniqueBaseName, getDownloadMetadataOptions, processDownloadAssets } from "./downloadAssets";
import { acquireFileLock, identifyFile } from "./downloadFileLocks";
import { downloadCacheRoot, managedPartPath, readPartSize, removeManagedPart, transferDownload, validateAudio, DownloadFailure } from "./downloadTransfer";
export type { DownloadTaskSnapshot } from "../../src/types/download";
export type DownloadTaskStatus = DownloadTaskSnapshot["status"];
export type DownloadTrackResult = { success: boolean; filePath?: string; cachePath?: string; metadataStatus: "embedded" | "sidecar" | "failed"; message: string };
type Active = { controller: AbortController; action: "pause" | "cancel" | null; promise: Promise<void> };
const active = new Map<string, Active>();
let initialization: Promise<void> | undefined;
let accepting = true;
let timer: ReturnType<typeof setTimeout> | undefined;
let scheduling = false;
let enqueueTail: Promise<void> = Promise.resolve();
const repo = () => getAppDatabase().downloads;
const terminal = (task: PersistedDownloadTask) => ["completed", "failed", "cancelled"].includes(task.status);
function isRecoverable(error: unknown) {
  if (error instanceof DownloadFailure) return error.recoverable;
  const failure=error as { code?: string; response?: { status?: number }; cause?: { code?: string } } | null;
  const code=failure?.code || failure?.cause?.code || "";
  const status=failure?.response?.status || 0;
  return /^(ECONNRESET|ECONNABORTED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ERR_NETWORK)$/.test(code) || status >= 500 || status === 408 || status === 429;
}
function checkpoint(task: PersistedDownloadTask, expectedGeneration=task.generation) {
  const current = repo().task(task.taskId);
  if (!current || current.generation !== expectedGeneration) return;
  if (current.status === "pausing" && ["preparing","running"].includes(task.status)) {
    task.status="pausing"; task.pauseReason=current.pauseReason;
  }
  task.updatedAt = new Date().toISOString(); repo().save(task);
}
function advanceGeneration(task: PersistedDownloadTask) {
  const previous=task.generation;
  task.generation++;
  checkpoint(task,previous);
}
export function taskSnapshot(task: PersistedDownloadTask): DownloadTaskSnapshot {
  const { taskId,fileId,source,songId,qualityKey,name,status,progress,receivedBytes,totalBytes,speedBytesPerSecond,directory,filePath,error,createdAt,updatedAt,retryCount,pauseReason,generation } = task;
  return { taskId,fileId,source,songId,qualityKey,name,status,progress,receivedBytes,totalBytes,speedBytesPerSecond,directory,filePath,error,createdAt,updatedAt,retryCount,pauseReason,generation };
}
export function initializeDownloadService() {
  return initialization ??= (async () => {
    for (const task of repo().tasks()) {
      // 启动不联网，所有未终结状态均暂停；只检查准确记录，不扫描目录。
      if (!terminal(task)) {
        task.status = "paused"; task.pauseReason = "程序重启，等待手动继续";
        task.speedBytesPerSecond = 0; task.retryAt = 0;
        const actual = await readPartSize(task.taskId);
        if (actual !== task.receivedBytes) { task.validator=""; task.validatorKind=""; task.transferComplete=false; }
        task.receivedBytes = actual;
        advanceGeneration(task);
      }
      if (task.status === "completed" && task.fileId) {
        try { await access(task.filePath, constants.R_OK); }
        catch { task.status = "failed"; task.error = "历史下载文件缺失或不可读，保留记录"; checkpoint(task); }
      }
    }
  })();
}
export function enqueueDownloads(items: DownloadEnqueueItem[], options: DownloadEnqueueOptions = {}): Promise<DownloadEnqueueResult> {
  const captured={ identityRevision: options.identityRevision ?? identityRevision() };
  const request=enqueueTail.then(() => enqueueBatch(items,captured));
  enqueueTail=request.then(() => undefined,() => undefined);
  return request;
}
async function enqueueBatch(items: DownloadEnqueueItem[], options: DownloadEnqueueOptions): Promise<DownloadEnqueueResult> {
  const revision = options.identityRevision ?? identityRevision();
  const checkIdentity = () => { if (revision !== identityRevision()) throw new Error("账号已变化，请重新确认下载"); };
  checkIdentity();
  if (!accepting) throw new Error("下载服务正在退出，不能新增任务");
  if (!Array.isArray(items) || !items.length || items.length > 5000) throw new Error("无效下载批次（1–5000项）");
  await initializeDownloadService();
  if (!accepting) throw new Error("下载服务正在退出");
  checkIdentity();
  const existingTasks = repo().tasks();
  const result: DownloadEnqueueResult = { tasks: [], added: 0, existing: 0, rejected: [] };
  const added: PersistedDownloadTask[] = [];
  const setting = getAppDatabase().getSetting<Record<string, unknown>>("local-setting")?.value;
  const configuration = { ...getDownloadMetadataOptions(),namingMode: typeof setting?.songNamingMode === "string" ? setting.songNamingMode : "artist-title" };
  for (let index=0; index<items.length; index++) {
    try {
      const item = items[index]; const song = normalizeSong(item.song); const source = normalizeSource(song.source);
      const qualityKey = normalizeQualityKey(source,item.qualityKey);
      if (item.qualityKey && qualityKey !== item.qualityKey) throw new Error("所选音质当前无权限，请重新选择");
      const directory = normalizeDirectory(item.directory);
      let existing = [...existingTasks,...added].find(task => task.source === source && task.songId === song.id && task.qualityKey === qualityKey && !["failed","cancelled"].includes(task.status) && !(item.redownload === true && task.status === "completed"));
      if (existing?.status === "completed") {
        try { await access(existing.filePath,constants.R_OK); }
        catch { existing.status="failed"; existing.error="已下载文件缺失或不可读"; checkpoint(existing); existing=undefined; }
      }
      if (existing) { result.existing++; result.tasks.push(taskSnapshot(existing)); continue; }
      const now = new Date().toISOString(); const taskId = randomUUID();
      const task: PersistedDownloadTask = {
        taskId,fileId: "",source,songId: song.id,qualityKey,name: song.name || "未知歌曲",status: "queued",
        progress: 0,receivedBytes: 0,totalBytes: 0,speedBytesPerSecond: 0,directory,filePath: "",error: "",createdAt: now,updatedAt: now,
        retryCount: 0,pauseReason: "",generation: 0,payload: song,
        configuration: { ...configuration },
        partPath: managedPartPath(taskId),extension: "",validator: "",validatorKind: "",transferComplete: false,retryAt: 0,legacyId: null,candidateIdentity: "",candidateSize: 0,assets: [],
      };
      added.push(task); result.tasks.push(taskSnapshot(task)); result.added++;
    } catch (error) { result.rejected.push({ index,message: error instanceof Error ? error.message : String(error) }); }
  }
  // 全批校验后一次事务入队，调度只消费已提交任务。
  if (!accepting) throw new Error("下载服务正在退出");
  checkIdentity();
  repo().enqueue(added); schedule(); return result;
}
export async function startDownloadTask(payload: DownloadEnqueueItem) {
  const result = await enqueueDownloads([payload]);
  if (!result.tasks.length) throw new Error(result.rejected[0]?.message || "入队失败");
  return result.tasks[0];
}
export async function listDownloadTasks() { await initializeDownloadService(); return repo().tasks().map(taskSnapshot); }
export async function getDownloadDetail(taskId: string): Promise<DownloadDetail> {
  await initializeDownloadService(); const task = requireTask(taskId);
  return { task: taskSnapshot(task), file: task.fileId ? repo().file(task.fileId) : null, configuration: task.configuration };
}
export async function listDownloadRecords(): Promise<DownloadRecordItem[]> {
  await initializeDownloadService();
  // 旧 UI read model 保留 number id；新权威实体以 fileId 识别，不再覆盖旧唯一键。
  const files = repo().files();
  const legacy = getAppDatabase().listDownloadRecords().filter(record => !files.some(file => file.legacyId === record.id));
  return [...files.map((file,index) => ({
    id: file.legacyId ?? -(index+1), ...file, status: repo().task(file.taskId)?.status === "failed" ? "failed" as const : "completed" as const,
    downloadDirectory: path.dirname(file.filePath),cachePath: "",lyricPath: file.lyricPaths[0] || "",
    totalBytes: file.size,receivedBytes: file.size,createdAt: file.completedAt,updatedAt: file.completedAt,
  })),...legacy];
}
export async function listDownloadedSongs(): Promise<TrackSnapshot[]> { await initializeDownloadService(); return getAppDatabase().listDownloadedSongs(); }
export async function listDownloadFiles() { await initializeDownloadService(); return repo().files(); }
function requireTask(taskId: string) { const task = repo().task(taskId); if (!task) throw new Error("下载任务不存在"); return task; }
export async function pauseDownload(taskId: string, cancel = false) {
  await initializeDownloadService();
  const task = requireTask(taskId);
  if (task.status === "processing") throw new Error("后处理不可中断，请等待完成");
  if (terminal(task)) return taskSnapshot(task);
  const running = active.get(taskId);
  if (running) {
    running.action = cancel ? "cancel" : "pause";
    task.status = "pausing"; task.pauseReason = cancel ? "取消中" : "主动暂停"; checkpoint(task);
    running.controller.abort(new Error(task.pauseReason));
    await running.promise;
  } else {
    if (cancel) await removeManagedPart(task);
    task.status = cancel ? "cancelled" : "paused"; task.pauseReason = cancel ? "" : "主动暂停";
    task.retryAt=0; task.speedBytesPerSecond=0; advanceGeneration(task);
  }
  return taskSnapshot(requireTask(taskId));
}
export async function resumeDownload(taskId: string, retry = false) {
  await initializeDownloadService(); if (!accepting) throw new Error("下载服务正在退出");
  const task = requireTask(taskId);
  if (active.has(taskId)) throw new Error("任务尚未停止，请稍后继续");
  if (task.status !== "paused" && !(retry && task.status === "failed")) return taskSnapshot(task);
  if (retry && task.fileId) {
    // 完成实体缺失后的重试创建新任务，旧 fileId/legacy 映射原样保留。
    const existing=repo().tasks().find(item => item.taskId !== task.taskId && item.source === task.source && item.songId === task.songId && item.qualityKey === task.qualityKey && !terminal(item));
    if (existing) return taskSnapshot(existing);
    const newId=randomUUID(),now=new Date().toISOString();
    const fresh: PersistedDownloadTask={ ...task, taskId:newId,fileId:"",status:"queued",progress:0,receivedBytes:0,totalBytes:0,speedBytesPerSecond:0,
      filePath:"",error:"",createdAt:now,updatedAt:now,retryCount:0,pauseReason:"",generation:0,partPath:managedPartPath(newId),extension:"",
      validator:"",validatorKind:"",transferComplete:false,retryAt:0,legacyId:null,candidateIdentity:"",candidateSize:0,assets:[],
    };
    repo().enqueue([fresh]); schedule(); return taskSnapshot(fresh);
  }
  task.status="queued"; task.pauseReason=""; task.error=""; task.retryAt=0;
  if (retry) task.retryCount=0;
  advanceGeneration(task); schedule(); return taskSnapshot(task);
}
export async function pauseAllDownloads() {
  await initializeDownloadService();
  const ids = repo().tasks().filter(task => !terminal(task) && task.status !== "processing").map(task => task.taskId);
  return Promise.all(ids.map(id => pauseDownload(id)));
}
export async function resumeAllDownloads() {
  await initializeDownloadService();
  const ids = repo().tasks().filter(task => task.status === "paused").map(task => task.taskId);
  return Promise.all(ids.map(id => resumeDownload(id)));
}
function concurrency() {
  const value = Number(getAppDatabase().getSetting<Record<string,unknown>>("local-setting")?.value?.downloadConcurrency);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 2;
}
function schedule(delay=0) {
  if (!accepting) return;
  if (timer) clearTimeout(timer);
  timer=setTimeout(() => { timer=undefined; void pump().catch(error => console.error("下载调度失败",error)); },delay);
}
async function pump() {
  if (scheduling || !accepting) return; scheduling=true;
  try {
    await initializeDownloadService();
    while (accepting && active.size < concurrency()) {
      const task=repo().tasks().find(item => item.status === "queued" && !active.has(item.taskId) && item.retryAt <= Date.now());
      if (!task) break;
      task.status="preparing"; task.error=""; advanceGeneration(task);
      const run: Active = { controller: new AbortController(), action: null, promise: Promise.resolve() };
      active.set(task.taskId,run);
      run.promise=execute(task,run).finally(() => { active.delete(task.taskId); schedule(); });
      void run.promise.catch(error => console.error("下载任务检查点失败",error));
    }
    const next=repo().tasks().filter(item => item.status === "queued" && item.retryAt > Date.now()).sort((a,b)=>a.retryAt-b.retryAt)[0];
    if (next && active.size < concurrency()) schedule(Math.max(1,next.retryAt-Date.now()));
  } finally { scheduling=false; }
}
async function execute(task: PersistedDownloadTask, run: Active) {
  // 超时只终止网络阶段，PROCESSING 始终等待其安全结束。
  const timeout=setTimeout(() => { if (task.status !== "processing") run.controller.abort(new DownloadFailure("下载网络超时",true)); }, 15*60*1000);
  try {
    const quality=normalizeQualityKey(normalizeSource(task.source),task.qualityKey);
    if (quality !== task.qualityKey) throw new DownloadFailure("音质权限已变化，请重新选择音质");
    try { await access(task.directory,constants.W_OK); }
    catch { task.status="paused"; task.pauseReason="原下载目录缺失或不可写，请恢复目录后继续"; checkpoint(task); return; }
    if (run.controller.signal.aborted) throw run.controller.signal.reason;
    let complete = task.transferComplete;
    if (complete) { try { await validateAudio(managedPartPath(task.taskId),task.totalBytes); } catch { complete=false; task.transferComplete=false; } }
    if (!complete) {
      // 不保存 URL；每次执行都重新授权并取链。
      const url = await resolvePlayableUrl({ ...task.payload,source: normalizeSource(task.source),qualityKey: task.qualityKey });
      if (!url) throw new DownloadFailure("播放地址为空",true);
      if (normalizeQualityKey(normalizeSource(task.source),task.qualityKey) !== task.qualityKey) throw new DownloadFailure("取链期间音质权限已变化，请重新选择音质");
      if (run.controller.signal.aborted) throw run.controller.signal.reason;
      await transferDownload(task,url,run.controller.signal,() => checkpoint(task));
    }
    if (run.controller.signal.aborted) throw run.controller.signal.reason;
    task.status="processing"; task.pauseReason=""; task.speedBytesPerSecond=0; checkpoint(task);
    await finalize(task);
  } catch (error) {
    const latest=repo().task(task.taskId);
    if (!latest || latest.generation !== task.generation) return;
    const message=error instanceof Error ? error.message : String(error);
    if (run.action) {
      if (run.action === "cancel") {
        try { await removeManagedPart(task); task.receivedBytes=0; }
        catch (cleanup) { task.error=`取消时临时文件未清理：${String(cleanup)}`; }
      }
      task.status=run.action === "cancel" ? "cancelled" : "paused";
      task.pauseReason=run.action === "pause" ? "已暂停" : "";
    } else {
      const reason=run.controller.signal.aborted ? run.controller.signal.reason : error;
      const retry=isRecoverable(reason) && task.retryCount < 2 && accepting && task.status !== "processing";
      task.error=message;
      if (retry) { task.retryCount++; task.retryAt=Date.now()+1000*2**task.retryCount; task.status="queued"; }
      else task.status="failed";
    }
    task.speedBytesPerSecond=0; task.receivedBytes=await readPartSize(task.taskId); checkpoint(task);
  } finally { clearTimeout(timeout); }
}
async function finalize(task: PersistedDownloadTask) {
  const partLease=await acquireFileLock(managedPartPath(task.taskId),`processing:${task.taskId}`);
  try { await finalizeOwned(task); }
  finally { partLease.release(); }
  try { await removeManagedPart(task); task.partPath=""; checkpoint(task); }
  catch (error) { console.warn("已完成任务临时文件清理失败",error); }
}
async function finalizeOwned(task: PersistedDownloadTask) {
  const part=managedPartPath(task.taskId);
  const audio=await validateAudio(part,task.totalBytes);
  task.extension=audio.extension;
  let lease: Awaited<ReturnType<typeof acquireFileLock>> | undefined;
  // 有准确的已提交文件 identity 才允许重启后补做；未知同名文件始终保留并另取名称。
  if (task.filePath && task.candidateIdentity) {
    try {
      const identity=await identifyFile(task.filePath);
      let unownedSidecar=false;
      for (const extension of ["lrc","krc","yrc"]) {
        const assetPath=path.join(path.dirname(task.filePath),`${path.parse(task.filePath).name}.${extension}`);
        try {
          const asset=await identifyFile(assetPath);
          if (!task.assets.some(known => known.path === assetPath && known.identity === asset.identity)) unownedSidecar=true;
        } catch (error: any) { if (error?.code !== "ENOENT") unownedSidecar=true; }
      }
      if (identity.identity === task.candidateIdentity && !unownedSidecar) { await validateAudio(task.filePath,0); lease=await acquireFileLock(task.filePath,`processing:${task.taskId}`); }
    } catch { /* 旧候选缺失/损坏则保留，重新从完整 .part 排它提交 */ }
  }
  while (!lease) {
    const base=await createUniqueBaseName(task.directory,buildBaseName(task.payload,{songNamingMode:task.configuration.namingMode}),task.extension || "mp3");
    task.filePath=path.join(task.directory,`${base}.${task.extension || "mp3"}`); task.candidateIdentity=""; task.candidateSize=audio.size; checkpoint(task);
    const candidate=await acquireFileLock(task.filePath,`processing:${task.taskId}`,"exclusive",true);
    try {
      await copyFile(part,task.filePath,constants.COPYFILE_EXCL);
      const identity=await identifyFile(task.filePath);
      task.candidateIdentity=identity.identity; checkpoint(task);
      // 新 inode 也纳入锁；路径锁在整个交接期间始终持有。
      lease=await acquireFileLock(task.filePath,`processing:${task.taskId}`);
    } catch (error: any) { if (error?.code !== "EEXIST") throw error; }
    finally { candidate.release(); }
  }
  try {
    const assets=await processDownloadAssets(task.filePath,downloadCacheRoot(),task.taskId,task.payload,task.qualityKey,task.configuration,{
      assets: task.assets,
      record: asset => { task.assets.push(asset); checkpoint(task); },
    });
    const final=await validateAudio(task.filePath,0);
    task.candidateSize=final.size; checkpoint(task);
    const file: DownloadFileSnapshot={
      fileId: randomUUID(),taskId: task.taskId,filePath: task.filePath,source: task.source,songId: task.songId,qualityKey: task.qualityKey,
      size: final.size,durationMs: final.durationMs,metadataStatus: assets.metadataStatus,metadataJsonPath: assets.metadataJsonPath,coverPath: assets.coverPath,
      lyricPaths: assets.lyricPaths,payload:{...task.payload,downloadLyricPaths:assets.lyricPaths},completedAt:new Date().toISOString(),legacyId:null,message:assets.message,
    };
    task.fileId=file.fileId; task.status="completed"; task.progress=100; task.error=""; task.updatedAt=file.completedAt;
    repo().complete(task,file);
  } finally { lease.release(); }
}
export async function shutdownDownloads(timeoutMs=30000): Promise<boolean> {
  accepting=false;
  if (timer) { clearTimeout(timer); timer=undefined; }
  if (!initialization) return true;
  await initialization;
  for (const task of repo().tasks()) {
    if (task.status === "queued" || task.status === "paused") { task.status="paused"; task.pauseReason="程序退出"; task.retryAt=0; checkpoint(task); }
    const run=active.get(task.taskId);
    if (run && task.status !== "processing") {
      task.status="pausing"; task.pauseReason="程序退出"; checkpoint(task);
      run.action="pause"; run.controller.abort(new Error("程序退出"));
    }
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const settled=await Promise.race([
    Promise.allSettled([enqueueTail,...[...active.values()].map(run=>run.promise)]).then(()=>true),
    new Promise<false>(resolve=> { timeout=setTimeout(()=>resolve(false),timeoutMs); }),
  ]);
  if (timeout) clearTimeout(timeout);
  return settled;
}
