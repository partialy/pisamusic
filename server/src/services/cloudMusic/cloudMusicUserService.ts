import {
  readCloudMusicTrack,
  readUserSubmissions,
  updateCloudMusicDraft,
} from "../../db/cloudMusicStore";
import { readFileRecordById } from "../../db/configStore";
import {
  confirmAsset,
  createUploadSessionInternal,
  toCloudMusicTrackDto,
} from "./cloudMusicShared";
import {
  removeManualCover,
  reserveAsset,
} from "./cloudMusicAdminService";
import { buildPaginatedList } from "../../utils/pagination";
import type {
  CloudMusicAssetKind,
  CloudMusicAssetReserveRequest,
  CloudMusicAssetUploadTicket,
  CloudMusicSubmissionHistoryV2Response,
  CloudMusicTrackDto,
  CloudMusicUploadSession,
  CloudMusicUploadSessionRequest,
  CloudMusicUserSubmitInput,
} from "./types";

export async function createUserUploadSession(
  input: CloudMusicUploadSessionRequest,
  user: { id: string; username: string; email: string },
): Promise<CloudMusicUploadSession> {
  return await createUploadSessionInternal(input, {
    type: "user",
    userId: user.id,
    snapshot: { userId: user.id, username: user.username, email: user.email },
  });
}

export async function checkUserTrackOwnership(uuid: string, userId: string): Promise<void> {
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) {
    throw new Error("网盘音乐曲目不存在");
  }
  const audioAsset = track.assets.find((item) => item.kind === "audio" && item.deletedAt === null);
  if (audioAsset) {
    const file = await readFileRecordById(audioAsset.fileRecordId);
    if (file && file.ownerType === "user" && file.ownerUserId && file.ownerUserId !== userId) {
      throw new Error("无权操作此曲目");
    }
  }
}

export async function reserveUserAsset(
  uuid: string,
  input: CloudMusicAssetReserveRequest,
  user: { id: string; username: string; email: string },
): Promise<CloudMusicAssetUploadTicket> {
  await checkUserTrackOwnership(uuid, user.id);
  const ticket = await reserveAsset(uuid, input);
  return ticket;
}

export async function confirmUserAsset(
  uuid: string,
  kind: CloudMusicAssetKind,
  user: { id: string; username: string; email: string },
): Promise<CloudMusicTrackDto> {
  await checkUserTrackOwnership(uuid, user.id);
  return await confirmAsset(uuid, kind);
}

export async function removeUserManualCover(
  uuid: string,
  user: { id: string; username: string; email: string },
): Promise<CloudMusicTrackDto> {
  await checkUserTrackOwnership(uuid, user.id);
  return await removeManualCover(uuid);
}

export async function saveUserSubmission(
  uuid: string,
  input: CloudMusicUserSubmitInput,
  user: { id: string; username: string; email: string },
): Promise<CloudMusicTrackDto> {
  await checkUserTrackOwnership(uuid, user.id);
  const track = await readCloudMusicTrack(uuid);
  if (!track || track.deletedAt !== null) throw new Error("网盘音乐曲目不存在");

  if (track.status !== "temp" && track.status !== "rejected") {
    throw new Error("当前曲目状态不允许重复提交投稿");
  }

  const title = input.title.trim();
  if (!title || title.length > 200) throw new Error("歌名长度应在 1-200 字符之间");

  const artist = input.artist.trim();
  if (!artist || artist.length > 300) throw new Error("歌手长度应在 1-300 字符之间");

  const album = (input.album ?? "").trim();
  if (album.length > 200) throw new Error("专辑名称不能超过 200 字符");

  const durationMs = Math.trunc(input.durationMs);
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || durationMs > 86400000) {
    throw new Error("时长不正确，应大于 0 且小于 24 小时");
  }

  if (track.uploadState !== "ready") {
    throw new Error("音频文件尚未上传完成或解析失败，无法提交投稿");
  }

  await updateCloudMusicDraft(uuid, {
    title,
    artist,
    album,
    durationMs,
    status: "pending_review",
    statusReason: `用户 ${user.username} 投稿，等待审核`,
  });

  const updated = await readCloudMusicTrack(uuid);
  if (!updated) throw new Error("保存投稿状态失败");
  return await toCloudMusicTrackDto(updated);
}

export async function getUserSubmissionHistory(
  userId: string,
  offset = 0,
  limit = 30,
): Promise<{
  items: CloudMusicTrackDto[];
  total: number;
  offset: number;
  limit: number;
}> {
  const result = await readUserSubmissions(userId, offset, limit);
  return {
    items: await Promise.all(result.list.map(toCloudMusicTrackDto)),
    total: result.total,
    offset: result.offset,
    limit: result.limit,
  };
}

export async function getUserSubmissionHistoryV2(
  userId: string,
  offset = 0,
  limit = 30,
): Promise<CloudMusicSubmissionHistoryV2Response> {
  const result = await readUserSubmissions(userId, offset, limit);
  const list = await Promise.all(result.list.map(toCloudMusicTrackDto));
  return buildPaginatedList(list, result.total, result.offset, result.limit);
}

export async function resubmitUserTrack(
  uuid: string,
  input: CloudMusicUserSubmitInput,
  user: { id: string; username: string; email: string },
): Promise<CloudMusicTrackDto> {
  await checkUserTrackOwnership(uuid, user.id);
  const track = await readCloudMusicTrack(uuid, true);
  if (!track) throw new Error("网盘音乐曲目不存在");

  if (track.status === "deleted" || track.deletedAt !== null) {
    const error = new Error("该投稿已被销毁，无法重新提交");
    (error as unknown as { statusCode: number }).statusCode = 400;
    throw error;
  }

  if (track.status === "active") {
    const error = new Error("该曲目已审核通过并已上架，无需重新提审");
    (error as unknown as { statusCode: number }).statusCode = 400;
    throw error;
  }

  const title = input.title.trim();
  if (!title || title.length > 200) throw new Error("歌名长度应在 1-200 字符之间");

  const artist = input.artist.trim();
  if (!artist || artist.length > 300) throw new Error("歌手长度应在 1-300 字符之间");

  const album = (input.album ?? "").trim();
  if (album.length > 200) throw new Error("专辑名称不能超过 200 字符");

  const durationMs = Math.trunc(input.durationMs);
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || durationMs > 86400000) {
    throw new Error("时长不正确，应大于 0 且小于 24 小时");
  }

  await updateCloudMusicDraft(uuid, {
    title,
    artist,
    album,
    durationMs,
    status: "pending_review",
    statusReason: `用户 ${user.username} 修改后重新提审`,
  });

  const updated = await readCloudMusicTrack(uuid);
  if (!updated) throw new Error("重新提审失败");
  return await toCloudMusicTrackDto(updated);
}
