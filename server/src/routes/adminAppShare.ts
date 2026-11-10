import { Router } from "express";
import { readAdminAppShare, saveManagedAppShare, createAppShareIconToken, completeAppShareIcon } from "../services/appShareService";
import { fail, ok } from "../types/response";

export const adminAppShareRouter = Router();
adminAppShareRouter.get("/", async (_req, res) => {
  try { return res.json(ok((await readAdminAppShare()))); }
  catch (e) { return res.status(500).json(fail(e instanceof Error ? e.message : "读取 App 分享配置失败", 500)); }
});
adminAppShareRouter.put("/", async (req, res) => {
  try { return res.json(ok((await saveManagedAppShare(req.body)), "App 分享配置已保存")); }
  catch (e) { return res.status(400).json(fail(e instanceof Error ? e.message : "保存 App 分享配置失败", 400)); }
});
adminAppShareRouter.post("/icon/upload-token", async (req, res) => {
  try { return res.json(ok((await createAppShareIconToken(req.body)))); }
  catch (e) { return res.status(400).json(fail(e instanceof Error ? e.message : "创建图标上传凭证失败", 400)); }
});
adminAppShareRouter.post("/icon/complete", async (req, res) => {
  try { return res.json(ok(await completeAppShareIcon(req.body))); }
  catch (e) { return res.status(400).json(fail(e instanceof Error ? e.message : "核验图标失败", 400)); }
});
