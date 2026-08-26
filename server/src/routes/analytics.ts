import { Router } from "express";
import type { Request, Response } from "express";
import { recordSiteVisit } from "../db/analyticsStore";
import { fail, ok } from "../types/response";

export const analyticsRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(val: unknown, maxLen: number): string {
  if (typeof val !== "string") return "";
  const trimmed = val.trim();
  return trimmed.length <= maxLen ? trimmed : trimmed.slice(0, maxLen);
}

function cleanIp(req: Request): string {
  const rawIp = typeof req.ip === "string" && req.ip.length > 0 ? req.ip : req.socket?.remoteAddress;
  const ipStr = String(rawIp ?? "").replace(/^::ffff:/i, "").trim();
  return ipStr.length <= 64 ? ipStr : ipStr.slice(0, 64);
}

function cleanDimension(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return 0;
  if (num > 20000) return 20000;
  return Math.trunc(num);
}

analyticsRouter.post("/site-visit", (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json(fail("请求体必须是对象", 400));
      return;
    }

    const visitorId = typeof body.visitorId === "string" ? body.visitorId.trim() : "";
    if (!visitorId || !UUID_RE.test(visitorId)) {
      res.status(400).json(fail("visitorId 必须是有效的 UUID", 400));
      return;
    }

    const rawPath = typeof body.path === "string" ? body.path.trim() : "/";
    if (!rawPath.startsWith("/")) {
      res.status(400).json(fail("path 必须以 / 开头", 400));
      return;
    }
    const path = cleanString(rawPath, 256) || "/";
    const referrer = cleanString(body.referrer, 512);
    const language = cleanString(body.language, 32);
    const timezone = cleanString(body.timezone, 64);
    const screenWidth = cleanDimension(body.screenWidth);
    const screenHeight = cleanDimension(body.screenHeight);

    const userAgent = cleanString(req.headers["user-agent"], 512);
    const ipAddress = cleanIp(req);

    const result = recordSiteVisit({
      visitorId,
      path,
      referrer,
      language,
      timezone,
      screenWidth,
      screenHeight,
      ipAddress,
      userAgent,
    });

    res.json(ok({ accepted: result.accepted, visitDay: result.visitDay }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "记录访问失败";
    res.status(500).json(fail(message, 500));
  }
});
