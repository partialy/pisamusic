import { Router } from "express";
import {
  completeSidebarMenuIcon,
  createSidebarMenuIconToken,
  readAdminSidebarMenu,
  saveManagedSidebarMenu,
} from "../services/sidebarMenuService";
import { fail, ok } from "../types/response";

export const adminSidebarMenuRouter = Router();

adminSidebarMenuRouter.get("/", async (_req, res) => {
  try {
    return res.json(ok(await readAdminSidebarMenu()));
  } catch (e) {
    return res.status(500).json(fail(e instanceof Error ? e.message : "读取侧栏菜单配置失败", 500));
  }
});

adminSidebarMenuRouter.put("/", async (req, res) => {
  try {
    return res.json(ok(await saveManagedSidebarMenu(req.body), "侧栏菜单配置已保存"));
  } catch (e) {
    return res.status(400).json(fail(e instanceof Error ? e.message : "保存侧栏菜单配置失败", 400));
  }
});

adminSidebarMenuRouter.post("/icon/upload-token", async (req, res) => {
  try {
    return res.json(ok(await createSidebarMenuIconToken(req.body)));
  } catch (e) {
    return res.status(400).json(fail(e instanceof Error ? e.message : "创建图标上传凭证失败", 400));
  }
});

adminSidebarMenuRouter.post("/icon/complete", async (req, res) => {
  try {
    return res.json(ok(await completeSidebarMenuIcon(req.body)));
  } catch (e) {
    return res.status(400).json(fail(e instanceof Error ? e.message : "核验图标失败", 400));
  }
});
