import { readAppConfig } from "../db/configStore";
import { signGatewayUrl } from "./gatewaySigner";

export type WebMusicSource = "wy" | "kg" | "kw";

export type WebSong = {
  id: string;
  name: string;
  singer: string;
  album: string;
  duration: number;
  cover: string;
  source: WebMusicSource;
};

export type WebSearchResponse = {
  songs: WebSong[];
  total: number;
  hasMore: boolean;
};

const DEFAULT_GATEWAY_SIGN = {
  secret: "partialypartialypartialypartialy",
  as: "yixivip",
};

function endpoint(endpoints: Record<string, string>, key: string, fallback: string): string {
  const value = endpoints[key]?.trim();
  if (!value) return fallback;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function getRuntimeEndpoints() {
  const cfg = (await readAppConfig());
  const endpoints = cfg.bootstrap.endpoints ?? {};
  const proxyBase = endpoint(endpoints, "proxyBaseUrl", "http://127.0.0.1:38888");

  return {
    kgServer: endpoint(endpoints, "kgBaseUrl", "http://127.0.0.1:31000"),
    wyServer: endpoint(endpoints, "wyBaseUrl", "http://127.0.0.1:31001"),
    kwServer: endpoint(endpoints, "kwBaseUrl", "http://127.0.0.1:31002"),
    kgProxy: endpoint(endpoints, "kgProxyUrl", `${proxyBase}/proxy/kg`),
    wyProxy: endpoint(endpoints, "wyProxyUrl", `${proxyBase}/proxy/wy`),
    kwProxy: endpoint(endpoints, "kwProxyUrl", `${proxyBase}/proxy/kw`),
  };
}

async function getSignConfig() {
  const cfg = (await readAppConfig());
  return cfg.bootstrap.gatewaySign ?? DEFAULT_GATEWAY_SIGN;
}

async function requestSignedGateway<T>(rawUrl: string, method = "GET", body?: unknown): Promise<T> {
  const signConfig = (await getSignConfig());
  const bodyStr = body !== undefined ? JSON.stringify(body) : "";
  const signed = signGatewayUrl(method, rawUrl, bodyStr, signConfig);

  const response = await fetch(signed.url, {
    method,
    headers: {
      ...signed.headers,
      ...(bodyStr ? { "content-type": "application/json" } : {}),
    },
    body: bodyStr || undefined,
  });

  if (!response.ok) {
    throw new Error(`Gateway returned status ${response.status} ${response.statusText}`);
  }

  const raw = await response.text();
  if (!raw) return null as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

function fixKgCover(rawCover: unknown): string {
  if (typeof rawCover !== "string" || !rawCover) return "";
  return rawCover.replace(/\{size\}/g, "400").replace(/http:\/\//g, "https://");
}

function fixWyCover(rawCover: unknown): string {
  if (typeof rawCover !== "string" || !rawCover) return "";
  const url = rawCover.replace(/http:\/\//g, "https://");
  return url.includes("?") ? url : `${url}?param=300y300`;
}

export async function searchWebMusic(
  source: WebMusicSource,
  keywords: string
): Promise<WebSearchResponse> {
  const trimmed = keywords.trim();
  if (!trimmed) {
    return { songs: [], total: 0, hasMore: false };
  }

  const endpoints = (await getRuntimeEndpoints());
  let rawSongs: any[] = [];
  let total = 0;

  if (source === "wy") {
    const url = `${endpoints.wyServer}/cloudsearch?keywords=${encodeURIComponent(
      trimmed
    )}&offset=0&limit=10&type=1`;
    const res: any = await requestSignedGateway(url);
    rawSongs = res?.result?.songs ?? [];
    total = res?.result?.songCount ?? rawSongs.length;

    const songs: WebSong[] = rawSongs.slice(0, 10).map((s) => ({
      id: String(s.id),
      name: s.name || "未知歌曲",
      singer: (s.ar || s.artists || []).map((a: any) => a.name).join("、") || "未知歌手",
      album: s.al?.name || s.album?.name || "",
      duration: s.dt || s.duration || 0,
      cover: fixWyCover(s.al?.picUrl || s.album?.picUrl),
      source: "wy",
    }));

    return { songs, total, hasMore: total > 10 };
  }

  if (source === "kg") {
    const url = `${endpoints.kgServer}/search?keywords=${encodeURIComponent(
      trimmed
    )}&page=1&pagesize=10`;
    const res: any = await requestSignedGateway(url);
    rawSongs = res?.data?.lists || res?.data?.songs || [];
    total = res?.data?.total || rawSongs.length;

    const songs: WebSong[] = rawSongs.slice(0, 10).map((s) => {
      const singers = Array.isArray(s.singerinfo)
        ? s.singerinfo.map((i: any) => i.name).join("、")
        : s.SingerName || s.singername || "";
      const dur = Number(s.Duration || s.time_length || 0);
      const durationMs = dur > 6000 ? dur : dur * 1000;

      return {
        id: s.FileHash || s.SQ?.Hash || s.HQ?.Hash || s.hash || "",
        name: s.OriSongName || s.SongName || s.songname || s.FileName || "未知歌曲",
        singer: singers || "未知歌手",
        album: s.AlbumName || s.album_name || "",
        duration: durationMs,
        cover: fixKgCover(
          s.Image || s.sizable_cover || s.flexible_cover || s.album_sizable_cover || s.cover
        ),
        source: "kg",
      };
    });

    return { songs, total, hasMore: total > 10 };
  }

  if (source === "kw") {
    const url = `${endpoints.kwServer}/search?keywords=${encodeURIComponent(
      trimmed
    )}&page=1&pagesize=10`;
    const res: any = await requestSignedGateway(url);
    rawSongs = res?.data || [];
    total = 100;

    const songs: WebSong[] = rawSongs.slice(0, 10).map((s) => {
      const dur = Number(s.duration || 0);
      return {
        id: String(s.id),
        name: s.name || "未知歌曲",
        singer: s.artist || "未知歌手",
        album: s.album || "",
        duration: dur > 6000 ? dur : dur * 1000,
        cover: fixKgCover(s.pic || s.pic120 || s.img || ""),
        source: "kw",
      };
    });

    return { songs, total, hasMore: total > 10 };
  }

  return { songs: [], total: 0, hasMore: false };
}

export async function getWebRecommendations(source: WebMusicSource): Promise<{ songs: WebSong[] }> {
  const endpoints = (await getRuntimeEndpoints());

  try {
    if (source === "wy") {
      const url = `${endpoints.wyServer}/personalized/newsong?limit=12`;
      const res: any = await requestSignedGateway(url);
      const list: any[] = res?.result || [];
      const songs: WebSong[] = list.slice(0, 12).map((item) => {
        const s = item.song || {};
        return {
          id: String(item.id),
          name: item.name || "未知歌曲",
          singer: (s.artists || []).map((a: any) => a.name).join("、") || "未知歌手",
          album: s.album?.name || "",
          duration: s.duration || 0,
          cover: fixWyCover(item.picUrl || s.album?.picUrl),
          source: "wy",
        };
      });
      if (songs.length > 0) return { songs };
    }

    if (source === "kg") {
      const url = `${endpoints.kgServer}/top/song`;
      const res: any = await requestSignedGateway(url);
      const list: any[] = res?.data || [];
      const songs: WebSong[] = list.slice(0, 12).map((s) => {
        const singers = Array.isArray(s.singerinfo)
          ? s.singerinfo.map((i: any) => i.name).join("、")
          : s.author_name || s.singername || "";
        const dur = Number(s.time_length || s.duration || 0);
        return {
          id: s.hash || s.hash_128 || s.audio_id || "",
          name: s.songname || s.audio_name || "未知歌曲",
          singer: singers || "未知歌手",
          album: s.album_name || "",
          duration: dur > 6000 ? dur : dur * 1000,
          cover: fixKgCover(s.sizable_cover || s.flexible_cover || s.cover),
          source: "kg",
        };
      });
      if (songs.length > 0) return { songs };
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[webMusic] getWebRecommendations failed for ${source}:`, err);
  }

  // Fallback: search hot songs for that source
  const fallback = await searchWebMusic(source, source === "wy" ? "热歌" : source === "kg" ? "经典" : "周杰伦");
  return { songs: fallback.songs };
}

export async function getWebSongUrl(
  source: WebMusicSource,
  id: string
): Promise<{ url: string }> {
  if (!id) return { url: "" };
  const endpoints = (await getRuntimeEndpoints());

  if (source === "wy") {
    // 取链统一走 proxy-service，避免落到 wy-service 的非代理端点。
    const proxyUrl = `${endpoints.wyProxy}/song/url?id=${encodeURIComponent(id)}&br=128000`;
    try {
      const res: any = await requestSignedGateway(proxyUrl);
      const direct = res?.data?.[0]?.url;
      if (direct) return { url: direct.replace(/http:\/\//g, "https://") };
    } catch {
      // 保持网页试听接口的空链接语义，由调用方展示不可播放提示。
    }
    return { url: "" };
  }

  if (source === "kg") {
    // Lowest quality: 128
    const proxyUrl = `${endpoints.kgProxy}/song/url?hash=${encodeURIComponent(id)}&quality=128`;
    try {
      const res: any = await requestSignedGateway(proxyUrl);
      const direct = res?.url || res?.backupUrl || res?.data?.url;
      if (typeof direct === "string" && direct) {
        return { url: direct.replace(/http:\/\//g, "https://") };
      }
      if (Array.isArray(direct) && direct[0]) {
        return { url: direct[0].replace(/http:\/\//g, "https://") };
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[webMusic] kg resolveUrl failed:`, err);
    }
    return { url: "" };
  }

  if (source === "kw") {
    // Lowest quality: standard
    const proxyUrl = `${endpoints.kwProxy}/song/url?id=${encodeURIComponent(id)}&quality=standard`;
    try {
      const res: any = await requestSignedGateway(proxyUrl);
      const direct = typeof res?.url === "string" ? res.url : res?.data?.url;
      if (direct) return { url: direct.replace(/http:\/\//g, "https://") };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[webMusic] kw resolveUrl failed:`, err);
    }
    return { url: "" };
  }

  return { url: "" };
}

export async function getWebSongLyric(
  source: WebMusicSource,
  id: string
): Promise<{ lrc: string }> {
  if (!id) return { lrc: "" };
  const endpoints = (await getRuntimeEndpoints());

  if (source === "wy") {
    try {
      const url = `${endpoints.wyServer}/lyric/new?id=${encodeURIComponent(id)}`;
      const res: any = await requestSignedGateway(url);
      const lrc = res?.lrc?.lyric || "";
      return { lrc };
    } catch {
      return { lrc: "" };
    }
  }

  if (source === "kg") {
    try {
      const searchUrl = `${endpoints.kgServer}/search/lyric?hash=${encodeURIComponent(id)}`;
      const searchResult: any = await requestSignedGateway(searchUrl);
      const candidate = searchResult?.candidates?.[0];
      if (!candidate?.id || !candidate?.accesskey) {
        return { lrc: "" };
      }
      const lyricUrl = `${endpoints.kgServer}/lyric?id=${candidate.id}&accesskey=${candidate.accesskey}&decode=true&fmt=lrc`;
      const res: any = await requestSignedGateway(lyricUrl);
      return { lrc: res?.decodeContent || "" };
    } catch {
      return { lrc: "" };
    }
  }

  return { lrc: "" };
}
