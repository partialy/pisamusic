import { Router, type Request, type Response } from "express";
import { getClientIp } from "../middleware/clientIp";
import { deviceMessageIdentityFromRequest } from "../middleware/deviceMessageToken";
import { tokenFromRequest, verifyUserToken } from "../middleware/requireUserJwt";
import {
  acquireSongDownloads,
  queryCurrentSongDownloadQuota,
  SongDownloadValidationError,
} from "../services/songDownloadService";
import { fail, ok } from "../types/response";

export const songDownloadsRouter = Router();

async function resolveCallerIdentity(req: Request, res: Response) {
  const deviceIdentity = await deviceMessageIdentityFromRequest(req);
  if (!deviceIdentity) {
    res.status(401).json(fail("缺少有效的设备身份", 401));
    return null;
  }

  const rawUserToken = tokenFromRequest(req);
  const user = rawUserToken ? await verifyUserToken(rawUserToken) : null;
  if (rawUserToken && !user) {
    res.status(401).json(fail("账号登录已失效，请重新登录", 401));
    return null;
  }

  return { deviceIdentity, user };
}

songDownloadsRouter.post("/acquire", async (req: Request, res: Response) => {
  try {
    const identity = await resolveCallerIdentity(req, res);
    if (!identity) return undefined;

    const result = await acquireSongDownloads({
      deviceIdentity: identity.deviceIdentity,
      user: identity.user,
      clientIp: getClientIp(req),
      body: req.body,
    });
    return res.json(ok(result));
  } catch (error) {
    if (error instanceof SongDownloadValidationError) {
      return res.status(error.statusCode).json(fail(error.message, error.statusCode));
    }
    const message = error instanceof Error ? error.message : "校验下载配额失败";
    return res.status(500).json(fail(message, 500));
  }
});

songDownloadsRouter.get("/quota", async (req: Request, res: Response) => {
  try {
    const identity = await resolveCallerIdentity(req, res);
    if (!identity) return undefined;

    const quota = await queryCurrentSongDownloadQuota({
      deviceIdentity: identity.deviceIdentity,
      user: identity.user,
    });
    return res.json(ok(quota));
  } catch (error) {
    if (error instanceof SongDownloadValidationError) {
      return res.status(error.statusCode).json(fail(error.message, error.statusCode));
    }
    const message = error instanceof Error ? error.message : "查询下载配额失败";
    return res.status(500).json(fail(message, 500));
  }
});
