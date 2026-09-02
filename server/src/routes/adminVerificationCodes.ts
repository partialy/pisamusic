import { Router } from "express";
import { deleteVerificationCodeRecord, listVerificationCodeRecords } from "../db/verificationCodeStore";
import { fail, ok } from "../types/response";

export const adminVerificationCodesRouter = Router();

adminVerificationCodesRouter.get("/", (req, res) => {
  try {
    const channel = typeof req.query.channel === "string" ? req.query.channel : undefined;
    const purpose = typeof req.query.purpose === "string" ? req.query.purpose : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword : undefined;
    const offset = Number(req.query.offset) || 0;
    const limit = Number(req.query.limit) || 20;

    const data = listVerificationCodeRecords({
      channel,
      purpose,
      status,
      keyword,
      offset,
      limit,
    });

    return res.json(ok(data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取验证码记录失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminVerificationCodesRouter.delete("/:id", (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json(fail("缺少记录 ID", 400));
    const success = deleteVerificationCodeRecord(id);
    if (!success) return res.status(404).json(fail("记录不存在或已被删除", 404));
    return res.json(ok({ deleted: true }, "记录已删除"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除验证码记录失败";
    return res.status(500).json(fail(message, 500));
  }
});
