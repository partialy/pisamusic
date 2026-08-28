import { ipcMain } from "electron";
import {
  completeCloudMusicSubmitAsset,
  createCloudMusicSubmitSession,
  getCloudMusicLyricsUrl,
  getCloudMusicPlayUrl,
  getCloudMusicSummary,
  getCloudMusicTrackDetail,
  getMyCloudMusicSubmissions,
  removeCloudMusicSubmitCover,
  reserveCloudMusicSubmitAsset,
  resubmitCloudMusicTrack,
  saveCloudMusicSubmission,
  searchCloudMusic,
} from "../cloudMusic/cloudMusicClient";
import { getAccountSession } from "../system/systemClient";
import type {
  CloudMusicAssetReserveRequest,
  CloudMusicUploadSessionRequest,
  CloudMusicUserSubmitInput,
} from "../../src/types/cloudMusic";

let registered = false;

function resolveUserToken(explicitToken?: string): string {
  if (explicitToken && explicitToken.trim()) return explicitToken.trim();
  const session = getAccountSession();
  if (session?.token) return session.token;
  throw new Error("请先登录 PisaMusic 账号");
}

export function setupCloudMusicIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("cloud-music:summary", async () => {
    return getCloudMusicSummary();
  });

  ipcMain.handle(
    "cloud-music:search",
    async (_event, input?: { keyword?: string; offset?: number; limit?: number }) => {
      const keyword = typeof input?.keyword === "string" ? input.keyword.trim() : undefined;
      const offset = Math.max(0, parseInt(String(input?.offset ?? "0"), 10) || 0);
      const limit = typeof input?.limit === "number" ? Math.min(100, Math.max(1, input.limit)) : 20;

      return searchCloudMusic({
        keyword,
        offset,
        limit,
      });
    }
  );

  ipcMain.handle("cloud-music:detail", async (_event, uuid: string) => {
    return getCloudMusicTrackDetail(uuid);
  });

  ipcMain.handle("cloud-music:play-url", async (_event, uuid: string) => {
    return getCloudMusicPlayUrl(uuid);
  });

  ipcMain.handle("cloud-music:lyrics-url", async (_event, uuid: string) => {
    return getCloudMusicLyricsUrl(uuid);
  });

  // ==================== 投稿 IPC ====================

  ipcMain.handle(
    "cloud-music:submit:create-session",
    async (_event, input: CloudMusicUploadSessionRequest, explicitToken?: string) => {
      const token = resolveUserToken(explicitToken);
      return createCloudMusicSubmitSession(input, token);
    }
  );

  ipcMain.handle(
    "cloud-music:submit:reserve-asset",
    async (
      _event,
      payload: { uuid: string; input: CloudMusicAssetReserveRequest; token?: string }
    ) => {
      const token = resolveUserToken(payload.token);
      return reserveCloudMusicSubmitAsset(payload.uuid, payload.input, token);
    }
  );

  ipcMain.handle(
    "cloud-music:submit:complete-asset",
    async (
      _event,
      payload: { uuid: string; kind: "audio" | "cover-uploaded" | "lyrics"; token?: string }
    ) => {
      const token = resolveUserToken(payload.token);
      return completeCloudMusicSubmitAsset(payload.uuid, payload.kind, token);
    }
  );

  ipcMain.handle(
    "cloud-music:submit:remove-cover",
    async (_event, payload: { uuid: string; token?: string }) => {
      const token = resolveUserToken(payload.token);
      return removeCloudMusicSubmitCover(payload.uuid, token);
    }
  );

  ipcMain.handle(
    "cloud-music:submit:save",
    async (
      _event,
      payload: { uuid: string; input: CloudMusicUserSubmitInput; token?: string }
    ) => {
      const token = resolveUserToken(payload.token);
      return saveCloudMusicSubmission(payload.uuid, payload.input, token);
    }
  );

  ipcMain.handle(
    "cloud-music:submit:my-history",
    async (
      _event,
      payload?: { offset?: number; limit?: number; token?: string }
    ) => {
      const token = resolveUserToken(payload?.token);
      return getMyCloudMusicSubmissions(payload?.offset, payload?.limit, token);
    }
  );

  ipcMain.handle(
    "cloud-music:submit:resubmit",
    async (
      _event,
      payload: { uuid: string; input: CloudMusicUserSubmitInput; token?: string }
    ) => {
      const token = resolveUserToken(payload.token);
      return resubmitCloudMusicTrack(payload.uuid, payload.input, token);
    }
  );
}
