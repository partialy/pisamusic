import { Router } from "express";
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  listAdminFeedback,
  readAdminFeedbackDetail,
  updateAdminFeedbackStatus,
  type FeedbackStatus,
  type FeedbackType,
} from "../db/feedbackStore";
import { fail, ok } from "../types/response";

export const adminFeedbackRouter = Router();

const FEEDBACK_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function normalizeId(value: unknown): string | null {
  const id = typeof value === "string" ? value.trim() : "";
  return id && FEEDBACK_ID_RE.test(id) ? id : null;
}

function normalizeStatus(value: unknown): FeedbackStatus | undefined {
  return typeof value === "string" && FEEDBACK_STATUSES.includes(value as FeedbackStatus)
    ? value as FeedbackStatus
    : undefined;
}

function normalizeType(value: unknown): FeedbackType | undefined {
  return typeof value === "string" && FEEDBACK_TYPES.includes(value as FeedbackType)
    ? value as FeedbackType
    : undefined;
}

adminFeedbackRouter.get("/", (req, res) => {
  try {
    const statusValue = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const typeValue = typeof req.query.type === "string" ? req.query.type.trim() : "";
    const status = normalizeStatus(statusValue);
    const type = normalizeType(typeValue);
    if (statusValue && !status) return res.status(400).json(fail("无效的反馈状态", 400));
    if (typeValue && !type) return res.status(400).json(fail("无效的反馈类型", 400));
    return res.json(ok(listAdminFeedback({
      status,
      type,
      keyword: typeof req.query.keyword === "string" ? req.query.keyword : undefined,
      offset: req.query.offset,
      limit: req.query.limit,
    })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取反馈列表失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminFeedbackRouter.get("/:id", (req, res) => {
  try {
    const id = normalizeId(req.params.id);
    if (!id) return res.status(400).json(fail("无效的反馈 ID", 400));
    const feedback = readAdminFeedbackDetail(id);
    if (!feedback) return res.status(404).json(fail("反馈不存在", 404));
    return res.json(ok(feedback));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取反馈详情失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminFeedbackRouter.patch("/:id/status", (req, res) => {
  try {
    const id = normalizeId(req.params.id);
    if (!id) return res.status(400).json(fail("无效的反馈 ID", 400));
    const status = normalizeStatus(req.body?.status);
    if (!status) return res.status(400).json(fail("状态必须为 pending 或 processed", 400));
    const feedback = updateAdminFeedbackStatus(id, status);
    if (!feedback) return res.status(404).json(fail("反馈不存在", 404));
    return res.json(ok(feedback, status === "processed" ? "反馈已标记为已处理" : "反馈已恢复为待处理"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新反馈状态失败";
    return res.status(500).json(fail(message, 500));
  }
});
