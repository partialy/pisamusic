import { randomUUID } from "node:crypto";
import path from "node:path";
import { getAppDb } from "../../db/appDb";
import {
  confirmCloudMusicAsset,
  listCloudMusicTracks,
  listStaleTempTracks,
  markCloudMusicDeleted,
  readCloudMusicReservedAsset,
  readCloudMusicTrack,
  reserveCloudMusicAsset,
  transitionCloudMusicStatus,
  updateCloudMusicDraft,
  type CloudMusicAssetKind,
  type CloudMusicListInput,
  type CloudMusicListResult as StoreListResult,
} from "../../db/cloudMusicStore";
import { readFileRecordById } from "../../db/configStore";
import {
  buildCloudMusicAssetObjectKey,
  CLOUD_MUSIC_AUDIO_MAX_SIZE,
  CLOUD_MUSIC_COVER_MAX_SIZE,
  CLOUD_MUSIC_LYRICS_MAX_SIZE,
  createCloudMusicAssetUploadToken,
  createCloudMusicAssetUrl,
  deleteCloudMusicAsset,
  inferAssetMimeType,
  requireCloudMusicAssetExtension,
  statCloudMusicAsset,
} from "../cloudMusicAssets";
import {
  createUploadSessionInternal,
  getRequiredBucket,
  toCloudMusicTrackDto,
} from "./cloudMusicShared";
import type {
  CloudMusicAdminParsedAudioInput,
  CloudMusicAdminSaveInput,
  CloudMusicAssetReserveRequest,
  CloudMusicAssetUploadTicket,
  CloudMusicListResult,
  CloudMusicResourceUrls,
  CloudMusicReviewInput,
  CloudMusicTempCleanupInput,
  CloudMusicTempCleanupResult,
  CloudMusicTempSummary,
  CloudMusicTrackDto,
  CloudMusicUploadSession,
  CloudMusicUploadSessionRequest,
} from "./types";

export async function createAdminUploadSession(input: CloudMusicUploadSessionRequest): Promise<CloudMusicUploadSession> {
  return await createUploadSessionInternal(input, { type: "system", userId: null, snapshot: { displayName: "system" } });
}

export async function reserveAsset(uuid: string, input: CloudMusicAssetReserveRequest): Promise<CloudMusicAssetUploadTicket> {
  if (input.kind !== "cover-uploaded" && input.kind !== "lyrics") {
    throw new Error("仅支持预登记封面或歌词资产");
  }
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  requireCloudMusicAssetExtension(input.kind, input.fileName);

  const bucket = getRequiredBucket();
  const assetId = randomUUID();
  const fileRecordId = randomUUID();
  const objectKey = buildCloudMusicAssetObjectKey(uuid, input.kind, input.fileName);
  const mimeType = inferAssetMimeType(input.kind, input.fileName, input.mimeType);

  const reserved = await reserveCloudMusicAsset({
    trackUuid: uuid,
    assetId,
    fileRecordId,
    kind: input.kind,
    bucket,
    objectKey,
    fileName: input.fileName,
    mimeType,
    fileSize: input.fileSize,
  });

  const ticket = await createCloudMusicAssetUploadToken({ uuid, asset: reserved });
  return {
    assetId,
    fileRecordId,
    kind: input.kind,
    key: objectKey,
    uploadToken: ticket.uploadToken,
    uploadUrl: ticket.uploadUrl,
  };
}

/**
 * 管理后台确认资产：音频/封面/歌词元数据已在浏览器本地解析，服务端仅通过七牛 stat 校验对象存在及物理大小/Hash，不再下载文件至临时目录。
 */
export async function confirmAdminAsset(
  uuid: string,
  kind: CloudMusicAssetKind,
  parsedInput?: CloudMusicAdminParsedAudioInput,
): Promise<CloudMusicTrackDto> {
  const track = await readCloudMusicTrack(uuid, true);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  const pendingAsset = track.assets.find((item) => item.kind === kind && item.state === "pending" && item.deletedAt === null);

  if (!pendingAsset) {
    const currentAsset = track.assets.find((item) => item.kind === kind && item.state === "uploaded" && item.isCurrent && item.deletedAt === null);
    if (currentAsset) {
      return await toCloudMusicTrackDto(track);
    }
    throw new Error(`未找到待确认的 ${kind} 资产记录`);
  }

  const reserved = await readCloudMusicReservedAsset(pendingAsset.fileRecordId);
  if (!reserved) throw new Error(`待确认的 ${kind} 预登记资产不存在`);

  const stat = await statCloudMusicAsset(reserved);
  if (!Number.isSafeInteger(stat.fileSize) || stat.fileSize <= 0) {
    throw new Error("七牛存储对象文件大小异常");
  }

  if (kind === "audio") {
    if (stat.fileSize > CLOUD_MUSIC_AUDIO_MAX_SIZE) {
      throw new Error("音频文件超过大小限制 (500MB)");
    }
    const ext = path.extname(reserved.fileName);
    const defaultTitle = path.basename(reserved.fileName, ext);
    const defaultFormat = ext.slice(1).toLowerCase();

    const title = typeof parsedInput?.title === "string" && parsedInput.title.trim()
      ? parsedInput.title.trim().slice(0, 200)
      : defaultTitle.slice(0, 200) || "未命名";
    const artist = typeof parsedInput?.artist === "string" && parsedInput.artist.trim()
      ? parsedInput.artist.trim().slice(0, 300)
      : "未知歌手";
    const album = typeof parsedInput?.album === "string"
      ? parsedInput.album.trim().slice(0, 200)
      : "";
    const durationMs = Number.isFinite(Number(parsedInput?.durationMs)) && Number(parsedInput?.durationMs) > 0
      ? Math.min(86400000, Math.round(Number(parsedInput?.durationMs)))
      : 0;
    const format = typeof parsedInput?.format === "string" && parsedInput.format.trim()
      ? parsedInput.format.trim().toLowerCase()
      : defaultFormat;
    const codec = typeof parsedInput?.codec === "string"
      ? parsedInput.codec.trim().toLowerCase()
      : "";
    const bitrate = Number.isFinite(Number(parsedInput?.bitrate)) && Number(parsedInput?.bitrate) > 0
      ? Math.round(Number(parsedInput?.bitrate))
      : 0;
    const sampleRate = Number.isFinite(Number(parsedInput?.sampleRate)) && Number(parsedInput?.sampleRate) > 0
      ? Math.round(Number(parsedInput?.sampleRate))
      : 0;
    const channels = Number.isFinite(Number(parsedInput?.channels)) && Number(parsedInput?.channels) > 0
      ? Math.round(Number(parsedInput?.channels))
      : 0;
    const year = typeof parsedInput?.year === "number" && Number.isInteger(parsedInput.year) && parsedInput.year > 0
      ? parsedInput.year
      : null;
    const trackNo = typeof parsedInput?.trackNo === "number" && Number.isInteger(parsedInput.trackNo) && parsedInput.trackNo > 0
      ? parsedInput.trackNo
      : null;

    const updated = await confirmCloudMusicAsset({
      fileRecordId: reserved.fileRecordId,
      hash: stat.hash,
      mimeType: stat.mimeType || reserved.mimeType,
      fileSize: stat.fileSize,
      uploadState: "ready",
      statusReason: "",
      parsed: {
        title,
        artist,
        album,
        durationMs,
        format,
        codec,
        bitrate,
        sampleRate,
        channels,
        year,
        trackNo,
        metadata: {
          parsedBy: "browser",
        },
      },
    });
    return await toCloudMusicTrackDto(updated);
  }

  if (kind === "cover-uploaded") {
    if (stat.fileSize > CLOUD_MUSIC_COVER_MAX_SIZE) {
      throw new Error("封面文件超过大小限制 (10MB)");
    }
    const updated = await confirmCloudMusicAsset({
      fileRecordId: reserved.fileRecordId,
      hash: stat.hash,
      mimeType: stat.mimeType || reserved.mimeType,
      fileSize: stat.fileSize,
    });
    return await toCloudMusicTrackDto(updated);
  }

  if (kind === "lyrics") {
    if (stat.fileSize > CLOUD_MUSIC_LYRICS_MAX_SIZE) {
      throw new Error("歌词文件超过大小限制 (2MB)");
    }
    const ext = path.extname(reserved.fileName).slice(1).toLowerCase();
    const lyricsFormat = ext === "txt" ? "txt" : "lrc";
    const updated = await confirmCloudMusicAsset({
      fileRecordId: reserved.fileRecordId,
      hash: stat.hash,
      mimeType: stat.mimeType || reserved.mimeType,
      fileSize: stat.fileSize,
      parsed: {
        lyricsFormat,
      },
    });
    return await toCloudMusicTrackDto(updated);
  }

  throw new Error(`不支持的资产类型确认: ${kind}`);
}

export async function saveAdminDraft(uuid: string, input: CloudMusicAdminSaveInput, adminUsername: string): Promise<CloudMusicTrackDto> {
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  const title = input.title.trim();
  if (!title || title.length > 200) throw new Error("歌名长度应在 1-200 字符之间");

  const artist = input.artist.trim();
  if (!artist || artist.length > 300) throw new Error("歌手长度应在 1-300 字符之间");

  const album = input.album.trim();
  if (album.length > 200) throw new Error("专辑名称不能超过 200 字符");

  const durationMs = Math.trunc(input.durationMs);
  if (!Number.isSafeInteger(durationMs) || durationMs < 0 || durationMs > 86400000) {
    throw new Error("时长不正确，应在 0 至 24 小时之间");
  }

  if (!["active", "disabled", "offline"].includes(input.status)) {
    throw new Error("保存状态仅允许 active、disabled 或 offline");
  }

  if (track.uploadState !== "ready") {
    throw new Error("网盘音乐音频未就绪，不可保存为正式状态");
  }

  await updateCloudMusicDraft(uuid, {
    title,
    artist,
    album,
    durationMs,
    ...(typeof input.format === "string" && input.format.trim() ? { format: input.format.trim().toLowerCase() } : {}),
    ...(typeof input.codec === "string" ? { codec: input.codec.trim().toLowerCase() } : {}),
    ...(Number.isFinite(Number(input.bitrate)) && Number(input.bitrate) > 0 ? { bitrate: Math.round(Number(input.bitrate)) } : {}),
    ...(Number.isFinite(Number(input.sampleRate)) && Number(input.sampleRate) > 0 ? { sampleRate: Math.round(Number(input.sampleRate)) } : {}),
    ...(Number.isFinite(Number(input.channels)) && Number(input.channels) > 0 ? { channels: Math.round(Number(input.channels)) } : {}),
    ...(input.year !== undefined ? { year: typeof input.year === "number" && Number.isInteger(input.year) && input.year > 0 ? input.year : null } : {}),
    ...(input.trackNo !== undefined ? { trackNo: typeof input.trackNo === "number" && Number.isInteger(input.trackNo) && input.trackNo > 0 ? input.trackNo : null } : {}),
  });

  const updated = await transitionCloudMusicStatus({
    uuid,
    status: input.status,
    statusReason: input.statusReason?.trim() ?? "",
    reviewedBy: adminUsername,
  });

  if (!updated) throw new Error("保存网盘音乐状态失败");
  return await toCloudMusicTrackDto(updated);
}

export async function review(uuid: string, input: CloudMusicReviewInput, adminUsername: string): Promise<CloudMusicTrackDto> {
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在或已被销毁");

  if (input.decision === "approve") {
    if (!["active", "disabled"].includes(input.targetStatus)) {
      throw new Error("审核通过的目标状态仅允许 active 或 disabled");
    }
    if (track.uploadState !== "ready") {
      throw new Error("网盘音乐音频未就绪，不能审核通过");
    }
    const updated = await transitionCloudMusicStatus({
      uuid,
      status: input.targetStatus,
      statusReason: input.reason?.trim() || "管理员审核通过",
      reviewedBy: adminUsername,
    });
    if (!updated) throw new Error("审核操作失败");
    return await toCloudMusicTrackDto(updated);
  }

  if (input.decision === "reject") {
    const reason = input.reason.trim();
    if (!reason || reason.length > 500) {
      throw new Error("审核驳回原因长度应在 1-500 字符之间");
    }
    const updated = await transitionCloudMusicStatus({
      uuid,
      status: "rejected",
      statusReason: reason,
      reviewedBy: adminUsername,
    });
    if (!updated) throw new Error("审核操作失败");
    return await toCloudMusicTrackDto(updated);
  }

  if (input.decision === "resubmit") {
    const updated = await transitionCloudMusicStatus({
      uuid,
      status: "pending_review",
      statusReason: input.reason?.trim() || `管理员 ${adminUsername} 设为待审核`,
      reviewedBy: adminUsername,
    });
    if (!updated) throw new Error("重新送审失败");
    return await toCloudMusicTrackDto(updated);
  }

  if (input.decision === "ban_destroy") {
    const reason = input.reason.trim();
    if (!reason || reason.length > 500) {
      throw new Error("违规销毁原因长度应在 1-500 字符之间");
    }
    await transitionCloudMusicStatus({
      uuid,
      status: "rejected",
      statusReason: `【违规销毁】${reason}`,
      reviewedBy: adminUsername,
    });
    return await deleteCloudMusic(uuid);
  }

  throw new Error("未知的审核决策");
}

export async function list(input: CloudMusicListInput): Promise<CloudMusicListResult> {
  const result: StoreListResult = await listCloudMusicTracks(input);
  return {
    items: await Promise.all(result.items.map(toCloudMusicTrackDto)),
    total: result.total,
    offset: result.offset,
    limit: result.limit,
  };
}

export async function getAdminDetail(uuid: string): Promise<CloudMusicTrackDto | null> {
  const track = await readCloudMusicTrack(uuid, false);
  return track ? await toCloudMusicTrackDto(track) : null;
}

export async function removeManualCover(uuid: string): Promise<CloudMusicTrackDto> {
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  const uploadedCover = track.assets.find((item) => item.kind === "cover-uploaded" && item.state === "uploaded" && item.isCurrent && item.deletedAt === null);
  if (!uploadedCover) return await toCloudMusicTrackDto(track);

  const file = await readFileRecordById(uploadedCover.fileRecordId);
  if (file && file.status !== "deleted") {
    await deleteCloudMusicAsset({ bucket: file.bucket, objectKey: file.objectKey }).catch(() => undefined);
  }

  const db = getAppDb();
  const now = Date.now();
  await db.transaction(async () => {
    await db.execute(`UPDATE cloud_music_assets SET state = 'deleted', is_current = 0, deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, uploadedCover.id]);
    await db.execute(`UPDATE file_records SET status = 'deleted', referenced_by = '[]', deleted_at = ? WHERE id = ?`, [now, uploadedCover.fileRecordId]);
    await db.execute(`
      UPDATE cloud_music_assets
      SET is_current = 1, updated_at = ?
      WHERE track_uuid = ? AND kind = 'cover-extracted' AND state = 'uploaded' AND deleted_at IS NULL
    `, [now, uuid]);
  });

  const updated = await readCloudMusicTrack(uuid);
  if (!updated) throw new Error("刷新曲目状态失败");
  return await toCloudMusicTrackDto(updated);
}

export async function deleteCloudMusic(uuid: string): Promise<CloudMusicTrackDto> {
  const track = await readCloudMusicTrack(uuid, true);
  if (!track) throw new Error("网盘音乐曲目不存在");

  for (const asset of track.assets) {
    if (asset.deletedAt === null) {
      const file = await readFileRecordById(asset.fileRecordId);
      if (file && file.status !== "deleted") {
        await deleteCloudMusicAsset({ bucket: file.bucket, objectKey: file.objectKey }).catch(() => undefined);
      }
    }
  }

  const deleted = await markCloudMusicDeleted(uuid, Date.now());
  if (!deleted) throw new Error("删除网盘音乐记录失败");
  return await toCloudMusicTrackDto(deleted);
}

export async function preview(uuid: string): Promise<CloudMusicResourceUrls> {
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  const audioAsset = track.assets.find((item) => item.kind === "audio" && item.state === "uploaded" && item.deletedAt === null);
  if (!audioAsset) throw new Error("音频文件尚未上传，无法试听");

  const audioFile = await readFileRecordById(audioAsset.fileRecordId);
  if (!audioFile || audioFile.status !== "uploaded") throw new Error("音频文件记录状态不正确");

  const audioUrl = createCloudMusicAssetUrl(audioFile, 3600);
  const dto = await toCloudMusicTrackDto(track);

  let lyricsUrl: string | null = null;
  const lyricsAsset = track.assets.find((item) => item.kind === "lyrics" && item.state === "uploaded" && item.deletedAt === null);
  if (lyricsAsset) {
    const lyricsFile = await readFileRecordById(lyricsAsset.fileRecordId);
    if (lyricsFile && lyricsFile.status === "uploaded") {
      lyricsUrl = createCloudMusicAssetUrl(lyricsFile, 3600);
    }
  }

  const now = Date.now();
  return {
    audioUrl,
    audioExpiresAt: now + 3600 * 1000,
    coverUrl: dto.cover.url,
    lyricsUrl,
    lyricsExpiresAt: lyricsUrl ? now + 3600 * 1000 : null,
  };
}

export async function cleanupTemp(input: CloudMusicTempCleanupInput): Promise<CloudMusicTempCleanupResult> {
  const threshold = input.olderThanHours === 0 ? Date.now() : Date.now() - input.olderThanHours * 3600 * 1000;
  const staleTracks = await listStaleTempTracks(threshold, 500);

  let deletedCount = 0;
  const failed: Array<{ uuid: string; message: string }> = [];

  for (const track of staleTracks) {
    try {
      await deleteCloudMusic(track.uuid);
      deletedCount += 1;
    } catch (err) {
      failed.push({
        uuid: track.uuid,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    scanned: staleTracks.length,
    deleted: deletedCount,
    failed,
  };
}

export async function getTempSummary(): Promise<CloudMusicTempSummary> {
  const db = getAppDb();
  const now = Date.now();
  const h24 = now - 24 * 3600 * 1000;
  const h72 = now - 72 * 3600 * 1000;

  const totalRow = (await db.queryOne(`
    SELECT COUNT(DISTINCT t.uuid) AS count, COALESCE(SUM(f.file_size), 0) AS bytes
    FROM cloud_music_tracks t
    LEFT JOIN cloud_music_assets a ON a.track_uuid = t.uuid AND a.deleted_at IS NULL
    LEFT JOIN file_records f ON f.id = a.file_record_id AND f.status <> 'deleted'
    WHERE t.status = 'temp' AND t.deleted_at IS NULL
  `, [])) as { count: number; bytes: number };

  const h24Row = (await db.queryOne(`
    SELECT COUNT(DISTINCT t.uuid) AS count, COALESCE(SUM(f.file_size), 0) AS bytes
    FROM cloud_music_tracks t
    LEFT JOIN cloud_music_assets a ON a.track_uuid = t.uuid AND a.deleted_at IS NULL
    LEFT JOIN file_records f ON f.id = a.file_record_id AND f.status <> 'deleted'
    WHERE t.status = 'temp' AND t.deleted_at IS NULL AND t.created_at < ?
  `, [h24])) as { count: number; bytes: number };

  const h72Row = (await db.queryOne(`
    SELECT COUNT(DISTINCT t.uuid) AS count, COALESCE(SUM(f.file_size), 0) AS bytes
    FROM cloud_music_tracks t
    LEFT JOIN cloud_music_assets a ON a.track_uuid = t.uuid AND a.deleted_at IS NULL
    LEFT JOIN file_records f ON f.id = a.file_record_id AND f.status <> 'deleted'
    WHERE t.status = 'temp' AND t.deleted_at IS NULL AND t.created_at < ?
  `, [h72])) as { count: number; bytes: number };

  const staleAssetsRow = (await db.queryOne(`
    SELECT COUNT(a.id) AS count, COALESCE(SUM(f.file_size), 0) AS bytes
    FROM cloud_music_assets a
    JOIN file_records f ON f.id = a.file_record_id
    WHERE a.state IN ('pending', 'superseded')
      AND a.deleted_at IS NULL
      AND a.created_at < ?
      AND f.status <> 'deleted'
  `, [h24])) as { count: number; bytes: number };

  return {
    total: { count: Number(totalRow.count) || 0, bytes: Number(totalRow.bytes) || 0 },
    olderThan24h: { count: Number(h24Row.count) || 0, bytes: Number(h24Row.bytes) || 0 },
    olderThan72h: { count: Number(h72Row.count) || 0, bytes: Number(h72Row.bytes) || 0 },
    staleAssets: { count: Number(staleAssetsRow.count) || 0, bytes: Number(staleAssetsRow.bytes) || 0 },
  };
}
