import type { Request } from "express";
import { isIP } from "node:net";

/** 只读取入口保留的 Host，不信任 X-Forwarded-Host 或客户端 body。 */
export function normalizeWebsiteDomain(value: unknown): string {
  if (typeof value !== "string" || !value || /[\s/@?#\\,]/.test(value)) return "";
  let host = value.toLowerCase();
  if (host.startsWith("[")) {
    const match = /^\[([^\]]+)\](?::([0-9]{1,5}))?$/.exec(host);
    if (!match || isIP(match[1]!) !== 6 || (match[2] && Number(match[2]) > 65535)) return "";
    return `[${match[1]}]`;
  }
  const match = /^([^:]+)(?::([0-9]{1,5}))?$/.exec(host);
  if (!match || (match[2] && Number(match[2]) > 65535)) return "";
  host = match[1]!.replace(/\.$/, "");
  if (host.length > 253 || !host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return "";
  return host;
}

export function getWebsiteDomain(req: Request): string {
  return normalizeWebsiteDomain(req.headers.host);
}

export function normalizeWebsitePath(value: string): string {
  const path = value.split(/[?#]/, 1)[0] || "/";
  // 只保存公开页面类别，不保留动态短码、邀请参数等归因数据。
  const entry = /^\/(listen|scan|download|app-share|agreement)(?:\/|$)/.exec(path);
  return entry ? `/${entry[1]}/` : "/";
}

export function sanitizeWebsiteReferrer(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    const path = /^\/(scan|app-share|download)(?:\/|$)/.test(url.pathname)
      ? normalizeWebsitePath(url.pathname) : url.pathname;
    return `${url.origin}${path}`.slice(0, 512);
  } catch { return ""; }
}
