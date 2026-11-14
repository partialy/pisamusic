import { Router, type Response } from "express";
import { getUserAuth, requireUserJwt, type UserAuthedRequest } from "../middleware/requireUserJwt";
import { createPlaylistCoverToken, completePlaylistCover, readPlaylistCover } from "../services/playlistCoverService";
import { SyncValidationError } from "../services/syncPayloadPolicy";
import { ok, fail } from "../types/response";
export const playlistCoverRouter = Router();
playlistCoverRouter.use(requireUserJwt);
function error(res: Response, e: unknown): void {
  const status = e instanceof SyncValidationError ? 400 : 500;
  res.status(status).json(fail(status === 400 ? (e as Error).message : "歌单封面操作失败",status));
}
playlistCoverRouter.post("/upload-token",async (req: UserAuthedRequest,res) => {
  try { res.json(ok(await createPlaylistCoverToken(getUserAuth(req).userId,req.body))); } catch(e) { error(res,e); }
});
playlistCoverRouter.post("/complete",async (req: UserAuthedRequest,res) => {
  try { res.json(ok(await completePlaylistCover(getUserAuth(req).userId,req.body))); } catch(e) { error(res,e); }
});
playlistCoverRouter.get("/:resourceId",async (req: UserAuthedRequest,res) => {
  res.setHeader("Cache-Control","private, no-store");
  try { res.json(ok(await readPlaylistCover(getUserAuth(req).userId,String(req.params.resourceId)))); } catch(e) { error(res,e); }
});
