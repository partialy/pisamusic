import { lstat, mkdir, open, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";
import { getAppDataPath } from "../core/appPaths";
import type { PersistedDownloadTask } from "../database/downloadTypes";
import { inferAudioExtension } from "./downloadAssets";
import { acquireFileLock, identifyFile } from "./downloadFileLocks";
export class DownloadFailure extends Error {
  readonly recoverable: boolean;
  constructor(message: string, recoverable = false) { super(message); this.recoverable = recoverable; }
}
export const downloadCacheRoot = () => path.join(getAppDataPath(), "downloads", "tasks");
export function managedPartPath(taskId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(taskId)) throw new Error("无效任务标识");
  return path.join(downloadCacheRoot(), `${taskId}.part`);
}
export async function removeManagedPart(task: PersistedDownloadTask) {
  const part = managedPartPath(task.taskId);
  try { await lstat(part); }
  catch (error: any) { if (error?.code === "ENOENT") return; throw error; }
  const lease = await acquireFileLock(part, `cleanup:${task.taskId}`, "exclusive", true);
  try {
    const current = await identifyFile(part);
    if (current.identity !== lease.file.identity || current.size !== lease.file.size) throw new Error("临时文件已变化，保留记录等待重试");
    await unlink(part).catch((error: any) => { if (error?.code !== "ENOENT") throw error; });
  }
  finally { lease.release(); }
}
export async function readPartSize(taskId: string) { return stat(managedPartPath(taskId)).then(info => info.size, () => 0); }
function validator(headers: Headers) {
  const etag = headers.get("etag")?.trim();
  if (etag && !/^W\//i.test(etag) && /^"[^\r\n]*"$/.test(etag)) return { validator: etag, validatorKind: "etag" as const };
  const modified = headers.get("last-modified")?.trim();
  if (modified && Number.isFinite(Date.parse(modified))) return { validator: modified, validatorKind: "last-modified" as const };
  return { validator: "", validatorKind: "" as const };
}
export async function validateAudio(filePath: string, expectedSize: number) {
  const info = await stat(filePath);
  if (!info.isFile() || info.size <= 0 || (expectedSize > 0 && info.size !== expectedSize)) throw new DownloadFailure("音频字节校验失败");
  let metadata;
  try { metadata = await parseFile(filePath, { skipCovers: true, duration: true }); }
  catch { throw new DownloadFailure("文件不是可读取的音频"); }
  if (!metadata.format.container || !metadata.format.codec || !(metadata.format.duration && metadata.format.duration > 0)) throw new DownloadFailure("未识别到完整可读音频");
  const container=metadata.format.container.toLowerCase();
  const extension = /flac/.test(container) ? "flac" : /mpeg/.test(container) ? "mp3" : /ogg/.test(container) ? "ogg" : /wave|wav/.test(container) ? "wav" : /mp4|m4a|isom/.test(container) ? "m4a" : /adts|aac/.test(container) ? "aac" : "";
  if (!extension) throw new DownloadFailure("音频容器不在支持的下载格式中");
  return { size: info.size, durationMs: Math.round(metadata.format.duration * 1000), extension };
}
/** 写入句柄只在本方法持有；返回/抛错前必定关闭，再以实际长度提交检查点。 */
export async function transferDownload(task: PersistedDownloadTask, url: string, signal: AbortSignal, checkpoint: () => void) {
  await mkdir(downloadCacheRoot(), { recursive: true });
  const part = managedPartPath(task.taskId);
  const lease = await acquireFileLock(part, `transfer:${task.taskId}`, "exclusive", true);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const actual = await readPartSize(task.taskId);
    const canRange = actual > 0 && actual === task.receivedBytes && task.totalBytes > actual && Boolean(task.validator && task.validatorKind);
    let offset = canRange ? actual : 0;
    const headers: Record<string,string> = { "Accept-Encoding": "identity" };
    if (offset) { headers.Range = `bytes=${offset}-`; headers["If-Range"] = task.validator; }
    const request = () => fetch(url, { headers, signal });
    let response = await request();
    let current = validator(response.headers);
    const range = response.headers.get("content-range")?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    const length = Number(response.headers.get("content-length")) || 0;
    const validRange = offset > 0 && response.status === 206 && range && Number(range[1]) === offset && Number(range[2]) >= offset && Number(range[3]) === task.totalBytes && Number(range[2]) === task.totalBytes - 1 && (!length || length === task.totalBytes - offset) && current.validatorKind === task.validatorKind && current.validator === task.validator;
    if (offset && !validRange) {
      await response.body?.cancel();
      offset = 0; delete headers.Range; delete headers["If-Range"];
      response = await request(); current = validator(response.headers);
    }
    if (!response.ok || (!offset && response.status !== 200)) {
      await response.body?.cancel();
      // 音源签名过期只允许通过整个 execute 重新授权取链，仍共享最多两次重试上限。
      throw new DownloadFailure(`下载响应失败：HTTP ${response.status}`, response.status >= 500 || [401,403,408,429].includes(response.status));
    }
    if (signal.aborted) { await response.body?.cancel(); throw signal.reason; }
    const encoding = response.headers.get("content-encoding");
    const contentType = response.headers.get("content-type") || "";
    if ((encoding && encoding !== "identity") || /(?:text\/|json|xml|html)/i.test(contentType)) {
      await response.body?.cancel(); throw new DownloadFailure("服务器返回非原始音频内容");
    }
    task.extension = inferAudioExtension(url, contentType, task.qualityKey);
    task.partPath = part;
    task.totalBytes = offset ? task.totalBytes : Number(response.headers.get("content-length")) || 0;
    task.receivedBytes = offset;
    Object.assign(task,current,{ status: "running", transferComplete: false });
    checkpoint();
    handle = await open(part, offset ? "a" : "w");
    reader = response.body?.getReader();
    if (!reader) throw new DownloadFailure("服务器响应缺少音频流", true);
    const started = Date.now(); let lastCheckpoint = 0;
    while (true) {
      if (signal.aborted) throw signal.reason;
      const { done, value } = await reader.read();
      if (done) break;
      let written = 0;
      while (written < value.length) { const result = await handle.write(value, written, value.length - written); if (!result.bytesWritten) throw new DownloadFailure("写入音频失败"); written += result.bytesWritten; }
      task.receivedBytes += value.length;
      if (task.totalBytes && task.receivedBytes > task.totalBytes) throw new DownloadFailure("响应音频超过声明大小");
      task.progress = task.totalBytes ? Math.min(99, task.receivedBytes / task.totalBytes * 100) : 0;
      task.speedBytesPerSecond = Math.round((task.receivedBytes - offset) * 1000 / Math.max(1,Date.now()-started));
      if (Date.now()-lastCheckpoint > 500) { checkpoint(); lastCheckpoint=Date.now(); }
    }
    await handle.sync();
    if (!task.totalBytes) throw new DownloadFailure("响应缺少可信总长度，保留临时文件待重新下载");
    if (task.receivedBytes !== task.totalBytes) throw new DownloadFailure("音频传输不完整", true);
  } catch (error) {
    if (signal.aborted || error instanceof DownloadFailure) throw error;
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code && /^(ENOSPC|EACCES|EPERM|EROFS|ENOENT|EIO)$/.test(code)) throw new DownloadFailure(`文件写入失败：${code}`);
    throw new DownloadFailure(error instanceof Error ? error.message : String(error), true);
  } finally {
    try {
      await reader?.cancel().catch(() => undefined);
      await handle?.close();
      task.receivedBytes = await readPartSize(task.taskId);
      task.speedBytesPerSecond = 0;
      checkpoint();
    } finally { lease.release(); }
  }
  const audio = await validateAudio(part,task.totalBytes);
  task.extension = audio.extension || task.extension;
  task.transferComplete = true; checkpoint();
}
