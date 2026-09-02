import { Router, type Request, type Response } from "express";
import {
  dissolveAdminOnlineRoom,
  listAdminOnlineRooms,
  listAdminRoomHistory,
  readAdminOnlineRoom,
  readAdminRoomHistory,
} from "../services/adminListenTogetherService";
import { ListenTogetherError, type ListenTogetherRoomEndReason } from "../realtime/listenTogether/listenTogetherTypes";
import { fail, ok } from "../types/response";

export const adminListenTogetherRouter = Router();

adminListenTogetherRouter.get("/online", (req: Request, res: Response) => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword : undefined;
    const offset = Number(req.query.offset ?? 0);
    const limit = Number(req.query.limit ?? 20);
    const result = listAdminOnlineRooms({ keyword, offset, limit });
    res.json(ok(result));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取在线房间列表失败";
    res.status(500).json(fail(msg, 500));
  }
});

adminListenTogetherRouter.get("/online/:recordId", (req: Request, res: Response) => {
  try {
    const recordId = String(req.params.recordId ?? "");
    const detail = readAdminOnlineRoom(recordId);
    if (!detail) {
      res.status(404).json(fail("在线房间不存在或已结束", 404));
      return;
    }
    res.json(ok(detail));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取在线房间详情失败";
    res.status(500).json(fail(msg, 500));
  }
});

adminListenTogetherRouter.post("/online/:recordId/dissolve", (req: Request, res: Response) => {
  try {
    const recordId = String(req.params.recordId ?? "");
    const adminUsername = (req as Request & { adminUsername?: string }).adminUsername || "admin";
    const result = dissolveAdminOnlineRoom({ recordId, adminUsername });
    res.json(ok(result));
  } catch (error) {
    if (error instanceof ListenTogetherError) {
      res.status(error.statusCode).json(fail(error.message, error.statusCode));
      return;
    }
    const msg = error instanceof Error ? error.message : "解散房间失败";
    res.status(500).json(fail(msg, 500));
  }
});

adminListenTogetherRouter.get("/history", (req: Request, res: Response) => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword : undefined;
    const endReason = typeof req.query.endReason === "string" && req.query.endReason.trim()
      ? (req.query.endReason.trim() as ListenTogetherRoomEndReason)
      : undefined;
    const startFrom = req.query.startFrom !== undefined && req.query.startFrom !== ""
      ? Number(req.query.startFrom)
      : undefined;
    const startTo = req.query.startTo !== undefined && req.query.startTo !== ""
      ? Number(req.query.startTo)
      : undefined;
    const offset = Number(req.query.offset ?? 0);
    const limit = Number(req.query.limit ?? 20);

    const result = listAdminRoomHistory({
      keyword,
      endReason,
      startFrom,
      startTo,
      offset,
      limit,
    });
    res.json(ok(result));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取房间历史列表失败";
    res.status(500).json(fail(msg, 500));
  }
});

adminListenTogetherRouter.get("/history/:recordId", (req: Request, res: Response) => {
  try {
    const recordId = String(req.params.recordId ?? "");
    const detail = readAdminRoomHistory(recordId);
    if (!detail) {
      res.status(404).json(fail("房间历史不存在", 404));
      return;
    }
    res.json(ok(detail));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取房间历史详情失败";
    res.status(500).json(fail(msg, 500));
  }
});
