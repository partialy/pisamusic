import type { RequestHandler } from "express";
import { isInstallationReady } from "../services/setupService";
import { fail } from "../types/response";

// Express 默认忽略路径大小写和末尾斜杠，门禁必须使用相同边界。
export function normalizedGatePath(path: string): string {
  return path.toLowerCase().replace(/\/+$/, "") || "/";
}

export function isPathWithin(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

export const installationGate: RequestHandler = async (req, res, next) => {
  const path = normalizedGatePath(req.path);
  if (path === "/api/health" || isPathWithin(path, "/api/setup") ||
    !["/api", "/uploads", "/discover", "/static"].some(prefix => isPathWithin(path, prefix))) return next();
  try {
    if (!await isInstallationReady()) { res.status(503).json(fail("当前数据库尚未安装或迁移尚未完成", 503)); return; }
    next();
  } catch (error) { next(error); }
};
