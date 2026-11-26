import { Router, type Response } from "express";
import {
  batchDeleteAdminRedemptionCodes,
  batchUpdateAdminRedemptionCodeStatus,
  createAdminRedemptionCodes,
  deleteAdminRedemptionCodeById,
  getAdminRedemptionBatches,
  getAdminRedemptionCodes,
  getAdminRedemptionLogs,
  RedemptionValidationError,
  renameAdminRedemptionBatch,
  updateAdminRedemptionCodeStatus,
} from "../services/redemptionService";
import { fail, ok } from "../types/response";

export const adminRedemptionCodesRouter = Router();

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof RedemptionValidationError) {
    return res.status(error.statusCode).json(fail(error.message, error.statusCode));
  }
  const message = error instanceof Error ? error.message : fallback;
  return res.status(500).json(fail(message, 500));
}

adminRedemptionCodesRouter.get("/batches", async (req, res) => {
  try {
    return res.json(ok(await getAdminRedemptionBatches(req.query as Record<string, unknown>)));
  } catch (error) {
    return handleError(res, error, "读取兑换码批次列表失败");
  }
});

adminRedemptionCodesRouter.patch("/batches/:batchId", async (req, res) => {
  try {
    return res.json(ok(await renameAdminRedemptionBatch(req.params.batchId, req.body), "批次名称已更新"));
  } catch (error) {
    return handleError(res, error, "更新批次名称失败");
  }
});

adminRedemptionCodesRouter.post("/batch-status", async (req, res) => {
  try {
    return res.json(ok(await batchUpdateAdminRedemptionCodeStatus(req.body), "批量更新兑换码状态成功"));
  } catch (error) {
    return handleError(res, error, "批量更新兑换码状态失败");
  }
});

adminRedemptionCodesRouter.post("/batch-delete", async (req, res) => {
  try {
    return res.json(ok(await batchDeleteAdminRedemptionCodes(req.body), "批量删除兑换码成功"));
  } catch (error) {
    return handleError(res, error, "批量删除兑换码失败");
  }
});

adminRedemptionCodesRouter.get("/", async (req, res) => {
  try {
    return res.json(ok(await getAdminRedemptionCodes(req.query as Record<string, unknown>)));
  } catch (error) {
    return handleError(res, error, "读取兑换码列表失败");
  }
});

adminRedemptionCodesRouter.post("/", async (req, res) => {
  try {
    const adminUser = (req as { adminUser?: { username?: string } }).adminUser?.username ?? "admin";
    return res.json(ok(await createAdminRedemptionCodes(req.body, adminUser), "兑换码已生成"));
  } catch (error) {
    return handleError(res, error, "生成兑换码失败");
  }
});

adminRedemptionCodesRouter.get("/logs", async (req, res) => {
  try {
    return res.json(ok(await getAdminRedemptionLogs(req.query as Record<string, unknown>)));
  } catch (error) {
    return handleError(res, error, "读取兑换记录失败");
  }
});

adminRedemptionCodesRouter.patch("/:id", async (req, res) => {
  try {
    return res.json(ok(await updateAdminRedemptionCodeStatus(req.params.id, req.body), "兑换码状态已更新"));
  } catch (error) {
    return handleError(res, error, "更新兑换码状态失败");
  }
});

adminRedemptionCodesRouter.delete("/:id", async (req, res) => {
  try {
    return res.json(ok(await deleteAdminRedemptionCodeById(req.params.id), "兑换码已删除"));
  } catch (error) {
    return handleError(res, error, "删除兑换码失败");
  }
});
