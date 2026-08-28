import { Router, type Request } from "express";
import {
  getUserAuth,
  requireUserJwt,
  tokenFromRequest,
  verifyUserToken,
  type UserAuthedRequest,
} from "../middleware/requireUserJwt";
import {
  confirmUserAsset,
  createUserUploadSession,
  getPublicCoverRedirect,
  getPublicLyricsUrl,
  getPublicPlayUrl,
  getPublicSummary,
  getPublicTrackDetail,
  removeUserManualCover,
  reserveUserAsset,
  saveUserSubmission,
  searchPublicTracks,
  type CloudMusicAssetKind,
  type CloudMusicAssetReserveRequest,
  type CloudMusicUploadSessionRequest,
  type CloudMusicUserSubmitInput,
} from "../services/cloudMusicService";
import { fail, ok } from "../types/response";

export const cloudMusicRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getUserFromReq(req: Request) {
  const auth = getUserAuth(req as UserAuthedRequest);
  return auth.user;
}

cloudMusicRouter.get("/summary", (req, res) => {
  try {
    const user = verifyUserToken(tokenFromRequest(req));
    res.json(ok(getPublicSummary(user?.id)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取网盘音乐概览失败";
    res.status(500).json(fail(message, 500));
  }
});

cloudMusicRouter.get("/search", (req, res) => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : undefined;
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "30"), 10) || 30));

    const result = searchPublicTracks({
      keyword,
      offset,
      limit,
    });
    res.json(ok(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "搜索网盘音乐失败";
    res.status(500).json(fail(message, 500));
  }
});

cloudMusicRouter.get("/tracks/:uuid", (req, res) => {
  try {
    const { uuid } = req.params;
    const track = getPublicTrackDetail(uuid);
    if (!track) {
      res.status(404).json(fail("曲目不存在", 404));
      return;
    }
    res.json(ok(track));
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取曲目详情失败";
    res.status(500).json(fail(message, 500));
  }
});

cloudMusicRouter.get("/tracks/:uuid/play-url", (req, res) => {
  try {
    const { uuid } = req.params;
    const playInfo = getPublicPlayUrl(uuid);
    res.json(ok(playInfo));
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
    const message = error instanceof Error ? error.message : "获取播放地址失败";
    res.status(statusCode).json(fail(message, statusCode));
  }
});

cloudMusicRouter.get("/tracks/:uuid/cover", (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const uuid = req.params.uuid.trim();
    if (!uuid) {
      res.status(400).json(fail("曲目 UUID 不能为空", 400));
      return;
    }
    const redirectUrl = getPublicCoverRedirect(uuid);
    res.redirect(302, redirectUrl);
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
    const message = error instanceof Error ? error.message : "获取曲目封面失败";
    res.status(statusCode).json(fail(message, statusCode));
  }
});

cloudMusicRouter.get("/tracks/:uuid/lyrics-url", (req, res) => {
  try {
    const { uuid } = req.params;
    const lyricsInfo = getPublicLyricsUrl(uuid);
    res.json(ok(lyricsInfo));
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
    const message = error instanceof Error ? error.message : "获取歌词地址失败";
    res.status(statusCode).json(fail(message, statusCode));
  }
});

// ==================== 用户投稿相关接口（要求账号登录） ====================

cloudMusicRouter.post("/submit/upload-sessions", requireUserJwt, (req, res) => {
  try {
    const user = getUserFromReq(req);
    const body = req.body as CloudMusicUploadSessionRequest;
    if (!body || !isRecord(body) || !isRecord(body.audio)) {
      res.status(400).json(fail("缺少音频文件信息", 400));
      return;
    }
    const session = createUserUploadSession(body, user);
    res.json(ok(session));
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 400;
    const message = error instanceof Error ? error.message : "创建投稿会话失败";
    res.status(statusCode).json(fail(message, statusCode));
  }
});

cloudMusicRouter.post("/submit/:uuid/assets/:kind/reserve", requireUserJwt, (req, res) => {
  try {
    const user = getUserFromReq(req);
    const uuid = String(req.params.uuid ?? "").trim();
    const kind = String(req.params.kind ?? "").trim();
    if (kind !== "cover-uploaded" && kind !== "lyrics") {
      res.status(400).json(fail("仅支持预登记封面或歌词", 400));
      return;
    }
    const body = req.body as CloudMusicAssetReserveRequest;
    const fileName = String(body?.fileName ?? "").trim();
    const fileSize = Number(body?.fileSize);
    const mimeType = String(body?.mimeType ?? "").trim();
    if (!fileName || !fileSize || !mimeType) {
      res.status(400).json(fail("文件声明信息不完整", 400));
      return;
    }
    const ticket = reserveUserAsset(uuid, { fileName, fileSize, mimeType, kind }, user);
    res.json(ok(ticket));
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 400;
    const message = error instanceof Error ? error.message : "预登记资产失败";
    res.status(statusCode).json(fail(message, statusCode));
  }
});

cloudMusicRouter.post("/submit/:uuid/assets/:kind/complete", requireUserJwt, async (req, res) => {
  try {
    const user = getUserFromReq(req);
    const uuid = String(req.params.uuid ?? "").trim();
    const kind = String(req.params.kind ?? "").trim();
    if (!["audio", "cover-uploaded", "lyrics"].includes(kind)) {
      res.status(400).json(fail("不支持的资产类型", 400));
      return;
    }
    const track = await confirmUserAsset(uuid, kind as CloudMusicAssetKind, user);
    res.json(ok(track));
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 400;
    const message = error instanceof Error ? error.message : "确认资产失败";
    res.status(statusCode).json(fail(message, statusCode));
  }
});

cloudMusicRouter.delete("/submit/:uuid/cover", requireUserJwt, async (req, res) => {
  try {
    const user = getUserFromReq(req);
    const uuid = String(req.params.uuid ?? "").trim();
    const track = await removeUserManualCover(uuid, user);
    res.json(ok(track));
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 400;
    const message = error instanceof Error ? error.message : "删除手动封面失败";
    res.status(statusCode).json(fail(message, statusCode));
  }
});

cloudMusicRouter.post("/submit/:uuid/save", requireUserJwt, (req, res) => {
  try {
    const user = getUserFromReq(req);
    const uuid = String(req.params.uuid ?? "").trim();
    const body = req.body as CloudMusicUserSubmitInput;
    if (!body || !isRecord(body)) {
      res.status(400).json(fail("请求体格式不正确", 400));
      return;
    }
    const track = saveUserSubmission(uuid, body, user);
    res.json(ok(track));
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 400;
    const message = error instanceof Error ? error.message : "提交投稿失败";
    res.status(statusCode).json(fail(message, statusCode));
  }
});
