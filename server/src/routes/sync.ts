import type { Request, Response } from "express";
import { Router } from "express";
import {
  applySyncChanges,
  authenticateSyncToken,
  createSyncSpace,
  joinSyncSpace,
  listSyncChanges,
  resetSyncSpace,
  unbindSyncDevice,
  type SyncAuth,
} from "../db/syncStore";
import { fail, ok } from "../types/response";

export const syncRouter = Router();

type AuthedRequest = Request & {
  syncAuth?: SyncAuth;
};

function tokenFromRequest(req: Request): string {
  const raw = req.header("authorization") ?? "";
  if (!raw.startsWith("Bearer ")) return "";
  return raw.slice("Bearer ".length).trim();
}

function requireSyncAuth(req: AuthedRequest, res: Response, next: () => void): void {
  const auth = authenticateSyncToken(tokenFromRequest(req));
  if (!auth) {
    res.status(401).json(fail("同步身份无效", 401));
    return;
  }
  req.syncAuth = auth;
  next();
}

function getAuth(req: AuthedRequest): SyncAuth {
  if (!req.syncAuth) throw new Error("缺少同步身份");
  return req.syncAuth;
}

function handleError(res: Response, error: unknown, fallback: string): void {
  const message = error instanceof Error ? error.message : fallback;
  res.status(400).json(fail(message, 400));
}

syncRouter.post("/spaces", (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    res.json(ok(createSyncSpace(body.deviceName, body.platform), "同步空间已创建"));
  } catch (error) {
    handleError(res, error, "创建同步空间失败");
  }
});

syncRouter.post("/spaces/join", (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    res.json(ok(joinSyncSpace(body.syncCode, body.deviceName, body.platform), "已加入同步空间"));
  } catch (error) {
    handleError(res, error, "加入同步空间失败");
  }
});

syncRouter.post("/spaces/reset", requireSyncAuth, (req: AuthedRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    res.json(ok(resetSyncSpace(getAuth(req), body.deviceName, body.platform), "同步码已重新生成"));
  } catch (error) {
    handleError(res, error, "重新生成同步码失败");
  }
});

syncRouter.get("/changes", requireSyncAuth, (req: AuthedRequest, res) => {
  try {
    res.json(ok(listSyncChanges(getAuth(req), req.query.since)));
  } catch (error) {
    handleError(res, error, "拉取同步变更失败");
  }
});

syncRouter.post("/changes", requireSyncAuth, (req: AuthedRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    res.json(ok(applySyncChanges(getAuth(req), body.changes)));
  } catch (error) {
    handleError(res, error, "推送同步变更失败");
  }
});

syncRouter.post("/devices/unbind", requireSyncAuth, (req: AuthedRequest, res) => {
  try {
    res.json(ok({ unbound: unbindSyncDevice(getAuth(req)) }, "已解绑同步设备"));
  } catch (error) {
    handleError(res, error, "解绑同步设备失败");
  }
});
