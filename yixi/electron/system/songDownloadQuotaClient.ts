import { randomUUID } from "node:crypto";
import { identityRevision } from "../account/accountIdentity";
import type { SongDownloadQuotaAcquireResult } from "../../src/types/download";
import {
  getAccountSession,
  getDesktopDeviceClientId,
  getDesktopDeviceMessageToken,
  refreshAccountSession,
  refreshDesktopDeviceMessageToken,
  requestSystem,
} from "./systemClient";

export type SongDownloadAcquireItem = {
  source: string;
  songId: string;
  name: string;
  singer: string;
  album: string;
  cover: string;
  durationMs?: number;
  qualityKey: string;
};

/**
 * 发起单批次歌曲下载配额校验与扣减。
 * 强制联网成功才允许下载；遇到 401 时刷新一次设备/账号凭证并重试一次，身份变化则中止。
 */
export async function acquireSongDownloadQuota(
  items: SongDownloadAcquireItem[],
): Promise<SongDownloadQuotaAcquireResult> {
  if (!items.length) {
    throw new Error("待校验歌曲列表不能为空");
  }

  let revision = identityRevision();
  const deviceId = getDesktopDeviceClientId();
  let session = getAccountSession();
  const accountId = session.loggedIn ? session.user.id : "";
  const isCurrent = () => revision === identityRevision() && deviceId === getDesktopDeviceClientId();
  const clientBatchId = randomUUID();

  let deviceToken = getDesktopDeviceMessageToken()?.trim();
  if (!deviceToken) {
    deviceToken = await refreshDesktopDeviceMessageToken();
  }
  if (!isCurrent()) {
    throw new Error("账号或设备身份已变化，请重新确认下载");
  }

  const send = () =>
    requestSystem<SongDownloadQuotaAcquireResult>("/api/song-downloads/acquire", {
      method: "POST",
      token: session.loggedIn ? session.token : null,
      headers: { "x-pm-device-token": deviceToken! },
      body: {
        clientBatchId,
        platform: "desktop",
        items,
      },
      recordFailure: false,
    });

  let response = await send();
  if (!isCurrent()) {
    throw new Error("账号或设备身份已变化，请重新确认下载");
  }

  if (response.code === 401) {
    deviceToken = await refreshDesktopDeviceMessageToken();
    if (!isCurrent()) {
      throw new Error("账号或设备身份已变化，请重新确认下载");
    }
    if (session.loggedIn) {
      const previousRevision = revision;
      session = await refreshAccountSession();
      if (
        !session.loggedIn ||
        session.user.id !== accountId ||
        identityRevision() !== previousRevision + 1 ||
        deviceId !== getDesktopDeviceClientId()
      ) {
        throw new Error("账号身份已变化，请重新确认下载");
      }
      revision = identityRevision();
    }
    response = await send();
  }

  if (!isCurrent()) {
    throw new Error("账号或设备身份已变化，请重新确认下载");
  }
  if (!response.success || response.code !== 0 || !response.data) {
    if (response.code === 401) {
      throw new Error("设备或账号身份校验失败，请重新登录或重连服务后重试");
    }
    throw new Error(response.msg || "校验下载配额失败，请稍后重试");
  }
  return response.data;
}
