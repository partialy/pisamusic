import { Router, type Request } from "express";
import jwt from "jsonwebtoken";
import { getAdminJwtSecret } from "../middleware/requireAdminJwt";
import {
  cleanupTemp,
  confirmAsset,
  createAdminUploadSession,
  deleteCloudMusic,
  getAdminDetail,
  getTempSummary,
  list,
  preview,
  removeManualCover,
  reserveAsset,
  review,
  saveAdminDraft,
  type CloudMusicAdminSaveInput,
  type CloudMusicAssetKind,
  type CloudMusicReviewInput,
  type CloudMusicStatus,
  type CloudMusicUploadSessionRequest,
  type CloudMusicUploadState,
} from "../services/cloudMusicService";
import { fail, ok } from "../types/response";

export const adminCloudMusicRouter = Router();

function getAdminUsername(req: Request): string {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) return "admin";
  const token = raw.slice(7).trim();
  if (!token) return "admin";
  try {
    const payload = jwt.verify(token, getAdminJwtSecret()) as jwt.JwtPayload;
    return typeof payload.sub === "string" && payload.sub.trim() ? payload.sub.trim() : "admin";
  } catch {
    return "admin";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

adminCloudMusicRouter.get("/temp-summary", (_req, res) => {
  try {
    const summary = getTempSummary();
    res.json(ok(summary));
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取临时文件摘要失败";
    res.status(500).json(fail(message, 500));
  }
});

adminCloudMusicRouter.post("/temp-cleanup", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const hours = Number(body?.olderThanHours);
    if (![0, 24, 72].includes(hours)) {
      res.status(400).json(fail("清理阈值仅支持 0、24 或 72 小时", 400));
      return;
    }
    const result = await cleanupTemp({ olderThanHours: hours as 0 | 24 | 72 });
    res.json(ok(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "清理临时文件失败";
    res.status(500).json(fail(message, 500));
  }
});

adminCloudMusicRouter.post("/upload-sessions", (req, res) => {
  try {
    const body = req.body as CloudMusicUploadSessionRequest;
    if (!body || !isRecord(body) || !isRecord(body.audio)) {
      res.status(400).json(fail("缺少音频文件信息", 400));
      return;
    }
    const session = createAdminUploadSession(body);
    res.json(ok(session));
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建上传会话失败";
    res.status(400).json(fail(message, 400));
  }
});

adminCloudMusicRouter.post("/:uuid/assets/:kind/reserve", (req, res) => {
  try {
    const { uuid, kind } = req.params;
    if (kind !== "cover-uploaded" && kind !== "lyrics") {
      res.status(400).json(fail("仅支持预登记封面或歌词", 400));
      return;
    }
    const body = req.body as Record<string, unknown>;
    const fileName = String(body?.fileName ?? "").trim();
    const fileSize = Number(body?.fileSize);
    const mimeType = String(body?.mimeType ?? "").trim();
    if (!fileName || !fileSize || !mimeType) {
      res.status(400).json(fail("文件声明信息不完整", 400));
      return;
    }
    const ticket = reserveAsset(uuid, {
      fileName,
      fileSize,
      mimeType,
      kind,
    });
    res.json(ok(ticket));
  } catch (error) {
    const message = error instanceof Error ? error.message : "预登记资产失败";
    res.status(400).json(fail(message, 400));
  }
});

adminCloudMusicRouter.post("/:uuid/assets/:kind/complete", async (req, res) => {
  try {
    const { uuid, kind } = req.params;
    if (!["audio", "cover-uploaded", "lyrics"].includes(kind)) {
      res.status(400).json(fail("不支持的资产类型", 400));
      return;
    }
    const track = await confirmAsset(uuid, kind as CloudMusicAssetKind);
    res.json(ok(track));
  } catch (error) {
    const message = error instanceof Error ? error.message : "确认资产失败";
    res.status(400).json(fail(message, 400));
  }
});

adminCloudMusicRouter.delete("/:uuid/cover", async (req, res) => {
  try {
    const { uuid } = req.params;
    const track = await removeManualCover(uuid);
    res.json(ok(track));
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除手动封面失败";
    res.status(400).json(fail(message, 400));
  }
});

adminCloudMusicRouter.get("/", (req, res) => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : undefined;
    const status = typeof req.query.status === "string" && req.query.status !== "all"
      ? (req.query.status as CloudMusicStatus)
      : undefined;
    const uploadState = typeof req.query.uploadState === "string" && req.query.uploadState !== "all"
      ? (req.query.uploadState as CloudMusicUploadState)
      : undefined;
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "30"), 10) || 30));

    const result = list({
      keyword,
      status,
      uploadState,
      offset,
      limit,
    });
    res.json(ok(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取网盘音乐列表失败";
    res.status(500).json(fail(message, 500));
  }
});

adminCloudMusicRouter.get("/:uuid/preview-url", (req, res) => {
  try {
    const { uuid } = req.params;
    const urls = preview(uuid);
    res.json(ok(urls));
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取试听地址失败";
    res.status(400).json(fail(message, 400));
  }
});

adminCloudMusicRouter.get("/:uuid", (req, res) => {
  try {
    const { uuid } = req.params;
    const detail = getAdminDetail(uuid);
    if (!detail) {
      res.status(404).json(fail("网盘音乐曲目不存在", 404));
      return;
    }
    res.json(ok(detail));
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取网盘音乐详情失败";
    res.status(500).json(fail(message, 500));
  }
});

adminCloudMusicRouter.put("/:uuid", (req, res) => {
  try {
    const { uuid } = req.params;
    const body = req.body as CloudMusicAdminSaveInput;
    if (!body || !isRecord(body)) {
      res.status(400).json(fail("请求体格式不正确", 400));
      return;
    }
    const adminUsername = getAdminUsername(req);
    const track = saveAdminDraft(uuid, body, adminUsername);
    res.json(ok(track));
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存网盘音乐失败";
    res.status(400).json(fail(message, 400));
  }
});

adminCloudMusicRouter.post("/:uuid/review", (req, res) => {
  try {
    const { uuid } = req.params;
    const body = req.body as CloudMusicReviewInput;
    if (!body || !isRecord(body) || !body.decision) {
      res.status(400).json(fail("审核决策不能为空", 400));
      return;
    }
    const adminUsername = getAdminUsername(req);
    const track = review(uuid, body, adminUsername);
    res.json(ok(track));
  } catch (error) {
    const message = error instanceof Error ? error.message : "审核操作失败";
    res.status(400).json(fail(message, 400));
  }
});

adminCloudMusicRouter.delete("/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const track = await deleteCloudMusic(uuid);
    res.json(ok(track));
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除网盘音乐失败";
    res.status(400).json(fail(message, 400));
  }
});
