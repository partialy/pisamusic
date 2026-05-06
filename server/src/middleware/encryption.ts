import type { NextFunction, Request, Response } from "express";
import { decrypt, encrypt, randomFullKey } from "../crypto/aesGcm";
import { fail } from "../types/response";

const TS_WINDOW_MS = 5 * 60 * 1000;
const NONCE_TTL_MS = 5 * 60 * 1000;
const NONCE_MAX = 50_000;
const HEADER_RANDOM = "x-pm-random";
const HEADER_VER = "x-pm-enc-ver";
const ENC_VER = "1";

class TtlSet {
  private readonly map = new Map<string, number>();

  has(key: string): boolean {
    const expireAt = this.map.get(key);
    if (expireAt === undefined) return false;
    if (expireAt <= Date.now()) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  add(key: string, ttlMs: number): void {
    if (this.map.size >= NONCE_MAX) {
      this.evictExpired();
      if (this.map.size >= NONCE_MAX) {
        const firstKey = this.map.keys().next().value as string | undefined;
        if (firstKey !== undefined) this.map.delete(firstKey);
      }
    }
    this.map.set(key, Date.now() + ttlMs);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [k, exp] of this.map.entries()) {
      if (exp <= now) this.map.delete(k);
    }
  }
}

export type PathMatcher = {
  match(path: string): boolean;
};

/**
 * 路径白名单匹配：
 * - 精确路径（不含 *）走全等匹配
 * - 以 /* 结尾视为前缀通配：匹配该前缀下所有子路径，并把"父路径自身"也视为命中
 *   (例 "/api/admin/*" 同时匹配 "/api/admin" 与 "/api/admin/login")
 * - 以 * 结尾（无 /）按字面前缀匹配
 */
export function buildPathMatcher(plaintextPaths: string[]): PathMatcher {
  const exact = new Set<string>();
  const prefixes: string[] = [];
  for (const raw of plaintextPaths) {
    const p = raw.trim();
    if (!p) continue;
    if (p.endsWith("/*")) {
      const pre = p.slice(0, -2);
      if (pre.length > 0) {
        exact.add(pre);
        prefixes.push(`${pre}/`);
      }
    } else if (p.endsWith("*")) {
      prefixes.push(p.slice(0, -1));
    } else {
      exact.add(p);
    }
  }
  return {
    match(path: string): boolean {
      if (exact.has(path)) return true;
      for (const pre of prefixes) {
        if (path.startsWith(pre)) return true;
      }
      return false;
    },
  };
}

type EnvelopeBody = {
  isEnc?: unknown;
  encData?: unknown;
};

type RequestPayload = {
  ts?: unknown;
  nonce?: unknown;
  p?: unknown;
};

function isEnvelope(v: unknown): v is { isEnc: boolean; encData: string } {
  if (!v || typeof v !== "object") return false;
  const o = v as EnvelopeBody;
  return o.isEnc === true && typeof o.encData === "string" && o.encData.length > 0;
}

/**
 * 当前生效的白名单匹配器（默认空白名单 = 全部走加密；启动时由 index.ts 装入）。
 * 暴露 setter 供管理端在运行时热替换：admin 修改后调用 setPlaintextPaths 立即生效，
 * 不需要重启服务。
 */
let currentMatcher: PathMatcher = buildPathMatcher([]);
let currentPaths: string[] = [];

export function setPlaintextPaths(paths: string[]): void {
  const cleaned = paths.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim());
  currentPaths = cleaned;
  currentMatcher = buildPathMatcher(cleaned);
}

export function getPlaintextPaths(): string[] {
  return [...currentPaths];
}

/**
 * 端到端加密中间件。挂在 express.json() 之后、业务路由之前。
 * - 命中白名单：直通，响应保持明文。
 * - 非白名单：要求 x-pm-random 头；请求 body 若为信封则解密 + 校验 ts/nonce；
 *   覆写 res.json 把响应整体按新随机密钥加密为 {isEnc, encData}。
 */
export function encryptionMiddleware() {
  const nonceCache = new TtlSet();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (currentMatcher.match(req.path)) {
      next();
      return;
    }

    const fullKeyHeader = req.header(HEADER_RANDOM);
    const fullKey = typeof fullKeyHeader === "string" ? fullKeyHeader.trim() : "";
    if (!fullKey || fullKey.length !== 128) {
      res.status(401).json(fail("missing encryption header", 401));
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD" && isEnvelope(req.body)) {
      let plain: string;
      try {
        plain = decrypt(fullKey, req.body.encData);
      } catch {
        res.status(401).json(fail("decrypt failed", 401));
        return;
      }

      let payload: RequestPayload;
      try {
        payload = JSON.parse(plain) as RequestPayload;
      } catch {
        res.status(401).json(fail("invalid plaintext", 401));
        return;
      }

      const ts = typeof payload.ts === "number" ? payload.ts : Number(payload.ts);
      const nonce = typeof payload.nonce === "string" ? payload.nonce : "";
      if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > TS_WINDOW_MS) {
        res.status(401).json(fail("ts expired", 401));
        return;
      }
      if (!nonce) {
        res.status(401).json(fail("missing nonce", 401));
        return;
      }
      if (nonceCache.has(nonce)) {
        res.status(401).json(fail("replay detected", 401));
        return;
      }
      nonceCache.add(nonce, NONCE_TTL_MS);
      req.body = payload.p ?? {};
    } else if (req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined && req.body !== null) {
      // 非白名单路径下，若 POST 等请求未携带 isEnc 信封，按非法请求拒绝
      const hasBody =
        (typeof req.body === "object" && req.body !== null && Object.keys(req.body as object).length > 0) ||
        typeof req.body === "string";
      if (hasBody) {
        res.status(401).json(fail("encrypted body required", 401));
        return;
      }
    }

    const respKey = randomFullKey();
    const origJson = res.json.bind(res);
    res.json = (payload: unknown) => {
      try {
        res.setHeader(HEADER_RANDOM, respKey);
        res.setHeader(HEADER_VER, ENC_VER);
        const enc = encrypt(respKey, JSON.stringify(payload));
        return origJson({ isEnc: true, encData: enc });
      } catch(e) {
        console.error(e);
        return origJson(payload);
      }
    };

    next();
  };
}
