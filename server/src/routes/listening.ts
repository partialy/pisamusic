import { Router, type Response } from "express";
import { getUserAuth, requireUserJwt, type UserAuthedRequest } from "../middleware/requireUserJwt";
import {
  getListeningSummary,
  getListeningTracks,
  ingestListeningBatch,
  ListeningValidationError,
  type ListeningAuth,
} from "../services/listeningService";
import { fail, ok } from "../types/response";

export const listeningRouter = Router();

type ListeningRequest = UserAuthedRequest;

function normalizeDeviceId(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.slice(0, 128);
}

function getBatchAuth(req: ListeningRequest): ListeningAuth {
  const user = getUserAuth(req);
  const deviceId = normalizeDeviceId(req.header("x-pm-device-id"));
  if (!deviceId) throw new ListeningValidationError("x-pm-device-id 不能为空");
  return {
    userId: user.userId,
    deviceId,
  };
}

function getUserId(req: ListeningRequest): string {
  return getUserAuth(req).userId;
}

function parseQueryInteger(value: unknown, name: string, fallback: number, minimum: number): number {
  if (value == null) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new ListeningValidationError(`${name} 必须是整数`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new ListeningValidationError(`${name} 超出允许范围`);
  }
  return parsed;
}

function handleError(res: Response, error: unknown, fallback: string): void {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof ListeningValidationError ? 400 : 500;
  res.status(status).json(fail(message, status));
}

listeningRouter.use(requireUserJwt);

listeningRouter.post("/fragments/batch", (req: ListeningRequest, res) => {
  try {
    const result = ingestListeningBatch(getBatchAuth(req), req.body);
    return res.json(ok({
      accepted: result.acceptedEventIds,
      duplicate: result.duplicateEventIds,
      rejected: result.rejected,
      summary: result.summary,
      serverTimeMs: result.serverTimeMs,
    }));
  } catch (error) {
    handleError(res, error, "上报听歌片段失败");
    return undefined;
  }
});

listeningRouter.get("/summary", (req: ListeningRequest, res) => {
  try {
    return res.json(ok(getListeningSummary(getUserId(req))));
  } catch (error) {
    handleError(res, error, "读取听歌汇总失败");
    return undefined;
  }
});

listeningRouter.get("/tracks", (req: ListeningRequest, res) => {
  try {
    const rawSource = typeof req.query.source === "string" ? req.query.source : undefined;
    if (rawSource && !["kg", "wy", "kw", "cloud", "local"].includes(rawSource)) {
      throw new ListeningValidationError("source 不受支持");
    }
    const rawSort = typeof req.query.sort === "string" ? req.query.sort : undefined;
    const sortMap = {
      listened_ms: "listenedMs",
      play_count: "playCount",
      last_listened_at: "lastListenedAt",
      listenedMs: "listenedMs",
      playCount: "playCount",
      lastListenedAt: "lastListenedAt",
    } as const;
    if (rawSort && !(rawSort in sortMap)) throw new ListeningValidationError("sort 不受支持");
    return res.json(ok(getListeningTracks(getUserId(req), {
      source: rawSource as "kg" | "wy" | "kw" | "cloud" | "local" | undefined,
      sort: rawSort ? sortMap[rawSort as keyof typeof sortMap] : undefined,
      offset: parseQueryInteger(req.query.offset, "offset", 0, 0),
      limit: parseQueryInteger(req.query.limit, "limit", 20, 1),
    })));
  } catch (error) {
    handleError(res, error, "读取听歌歌曲列表失败");
    return undefined;
  }
});
