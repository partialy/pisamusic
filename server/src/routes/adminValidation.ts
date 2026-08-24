export type UrlValidationResult =
  | { ok: true; value: string }
  | { ok: false; msg: string };

export function normalizeDesktopUpdateFeedUrl(value: string): UrlValidationResult {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, msg: "自动更新地址必须是有效 URL" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, msg: "自动更新地址必须使用 HTTPS" };
  }
  if (url.username || url.password || url.search || url.hash) {
    return { ok: false, msg: "自动更新地址不能包含认证信息、查询参数或 hash" };
  }
  return { ok: true, value: url.toString().replace(/\/+$/, "") };
}
