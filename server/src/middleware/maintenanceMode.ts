import type { RequestHandler } from "express";
import { isMaintenanceMode, trackBusinessRequest } from "../operations/maintenance";
import { fail } from "../types/response";
import { isPathWithin, normalizedGatePath } from "./installation";

export const maintenanceMode: RequestHandler = (req, res, next) => {
  const path = normalizedGatePath(req.path);
  const allowed = (req.method === "GET" && ["/api/health", "/api/setup/status"].includes(path)) ||
    (req.method === "POST" && path === "/api/admin/login") ||
    isPathWithin(path, "/api/admin/database-migration");
  if (!isPathWithin(path, "/api") || allowed) { next(); return; }
  if (isMaintenanceMode()) { res.status(503).json(fail("系统维护中，请稍后重试", 503)); return; }
  const done = trackBusinessRequest();
  res.once("finish", done);
  // 响应断开不代表异步业务已结束；挂起的 handler 会使排空超时并保留维护。
  next();
};
