import { Router, type Request, type Response } from "express";
import { deviceMessageIdentityFromRequest } from "../middleware/deviceMessageToken";
import { tokenFromRequest, verifyUserToken } from "../middleware/requireUserJwt";
import { getClientIp } from "../middleware/clientIp";
import {
  AnnouncementReadValidationError,
  recordAnnouncementRead,
} from "../services/announcementReadService";
import { fail, ok } from "../types/response";

export const announcementsRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readPlatform(body: unknown): "android" | "desktop" | null {
  if (!isRecord(body)) return null;
  return body.platform === "android" || body.platform === "desktop" ? body.platform : null;
}

announcementsRouter.post("/:id/read", (req: Request, res: Response) => {
  try {
    const announcementId = String(req.params.id ?? "").trim();
    const platform = readPlatform(req.body);
    if (!announcementId) {
      return res.status(400).json(fail("公告 ID 不能为空", 400));
    }
    if (!platform) {
      return res.status(400).json(fail("platform 必须是 android 或 desktop", 400));
    }

    const deviceIdentity = deviceMessageIdentityFromRequest(req);
    if (!deviceIdentity) {
      return res.status(401).json(fail("缺少有效的设备身份", 401));
    }

    const rawUserToken = tokenFromRequest(req);
    const user = rawUserToken ? verifyUserToken(rawUserToken) : null;
    if (rawUserToken && !user) {
      return res.status(401).json(fail("账号登录已失效，请重新登录", 401));
    }

    const receipt = recordAnnouncementRead({
      announcementId,
      platform,
      deviceIdentity,
      user,
      clientIp: getClientIp(req),
      userAgent: req.get("user-agent") ?? "",
    });
    return res.json(ok({
      announcementId: receipt.announcementId,
      readAt: receipt.readAt,
      recorded: true,
    }));
  } catch (error) {
    if (error instanceof AnnouncementReadValidationError) {
      return res.status(error.statusCode).json(fail(error.message, error.statusCode));
    }
    const message = error instanceof Error ? error.message : "公告已读回执失败";
    return res.status(500).json(fail(message, 500));
  }
});
