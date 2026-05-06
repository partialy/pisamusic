import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { fail } from "../types/response";

export function getAdminJwtSecret(): string {
  return process.env.ADMIN_JWT_SECRET ?? "pisa-admin-dev-secret-change-in-production";
}

export function requireAdminJwt(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json(fail("需要登录", 401));
    return;
  }
  const raw = auth.slice(7).trim();
  if (!raw) {
    res.status(401).json(fail("需要登录", 401));
    return;
  }
  try {
    jwt.verify(raw, getAdminJwtSecret());
    next();
  } catch {
    res.status(401).json(fail("登录已失效，请重新登录", 401));
  }
}
