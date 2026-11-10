import { Router, type Request, type Response } from "express";
import { deviceMessageIdentityFromRequest } from "../middleware/deviceMessageToken";
import { tokenFromRequest, verifyUserToken } from "../middleware/requireUserJwt";
import {
  DirectMessageValidationError,
  listUnreadForIdentity,
  markDirectMessageReadForIdentity,
} from "../services/directMessageService";
import { fail, ok } from "../types/response";

export const messagesRouter = Router();

async function identityFromRequest(req: Request) {
  const user = (await verifyUserToken(tokenFromRequest(req)));
  const deviceToken = (await deviceMessageIdentityFromRequest(req));
  const device = deviceToken ? { kind: deviceToken.kind, id: deviceToken.deviceId } : null;
  return { userId: user?.id ?? null, device };
}

async function requireMessageIdentity(req: Request, res: Response) {
  const identity = (await identityFromRequest(req));
  if (!identity.userId && !identity.device) {
    res.status(401).json(fail("缺少有效的账号或设备身份", 401));
    return null;
  }
  return identity;
}

function handleError(res: Response, error: unknown, fallback: string): void {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof DirectMessageValidationError ? 400 : 500;
  res.status(status).json(fail(message, status));
}

messagesRouter.get("/unread", async (req, res) => {
  const identity = (await requireMessageIdentity(req, res));
  if (!identity) return;
  try {
    return res.json(ok((await listUnreadForIdentity(identity, req.query.limit))));
  } catch (error) {
    handleError(res, error, "读取未读消息失败");
    return undefined;
  }
});

messagesRouter.post("/:id/read", async (req, res) => {
  const identity = (await requireMessageIdentity(req, res));
  if (!identity) return;
  try {
    const receipt = (await markDirectMessageReadForIdentity(identity, req.params.id));
    if (!receipt) return res.status(404).json(fail("消息不存在", 404));
    return res.json(ok(receipt));
  } catch (error) {
    handleError(res, error, "确认消息已读失败");
    return undefined;
  }
});
