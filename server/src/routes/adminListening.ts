import { Router } from "express";
import { ListeningLevelVersionConflictError } from "../db/listeningStore";
import { getListeningLevelConfig, ListeningValidationError, saveListeningLevelConfig } from "../services/listeningService";
import { fail, ok } from "../types/response";

export const adminListeningRouter = Router();

adminListeningRouter.get("/levels", (_req, res) => {
  try {
    return res.json(ok(getListeningLevelConfig()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取听歌等级配置失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminListeningRouter.put("/levels", (req, res) => {
  try {
    return res.json(ok(saveListeningLevelConfig(req.body), "听歌等级配置已保存"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存听歌等级配置失败";
    const status = error instanceof ListeningLevelVersionConflictError ? 409 : error instanceof ListeningValidationError ? 400 : 500;
    return res.status(status).json(fail(message, status));
  }
});
