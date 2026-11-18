import { constants } from "node:fs";
import { nativeImage } from "electron";
import { copyFile, link, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseFile } from "music-metadata";
import { getAppDatabase } from "../database";
import { acquireFileLock, identifyFile } from "./downloadFileLocks";
import { beginDownloadFileOperation } from "./downloadOperationGuard";
import { initializeDownloadService } from "./downloadService";
import { validateAudio } from "./downloadTransfer";
import { fillMissingAudioMetadata } from "./audioMetadataWriter";
import { fetchCover } from "./downloadAssets";
import { buildDownloadLyrics } from "./downloadLyrics";
import { getDownloadFileDetail, hasOtherReference } from "./downloadFileService";
import { fetchLyrics } from "../music/musicService";
import type { DownloadBatchRepairResult, DownloadFileTarget } from "../../src/types/download";

export async function repairDownloadFile(target: DownloadFileTarget) {
  await initializeDownloadService();
  const repo = getAppDatabase().downloads;
  const file = target?.fileId ? repo.file(target.fileId) : target?.taskId ? repo.files().find(item => item.taskId === target.taskId) : null;
  if (!file || (target.taskId && file.taskId !== target.taskId)) throw new Error("可信下载文件不存在");
  const task = repo.task(file.taskId);
  if (!task || !["completed", "failed"].includes(task.status)) throw new Error("请等待下载后处理完成");
  if (!task.candidateIdentity) throw new Error("历史文件尚未确认身份，请先查看文件详情后再修复");
  const finish = beginDownloadFileOperation(task.taskId);
  let lease: Awaited<ReturnType<typeof acquireFileLock>> | undefined;
  let temporary = "", backup = "", temporaryIdentity = "", backupIdentity = "";
  let replaced = false, committed = false;
  try {
    lease = await acquireFileLock(file.filePath, `repair:${randomUUID()}`);
    if (await hasOtherReference(lease.file, { fileId: file.fileId, taskId: task.taskId })) throw new Error("其他实体仍引用此音频，暂不修复共享文件");
    if (task.candidateIdentity !== lease.file.identity || (task.candidateSize > 0 && task.candidateSize !== lease.file.size)) throw new Error("音频身份或大小已变化，请重新确认文件");
    const existing = await parseFile(lease.file.canonicalPath, { duration: false });
    let lyrics = "";
    if (task.configuration.embedDownloadLyrics && !existing.common.lyrics?.length) {
      const stem = path.join(path.dirname(file.filePath), path.parse(file.filePath).name);
      for (const asset of file.lyricPaths) {
        if (path.resolve(asset) !== path.resolve(`${stem}.lrc`)) continue;
        let actual;
        try { actual = await identifyFile(asset); }
        catch (error: any) { if (error?.code === "ENOENT") continue; throw error; }
        if (actual.size > 2 * 1024 * 1024) continue;
        lyrics = await readFile(actual.canonicalPath, "utf8"); if (lyrics.trim()) break;
      }
      if (!lyrics) {
        const fetched = file.source === "kg" || file.source === "wy"
          ? await fetchLyrics({
              source: file.source,
              id: file.songId,
              hash: String(file.payload.urlParam || ""),
            }).catch(() => ({ krc: "", lrc: "" }))
          : { krc: "", lrc: "" };
        lyrics = buildDownloadLyrics(file.source, fetched, {
          lyric: String(file.payload.lyric || ""),
          krc: String(file.payload.krc || ""),
        }).standardLrc;
      }
    }
    let cover = null;
    if (task.configuration.embedDownloadCover && !existing.common.picture?.length) {
      if (file.coverPath) {
        try {
          const asset = await identifyFile(file.coverPath);
          if (asset.size <= 5 * 1024 * 1024) {
            const image = nativeImage.createFromBuffer(await readFile(asset.canonicalPath));
            if (!image.isEmpty()) cover = { data: image.toPNG(), mimeType: "image/png" };
          }
        } catch { /* 旧封面资产缺失时再按既有高清候选补缺。 */ }
      }
      cover ??= await fetchCover(file.payload);
    }
    const token = randomUUID();
    temporary = path.join(path.dirname(file.filePath), `.${path.parse(file.filePath).name}.pisa-repair-${token}${path.extname(file.filePath)}`);
    backup = path.join(path.dirname(file.filePath), `.${path.basename(file.filePath)}.pisa-backup-${token}`);
    await copyFile(lease.file.canonicalPath, temporary, constants.COPYFILE_EXCL);
    temporaryIdentity = (await identifyFile(temporary)).identity;
    await fillMissingAudioMetadata(temporary, {
      title: String(file.payload.name || ""), artist: String(file.payload.singer || ""), album: String(file.payload.album || ""),
      source: file.source, songId: file.songId, qualityKey: file.qualityKey, lyrics, cover,
    }, { embedTags: task.configuration.embedDownloadTags, embedCover: task.configuration.embedDownloadCover, embedLyrics: task.configuration.embedDownloadLyrics });
    const validated = await validateAudio(temporary, 0);
    const original = await identifyFile(file.filePath);
    if (original.identity !== lease.file.identity || original.size !== lease.file.size) throw new Error("修复期间原音频已改变，保留原文件");
    // 同目录硬链接备份不覆盖任何未知文件；原路径保持可读直到原子 rename。
    await link(lease.file.canonicalPath, backup);
    backupIdentity = (await identifyFile(backup)).identity;
    const finalCheck = await identifyFile(file.filePath);
    if (finalCheck.identity !== original.identity || finalCheck.size !== original.size) throw new Error("替换前原音频发生变化");
    if ((await identifyFile(temporary)).identity !== temporaryIdentity) throw new Error("修复副本身份发生变化");
    if (await hasOtherReference(lease.file, { fileId: file.fileId, taskId: task.taskId })) throw new Error("音频新增其他引用，已取消修复");
    const beforeReplace = await identifyFile(file.filePath);
    if (beforeReplace.identity !== original.identity || beforeReplace.size !== original.size) throw new Error("提交前原音频发生变化");
    await rename(temporary, file.filePath); temporary = ""; replaced = true;
    try {
      const actual = await identifyFile(file.filePath);
      const nextFile = { ...file, size: validated.size, durationMs: validated.durationMs, metadataStatus: "embedded" as const, message: "已补齐缺失元数据，保留已有内容" };
      const nextTask = { ...task, candidateIdentity: actual.identity, candidateSize: actual.size, error: "", status: "completed" as const, updatedAt: new Date().toISOString() };
      // 短事务共同提交文件状态和候选身份。
      repo.updateRepaired(nextTask, nextFile);
      committed = true;
    } catch (error) {
      // 只回滚本次新副本，不能覆盖替换后出现的外部文件。
      if ((await identifyFile(file.filePath)).identity === temporaryIdentity) { await rename(backup, file.filePath); backup = ""; }
      throw error;
    }
    return await getDownloadFileDetail({ fileId: file.fileId });
  } catch (error) {
    const latest = repo.file(file.fileId);
    if (latest) repo.saveFile({ ...latest, metadataStatus: "failed", message: `${error instanceof Error ? error.message : String(error)}${replaced && backup ? `；原音频备份保留：${backup}` : ""}` });
    throw error;
  } finally {
    for (const [candidate, identity] of [[temporary, temporaryIdentity], [backup, backupIdentity]]) {
      if (!candidate || !identity) continue;
      if (candidate === backup && replaced && !committed) continue;
      try { if ((await identifyFile(candidate)).identity === identity) await unlink(candidate); }
      catch { /* 保留可追溯临时文件，不把清理失败误报为修复失败。 */ }
    }
    lease?.release(); finish();
  }
}

export async function repairDownloadFiles(targets: DownloadFileTarget[]): Promise<DownloadBatchRepairResult> {
  await initializeDownloadService();
  if (!Array.isArray(targets) || !targets.length) {
    return { total: 0, repaired: 0, failed: 0, items: [] };
  }
  const seen = new Set<string>();
  const uniqueTargets: DownloadFileTarget[] = [];
  for (const target of targets) {
    const key = target?.fileId ? `file:${target.fileId}` : target?.taskId ? `task:${target.taskId}` : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueTargets.push(target);
  }
  const items: DownloadBatchRepairResult["items"] = [];
  let repaired = 0;
  let failed = 0;
  for (const target of uniqueTargets) {
    try {
      const detail = await repairDownloadFile(target);
      const status = detail.file?.metadataStatus === "failed" ? "failed" : "repaired";
      if (status === "repaired") repaired += 1;
      else failed += 1;
      items.push({
        ...(detail.file?.fileId ? { fileId: detail.file.fileId } : target.fileId ? { fileId: target.fileId } : {}),
        ...(detail.task.taskId ? { taskId: detail.task.taskId } : target.taskId ? { taskId: target.taskId } : {}),
        status,
        message: detail.file?.message || (status === "repaired" ? "信息补缺已完成" : "修复未完成"),
      });
    } catch (error) {
      failed += 1;
      items.push({
        ...(target.fileId ? { fileId: target.fileId } : {}),
        ...(target.taskId ? { taskId: target.taskId } : {}),
        status: "failed",
        message: error instanceof Error ? error.message : String(error || "修复失败"),
      });
    }
  }
  return { total: uniqueTargets.length, repaired, failed, items };
}
