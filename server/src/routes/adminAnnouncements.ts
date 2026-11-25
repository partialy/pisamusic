import { Router } from "express";
import { AnnouncementWriteConflict, readAnnouncements } from "../db/announcements/announcementStore";
import { normalizeAnnouncementDraft } from "../services/announcementDraft";
import { announcementExists, readAnnouncementReads } from "../db/announcementReadStore";
import {
  completeAnnouncementImageUpload,
  createAnnouncementImageToken,
  deleteManagedAnnouncement,
  readHydratedAnnouncements,
  saveManagedAnnouncement,
} from "../services/announcementService";
import { fail, ok } from "../types/response";

export const adminAnnouncementsRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Announcements CRUD
adminAnnouncementsRouter.get("/", async (_req, res) => {
  try {
    return res.json(ok(await readHydratedAnnouncements()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取公告失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminAnnouncementsRouter.post("/", async (req, res) => {
  try {
    const id = isRecord(req.body) && typeof req.body.id === "string" ? req.body.id.trim() : "";
    const [existing] = id ? await readAnnouncements({ id }) : [];
    if (existing) return res.status(409).json(fail("公告 ID 已存在", 409));
    const result = await normalizeAnnouncementDraft(req.body);
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    return res.json(ok(await saveManagedAnnouncement(result.value, null), "公告已保存"));
  } catch (e) {
    if (e instanceof AnnouncementWriteConflict) return res.status(409).json(fail(e.message, 409));
    const message = e instanceof Error ? e.message : "保存公告失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminAnnouncementsRouter.put("/:id", async (req, res) => {
  try {
    const [existing] = await readAnnouncements({ id: req.params.id });
    const body = isRecord(req.body) ? req.body : {};
    const result = await normalizeAnnouncementDraft({ ...body, id: req.params.id }, existing);
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    return res.json(ok(await saveManagedAnnouncement(result.value, existing?.announcementVersion ?? null), "公告已保存"));
  } catch (e) {
    if (e instanceof AnnouncementWriteConflict) return res.status(409).json(fail(e.message, 409));
    const message = e instanceof Error ? e.message : "保存公告失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminAnnouncementsRouter.delete("/:id", async (req, res) => {
  try {
    const deleted = await deleteManagedAnnouncement(String(req.params.id ?? "").trim());
    if (!deleted) return res.status(404).json(fail("公告不存在", 404));
    return res.json(ok(null, "公告已删除"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除公告失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminAnnouncementsRouter.post("/images/upload-token", (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const announcementId = String(body?.announcementId ?? "").trim();
    const fileName = String(body?.fileName ?? "").trim();
    const fileSize = Number(body?.fileSize);
    const mimeType = String(body?.mimeType ?? "").trim();
    if (!announcementId || !fileName || !Number.isFinite(fileSize)) {
      return res.status(400).json(fail("announcementId、fileName、fileSize 不能为空", 400));
    }
    return res.json(ok(createAnnouncementImageToken({ announcementId, fileName, fileSize, mimeType }), "上传凭证已生成"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成公告图片上传凭证失败";
    return res.status(400).json(fail(message, 400));
  }
});

adminAnnouncementsRouter.post("/images/complete", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const announcementId = String(body?.announcementId ?? "").trim();
    const bucket = String(body?.bucket ?? "").trim();
    const key = String(body?.key ?? "").trim();
    const hash = String(body?.hash ?? "").trim();
    const fileName = String(body?.fileName ?? "").trim();
    const mimeType = String(body?.mimeType ?? "").trim();
    const fileSize = Number(body?.fileSize);
    if (!announcementId || !bucket || !key || !fileName || !Number.isFinite(fileSize)) {
      return res.status(400).json(fail("公告图片登记参数不完整", 400));
    }
    const record = await completeAnnouncementImageUpload({
      announcementId,
      bucket,
      key,
      hash,
      fileName,
      mimeType,
      fileSize,
    });
    return res.json(ok(record, "公告图片已登记"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "登记公告图片失败";
    return res.status(400).json(fail(message, 400));
  }
});

// Reads tracking
adminAnnouncementsRouter.get("/:id/reads", async (req, res) => {
  const announcementId = String(req.params.id ?? "").trim();
  if (!announcementId) return res.status(400).json(fail("公告 ID 不能为空", 400));
  try {
    if (!(await announcementExists(announcementId))) {
      return res.status(404).json(fail("公告不存在", 404));
    }
    return res.json(ok(await readAnnouncementReads(announcementId, req.query.offset, req.query.limit)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取公告已读列表失败";
    return res.status(500).json(fail(message, 500));
  }
});
