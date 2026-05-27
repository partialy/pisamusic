import type { Request, Response } from "express";
import { Router } from "express";
import { applySyncChanges, listSyncChanges, type SyncAuth } from "../db/syncStore";
import { getUserAuth, requireUserJwt, type UserAuthedRequest } from "../middleware/requireUserJwt";
import { fail, ok } from "../types/response";

export const syncRouter = Router();

type SyncRequest = UserAuthedRequest & {
  syncAuth?: SyncAuth;
};

function normalizeDeviceId(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw ? raw.slice(0, 128) : "default";
}

function attachSyncAuth(req: SyncRequest, _res: Response, next: () => void): void {
  const user = getUserAuth(req);
  req.syncAuth = {
    userId: user.userId,
    deviceId: normalizeDeviceId(req.header("x-pm-device-id") ?? req.header("x-device-id")),
  };
  next();
}

function getAuth(req: SyncRequest): SyncAuth {
  if (!req.syncAuth) throw new Error("缺少同步身份");
  return req.syncAuth;
}

function handleError(res: Response, error: unknown, fallback: string): void {
  const message = error instanceof Error ? error.message : fallback;
  res.status(400).json(fail(message, 400));
}

syncRouter.use(requireUserJwt, attachSyncAuth);

syncRouter.get("/changes", (req: SyncRequest, res) => {
  try {
    res.json(ok(listSyncChanges(getAuth(req), req.query.since)));
  } catch (error) {
    handleError(res, error, "拉取同步变更失败");
  }
});

syncRouter.post("/changes", (req: SyncRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    res.json(ok(applySyncChanges(getAuth(req), body.changes)));
  } catch (error) {
    handleError(res, error, "推送同步变更失败");
  }
});
