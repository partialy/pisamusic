import type { Request } from "express";

export function getClientIp(req: Request): string {
  // 优先取 Express 处理 trust proxy 后的 req.ip
  const rawIp = req.ip || req.socket?.remoteAddress || "";
  return normalizeIp(rawIp);
}

export function normalizeIp(ip: string): string {
  if (!ip || typeof ip !== "string") return "unknown";
  let cleaned = ip.trim();
  // 处理 ::ffff:192.168.1.1 这种 IPv4-mapped IPv6
  if (cleaned.startsWith("::ffff:")) {
    cleaned = cleaned.substring(7);
  }
  if (cleaned === "::1") {
    return "127.0.0.1";
  }
  return cleaned || "unknown";
}
