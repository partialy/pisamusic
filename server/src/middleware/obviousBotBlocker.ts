import type { Request, RequestHandler, Response } from "express";
import { fail } from "../types/response";
import { isPathMatch } from "./pathMatcher";

export interface BotBlockPolicy {
  paths: readonly string[];
  userAgentSubstrings: readonly string[];
  blockEmptyUserAgent: boolean;
}

export function isBotUserAgent(
  userAgent: string,
  botSubstrings: readonly string[],
  blockEmpty: boolean,
): boolean {
  const trimmed = userAgent.trim();
  if (!trimmed) {
    return blockEmpty;
  }
  const lower = trimmed.toLowerCase();
  for (const sub of botSubstrings) {
    if (!sub) continue;
    if (lower.includes(sub.toLowerCase())) {
      return true;
    }
  }
  return false;
}

export function createObviousBotBlocker(
  getPolicy: () => BotBlockPolicy,
): RequestHandler {
  return (req: Request, res: Response, next) => {
    const policy = getPolicy();
    const pathname = req.originalUrl || req.url;

    if (!isPathMatch(pathname, policy.paths)) {
      return next();
    }

    const ua = String(req.headers["user-agent"] ?? "");
    if (isBotUserAgent(ua, policy.userAgentSubstrings, policy.blockEmptyUserAgent)) {
      res.status(403).json(fail("Forbidden", -403));
      return;
    }

    next();
  };
}
