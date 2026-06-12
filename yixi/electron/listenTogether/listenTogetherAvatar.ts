import { getSystemBaseUrl } from "../system/systemClient";

const DEFAULT_ACCOUNT_AVATAR_PATH = "/static/account-avatars/default.jpg";

function resolveAvatarUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const target = raw || DEFAULT_ACCOUNT_AVATAR_PATH;
  if (/^(https?:|data:|blob:)/i.test(target)) return target;
  try {
    return new URL(target, getSystemBaseUrl()).toString();
  } catch {
    return new URL(DEFAULT_ACCOUNT_AVATAR_PATH, getSystemBaseUrl()).toString();
  }
}

/**
 * 一起听成员的默认头像是服务端相对路径。进入 renderer 前统一转为绝对地址，
 * 同时把空头像补成服务端真实默认头像，避免 UI 回退为姓名文字。
 */
export function normalizeListenTogetherAvatars<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeListenTogetherAvatars(item)) as T;
  }
  if (typeof value !== "object" || value === null) return value;

  const normalized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    normalized[key] =
      key === "avatarUrl"
        ? resolveAvatarUrl(item)
        : normalizeListenTogetherAvatars(item);
  }
  return normalized as T;
}
