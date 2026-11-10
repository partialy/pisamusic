import { Router } from "express";
import {
  acceptTrackingVisit,
  AppShareTrackingError,
  publicTrackingCode,
} from "../services/appShareTrackingService";
import { fail, ok } from "../types/response";
import { isBotUserAgent } from "../middleware/obviousBotBlocker";
export const appShareRouter = Router();
appShareRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
appShareRouter.get("/public/:code", async (req, res) => {
  try {
    return res.json(ok((await publicTrackingCode(String(req.params.code)))));
  } catch (error) {
    const status = error instanceof AppShareTrackingError ? error.status : 500;
    return res
      .status(status)
      .json(fail(status === 500 ? "读取分享链接失败" : "分享链接无效", status));
  }
});
appShareRouter.post("/visits", async (req, res) => {
  if (
    isBotUserAgent(
      req.header("user-agent") ?? "",
      [
        "bot",
        "spider",
        "crawler",
        "preview",
        "python/",
        "curl/",
        "wget/",
        "aiohttp/",
        "httpx",
        "go-http-client",
      ],
      true,
    ) ||
    /prefetch|prerender/i.test(
      `${req.header("purpose") ?? ""} ${req.header("sec-purpose") ?? ""}`,
    )
  )
    return res.status(403).json(fail("无效访问", 403));
  try {
    return res.json(ok((await acceptTrackingVisit(req, res))));
  } catch (error) {
    const status =
      error instanceof AppShareTrackingError
        ? error.status
        : error instanceof Error &&
            ["分享链接无效", "访问事件不匹配"].includes(error.message)
          ? 400
          : 500;
    if (status === 500) console.warn("[app-share] visit failed", error);
    return res
      .status(status)
      .json(
        fail(
          status === 500 ? "记录访问失败" : "访问参数或分享链接无效",
          status,
        ),
      );
  }
});
