import { Router, type Response } from "express";
import { getAdminAuth, type AdminAuthedRequest } from "../middleware/requireAdminJwt";
import {
  DirectMessageNotFoundError,
  DirectMessageTargetNotFoundError,
  DirectMessageValidationError,
  createDirectMessage,
  deleteDirectMessageById,
  listAdminDirectMessagePage,
} from "../services/directMessageService";
import { fail, ok } from "../types/response";

export const adminDirectMessagesRouter = Router();

function handleError(res: Response, error: unknown, fallback: string): void {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof DirectMessageNotFoundError || error instanceof DirectMessageTargetNotFoundError
    ? 404
    : error instanceof DirectMessageValidationError
      ? 400
      : 500;
  res.status(status).json(fail(message, status));
}

adminDirectMessagesRouter.post("/", (req: AdminAuthedRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    return res.json(ok(createDirectMessage({
      targetKind: body?.targetKind,
      targetId: body?.targetId,
      content: body?.content,
      createdByAdmin: getAdminAuth(req).username,
    }), "消息已发送"));
  } catch (error) {
    handleError(res, error, "发送消息失败");
    return undefined;
  }
});

adminDirectMessagesRouter.get("/", (req, res) => {
  try {
    return res.json(ok(listAdminDirectMessagePage({
      targetKind: req.query.targetKind,
      targetId: req.query.targetId,
      offset: req.query.offset,
      limit: req.query.limit,
    })));
  } catch (error) {
    handleError(res, error, "读取消息记录失败");
    return undefined;
  }
});

adminDirectMessagesRouter.delete("/:id", (req, res) => {
  try {
    return res.json(ok({ ...deleteDirectMessageById(req.params.id), deleted: true }, "留言已删除"));
  } catch (error) {
    handleError(res, error, "删除留言失败");
    return undefined;
  }
});
