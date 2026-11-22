import { Router } from "express";
import { type Announcement } from "../db/configStore";
import { announcementExists, readAnnouncementReads } from "../db/announcementReadStore";
import {
  completeAnnouncementImageUpload,
  createAnnouncementImageToken,
  deleteManagedAnnouncement,
  normalizeAnnouncementContent,
  readHydratedAnnouncements,
  saveManagedAnnouncement,
} from "../services/announcementService";
import { fail, ok } from "../types/response";

export const adminAnnouncementsRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRequiredString(
  value: unknown,
  field: string,
  maxLength: number,
): { ok: true; value: string } | { ok: false; msg: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: false, msg: `${field} 不能为空` };
  if (text.length > maxLength) return { ok: false, msg: `${field} 长度不能超过 ${maxLength}` };
  return { ok: true, value: text };
}

function normalizeAnnouncementGotoUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  let parsed: URL;
  if (/^pisamusic:\/\/[A-Za-z0-9][A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$/i.test(raw)) return raw;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("gotoUrl 必须是有效 HTTPS 或 pisamusic:// 地址");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("gotoUrl 只允许 HTTPS 或 pisamusic:// 地址，且 HTTPS 不得带认证信息");
  }
  return parsed.toString();
}

function normalizeAnnouncement(body: unknown): { ok: true; value: Announcement } | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const id = normalizeRequiredString(body.id, "id", 120);
  if (!id.ok) return id;
  let content: Announcement["content"];
  try {
    content = normalizeAnnouncementContent(body.content);
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "公告内容不合法" };
  }
  const time = normalizeRequiredString(body.time, "time", 100);
  if (!time.ok) return time;
  const publisher = normalizeRequiredString(body.publisher, "publisher", 120);
  if (!publisher.ok) return publisher;
  const confirmText = normalizeRequiredString(body.confirmText, "confirmText", 60);
  if (!confirmText.ok) return confirmText;
  let gotoUrl = "";
  try {
    gotoUrl = normalizeAnnouncementGotoUrl(body.gotoUrl);
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "gotoUrl 不合法" };
  }
  return {
    ok: true,
    value: {
      id: id.value,
      content,
      time: time.value,
      publisher: publisher.value,
      confirmText: confirmText.value,
      showEveryTime: Boolean(body.showEveryTime),
      showGotoButton: Boolean(body.showGotoButton),
      gotoUrl,
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
    },
  };
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
    const result = normalizeAnnouncement(req.body);
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    return res.json(ok(await saveManagedAnnouncement(result.value), "公告已保存"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存公告失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminAnnouncementsRouter.put("/:id", async (req, res) => {
  try {
    const existing = (await readHydratedAnnouncements()).find((item) => item.id === req.params.id);
    const body = isRecord(req.body) ? req.body : {};
    const result = normalizeAnnouncement({
      ...body,
      id: req.params.id,
      ...(body.enabled === undefined && existing ? { enabled: existing.enabled } : {}),
    });
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    return res.json(ok(await saveManagedAnnouncement(result.value), "公告已保存"));
  } catch (e) {
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
