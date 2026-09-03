import { Router } from "express";
import {
  announcementExists,
  readAnnouncementReads,
} from "../db/announcementReadStore";
import { fail, ok } from "../types/response";

export const adminAnnouncementsRouter = Router();

adminAnnouncementsRouter.get("/:id/reads", (req, res) => {
  const announcementId = String(req.params.id ?? "").trim();
  if (!announcementId) return res.status(400).json(fail("公告 ID 不能为空", 400));
  try {
    if (!announcementExists(announcementId)) {
      return res.status(404).json(fail("公告不存在", 404));
    }
    const offset = Number(req.query.offset ?? 0);
    const limit = Number(req.query.limit ?? 20);
    return res.json(ok(readAnnouncementReads(announcementId, offset, limit)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取公告已读列表失败";
    return res.status(500).json(fail(message, 500));
  }
});
