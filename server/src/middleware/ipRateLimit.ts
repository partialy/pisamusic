import type { Request, RequestHandler, Response } from "express";
import { fail } from "../types/response";
import { getClientIp } from "./clientIp";
import { isPathMatch } from "./pathMatcher";

export interface IpRateLimitPolicy {
  paths: readonly string[];
  windowSeconds: number;
  maxRequests: number;
}

export interface IpRateLimitOptions {
  group: string;
  getPolicy: () => IpRateLimitPolicy;
  getKey?: (req: Request) => string;
  maxKeys?: number;
}

export class MemoryRateLimitStore {
  private readonly hits = new Map<string, number[]>();
  private readonly maxKeys: number;
  private lastCleanupTime = Date.now();

  constructor(maxKeys = 50000) {
    this.maxKeys = maxKeys;
  }

  public hit(key: string, windowMs: number, maxRequests: number, now = Date.now()): {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  } {
    // 定期整体淘汰过期 key（每 60 秒）
    if (now - this.lastCleanupTime > 60000) {
      this.cleanup(now, windowMs);
    }

    let timestamps = this.hits.get(key);
    if (!timestamps) {
      if (this.hits.size >= this.maxKeys) {
        // 达到容量上限，触发一次强力清理
        this.cleanup(now, windowMs);
        if (this.hits.size >= this.maxKeys) {
          // 删除最老的一个 key
          const firstKey = this.hits.keys().next().value;
          if (firstKey) this.hits.delete(firstKey);
        }
      }
      timestamps = [];
      this.hits.set(key, timestamps);
    }

    // 剔除窗口外的时间戳
    const threshold = now - windowMs;
    while (timestamps.length > 0 && timestamps[0] <= threshold) {
      timestamps.shift();
    }

    if (timestamps.length >= maxRequests) {
      const oldestHit = timestamps[0];
      const retryAfterMs = Math.max(0, oldestHit + windowMs - now);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    timestamps.push(now);
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - timestamps.length),
      retryAfterSeconds: 0,
    };
  }

  public cleanup(now = Date.now(), windowMs = 60000): void {
    this.lastCleanupTime = now;
    const threshold = now - windowMs;
    for (const [k, timestamps] of this.hits.entries()) {
      while (timestamps.length > 0 && timestamps[0] <= threshold) {
        timestamps.shift();
      }
      if (timestamps.length === 0) {
        this.hits.delete(k);
      }
    }
  }

  public clear(): void {
    this.hits.clear();
  }
}

export function createIpRateLimitMiddleware(options: IpRateLimitOptions): RequestHandler {
  const store = new MemoryRateLimitStore(options.maxKeys ?? 50000);

  return (req: Request, res: Response, next) => {
    const policy = options.getPolicy();
    const pathname = req.originalUrl || req.url;

    if (!isPathMatch(pathname, policy.paths)) {
      return next();
    }

    const windowMs = Math.max(1000, policy.windowSeconds * 1000);
    const maxRequests = Math.max(1, policy.maxRequests);

    const clientIp = options.getKey ? options.getKey(req) : getClientIp(req);
    const key = `${options.group}:${clientIp}`;

    const result = store.hit(key, windowMs, maxRequests);
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      res.status(429).json(fail("Too Many Requests", -429));
      return;
    }

    next();
  };
}
