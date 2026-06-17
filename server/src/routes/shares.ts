import { Router } from "express";
import {
  createShareRecord,
  readPublicShareAndIncrement,
  ShareValidationError,
  type ShareType,
} from "../db/shareStore";
import { getUserAuth, requireUserJwt, type UserAuthedRequest } from "../middleware/requireUserJwt";
import { fail, ok } from "../types/response";

export const sharesRouter = Router();

const PUBLIC_WEB_ORIGIN = "https://pisamusic.partialy.cn";
const MUSIC_SHARE_TYPE = "music-share";

function buildShareUrl(uuid: string): string {
  return `${PUBLIC_WEB_ORIGIN}/scan?type=${MUSIC_SHARE_TYPE}&uuid=${encodeURIComponent(uuid)}`;
}

function buildAppUrl(uuid: string): string {
  return `pisamusic://scan?type=${MUSIC_SHARE_TYPE}&uuid=${encodeURIComponent(uuid)}`;
}

sharesRouter.post("/", requireUserJwt, (req: UserAuthedRequest, res) => {
  try {
    const auth = getUserAuth(req);
    const type = String(req.body?.type ?? "") as ShareType;
    const share = createShareRecord(
      {
        type,
        rawJson: req.body?.rawJson,
      },
      {
        userId: auth.userId,
        user: auth.user,
      },
    );
    res.json(
      ok(
        {
          uuid: share.uuid,
          shareUrl: buildShareUrl(share.uuid),
          appUrl: buildAppUrl(share.uuid),
          share,
        },
        "创建成功",
      ),
    );
  } catch (error) {
    if (error instanceof ShareValidationError) {
      res.status(400).json(fail(error.message, 400));
      return;
    }
    const message = error instanceof Error ? error.message : "创建分享失败";
    res.status(500).json(fail(message, 500));
  }
});

sharesRouter.get("/public/:uuid", (req, res) => {
  try {
    const share = readPublicShareAndIncrement(req.params.uuid);
    if (!share) {
      res.status(404).json(fail("分享不存在或已失效", 404));
      return;
    }
    res.json(ok(share));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取分享失败";
    res.status(500).json(fail(message, 500));
  }
});
