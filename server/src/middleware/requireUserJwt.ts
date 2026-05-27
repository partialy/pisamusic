import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { readUserById, type PublicUser, toPublicUser } from "../db/userStore";
import { fail } from "../types/response";

export type UserJwtPayload = jwt.JwtPayload & {
  sub: string;
};

export type UserAuthedRequest = Request & {
  userAuth?: {
    userId: string;
    user: PublicUser;
  };
};

export function getUserJwtSecret(): string {
  return process.env.USER_JWT_SECRET ?? process.env.ADMIN_JWT_SECRET ?? "pisa-user-dev-secret-change-in-production";
}

export function tokenFromRequest(req: Request): string {
  const raw = req.header("authorization") ?? "";
  if (!raw.startsWith("Bearer ")) return "";
  return raw.slice("Bearer ".length).trim();
}

export function verifyUserToken(rawToken: string): PublicUser | null {
  if (!rawToken) return null;
  try {
    const payload = jwt.verify(rawToken, getUserJwtSecret()) as UserJwtPayload;
    if (!payload.sub) return null;
    const user = readUserById(payload.sub);
    return user ? toPublicUser(user) : null;
  } catch {
    return null;
  }
}

export function requireUserJwt(req: UserAuthedRequest, res: Response, next: NextFunction): void {
  const user = verifyUserToken(tokenFromRequest(req));
  if (!user) {
    res.status(401).json(fail("账号登录已失效，请重新登录", 401));
    return;
  }
  req.userAuth = { userId: user.id, user };
  next();
}

export function getUserAuth(req: UserAuthedRequest) {
  if (!req.userAuth) throw new Error("缺少账号身份");
  return req.userAuth;
}
