export type PlaylistShareLink = { source: "kg" | "wy"; id: string };

const urls = /https?:\/\/[^\s<>"“”《》]+/gi;
const trailingPunctuation = /[。，、；;！!？?）)\]}」』., ”]+$/u;
const kgPath = /^\/songlist\/gcid_([0-9a-y]+)z([0-9a-y]+)z([0-9a-y]+)z([0-9a-y]{3})\/?$/;
const maxId = 9223372036854775807n;

function base35(value: string): bigint | null {
  let result = 0n;
  for (const digit of value) {
    result = result * 35n + BigInt(parseInt(digit, 35));
    if (result > maxId) return null;
  }
  return result;
}

/** 只还原白名单公开链接身份，不跟随短链，也不把 src_cid 当作分享副本。 */
export function parsePlaylistShareLink(text: string): PlaylistShareLink | null {
  const normalized = text.replace(/\\:/g, ":").replace(/\\\//g, "/").replace(/&amp;/g, "&");
  for (const match of normalized.matchAll(urls)) {
    try {
      const url = new URL(match[0].replace(trailingPunctuation, ""));
      if (url.username || url.password) continue;
      const host = url.hostname.toLowerCase();
      const path = decodeURIComponent(url.pathname);
      if (["kugou.com", "www.kugou.com", "m.kugou.com"].includes(host)) {
        const fields = kgPath.exec(path);
        if (!fields) continue;
        const values = [fields[1], fields[2], fields[3], fields[4][0]].map(base35);
        if (values.some((value) => value === null) || values.slice(0, 3).some((value) => value! <= 0n)) continue;
        return { source: "kg", id: `collection_${values.join("_")}` };
      }
      if (host !== "music.163.com") continue;
      if ((path === "/" || !path) && url.hash && !/^\/(?:m\/)?playlist(?:[/?]|$)/.test(url.hash.slice(1))) continue;
      const playlistUrl = (path === "/" || !path) && url.hash ? new URL(url.hash.slice(1), url.origin) : url;
      if (!["/playlist", "/m/playlist"].includes(decodeURIComponent(playlistUrl.pathname).replace(/\/$/, ""))) continue;
      const id = playlistUrl.searchParams.get("id");
      if (!id || !/^\d+$/.test(id)) continue;
      const numericId = BigInt(id);
      if (numericId <= 0n || numericId > maxId) continue;
      return { source: "wy", id: numericId.toString() };
    } catch {
      // 单个候选格式错误时继续检查文案中的其他公开链接。
    }
  }
  return null;
}
