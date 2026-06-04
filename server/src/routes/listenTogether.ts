import { Router } from "express";
import type { Response } from "express";
import {
  createListenTogetherRoom,
  getListenTogetherRoom,
  readListenTogetherConfig,
} from "../services/listenTogetherService";
import { getUserAuth, requireUserJwt, type UserAuthedRequest } from "../middleware/requireUserJwt";
import { ListenTogetherError } from "../realtime/listenTogether/listenTogetherTypes";
import { fail, ok } from "../types/response";

export const listenTogetherRouter = Router();

function handleError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof ListenTogetherError) {
    res.status(error.statusCode).json({
      ...fail(error.message, error.statusCode),
      errorMsg: error.errorMsg,
    });
    return;
  }
  const message = error instanceof Error ? error.message : fallback;
  res.status(500).json(fail(message, 500));
}

listenTogetherRouter.get("/config", (_req, res) => {
  try {
    res.json(ok(readListenTogetherConfig()));
  } catch (error) {
    handleError(res, error, "读取一起听配置失败");
  }
});

listenTogetherRouter.post("/rooms", requireUserJwt, (req: UserAuthedRequest, res) => {
  try {
    const user = getUserAuth(req).user;
    res.json(ok({ room: createListenTogetherRoom(user, req.body) }, "创建成功"));
  } catch (error) {
    handleError(res, error, "创建房间失败");
  }
});

listenTogetherRouter.get("/rooms/:roomId", requireUserJwt, (req, res) => {
  try {
    res.json(ok({ room: getListenTogetherRoom(req.params.roomId) }));
  } catch (error) {
    handleError(res, error, "查询房间失败");
  }
});
