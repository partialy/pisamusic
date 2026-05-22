import { getRuntimeEndpointsCached, requestSignedGateway } from "../system/systemClient";
import { pathToFileURL } from "url";
import { getUserCookie } from "../cookie/cookieService";
import { requestSignedGatewayWithCookie } from "../cookie/cookieRequest";
import { toSourceQualityParams } from "./quality";
import type {
  DynamicCoverParams,
  MusicLyricParams,
  MusicLyricResult,
  MusicSearchParams,
  MusicSuggestParams,
  MusicUrlParams,
  PlayableTrackPayload,
  PlaylistDetailParams,
  PlaylistSearchParams,
  PlaylistTagsParams,
  PlaylistTracksParams,
  TopPlaylistParams,
  TopSongsParams,
  WyPersonalizedNewSongParams,
  WyPersonalizedPlaylistParams,
} from "./types";

export async function searchMusic(params: MusicSearchParams) {
  const endpoints = await getRuntimeEndpointsCached();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 30;

  switch (params.source) {
    case "kg":
      return requestSignedGateway(
        buildUrl(endpoints.kgServer, "/search", {
          keywords: params.keywords,
          page,
          pagesize: pageSize,
        })
      );
    case "wy":
      return requestSignedGateway(
        buildUrl(endpoints.wyServer, "/cloudsearch", {
          keywords: params.keywords,
          offset: (page - 1) * pageSize,
          limit: pageSize,
          type: 1,
        })
      );
    case "kw":
      return requestSignedGateway(
        buildUrl(endpoints.kwServer, "/search", {
          keywords: params.keywords,
          page,
          pagesize: pageSize,
        })
      );
  }
}

export async function searchSuggest(params: MusicSuggestParams) {
  const endpoints = await getRuntimeEndpointsCached();
  return requestSignedGateway(
    buildUrl(endpoints.wyServer, "/search/suggest", {
      keywords: params.keywords,
    })
  );
}

export async function resolveMusicUrl(params: MusicUrlParams) {
  const endpoints = await getRuntimeEndpointsCached();
  const quality = toSourceQualityParams(params);

  switch (params.source) {
    case "kg":
      return resolveKgMusicUrl(endpoints, params.id, quality.quality);
    case "wy":
      return resolveWyMusicUrl(endpoints, params.id, quality);
    case "kw":
      return requestSignedGateway(
        buildUrl(endpoints.kwProxy, "/song/url", {
          id: params.id,
          quality: quality.quality ?? "standard",
        })
      );
  }
}

export async function searchPlaylists(params: PlaylistSearchParams) {
  const endpoints = await getRuntimeEndpointsCached();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 30;

  switch (params.source) {
    case "kg":
      return requestSignedGateway(
        buildUrl(endpoints.kgServer, "/search", {
          keywords: params.keywords,
          page,
          pagesize: pageSize,
          type: "special",
        })
      );
    case "wy":
      return requestSignedGateway(
        buildUrl(endpoints.wyServer, "/cloudsearch", {
          keywords: params.keywords,
          offset: (page - 1) * pageSize,
          limit: pageSize,
          type: 1000,
        })
      );
  }
}

export async function getKgPlaylistTags() {
  return getPlaylistTags({ source: "kg" });
}

export async function getPlaylistTags(params: PlaylistTagsParams) {
  const endpoints = await getRuntimeEndpointsCached();
  switch (params.source) {
    case "kg":
      return requestSignedGateway(buildUrl(endpoints.kgServer, "/playlist/tags", {}));
    case "wy":
      return requestSignedGateway(buildUrl(endpoints.wyServer, "/playlist/catlist", {}));
  }
}

export async function getTopPlaylists(params: TopPlaylistParams) {
  const endpoints = await getRuntimeEndpointsCached();
  switch (params.source) {
    case "kg":
      return requestSignedGateway(
        buildUrl(endpoints.kgServer, "/top/playlist", {
          category_id: params.categoryId ?? 0,
          withsong: 0,
          withtag: 1,
          page: params.page ?? 1,
          pagesize: params.pageSize,
        })
      );
    case "wy":
      return requestSignedGateway(
        buildUrl(endpoints.wyServer, "/top/playlist", {
          cat: params.cat ?? "全部",
          order: params.order ?? "hot",
          limit: params.pageSize ?? 24,
          offset: ((params.page ?? 1) - 1) * (params.pageSize ?? 24),
        })
      );
  }
}

export async function getTopSongs(_params: TopSongsParams = { source: "kg" }) {
  const endpoints = await getRuntimeEndpointsCached();
  return requestSignedGateway(buildUrl(endpoints.kgServer, "/top/song", {}));
}

export async function getWyPersonalizedPlaylists(params: WyPersonalizedPlaylistParams = {}) {
  const endpoints = await getRuntimeEndpointsCached();
  return requestSignedGateway(
    buildUrl(endpoints.wyServer, "/personalized", {
      limit: params.limit ?? 24,
    })
  );
}

export async function getWyPersonalizedNewSongs(params: WyPersonalizedNewSongParams = {}) {
  const endpoints = await getRuntimeEndpointsCached();
  return requestSignedGateway(
    buildUrl(endpoints.wyServer, "/personalized/newsong", {
      limit: params.limit ?? 12,
    })
  );
}

export async function getKgDailyRecommend(platform?: string) {
  const endpoints = await getRuntimeEndpointsCached();
  return requestSignedGateway(
    buildUrl(endpoints.kgServer, "/everyday/recommend", {
      platform,
    })
  );
}

export async function getHomeRecommendations() {
  const [playlists, songs] = await Promise.all([
    getTopPlaylists({ source: "kg", categoryId: 0 }),
    getKgDailyRecommend(),
  ]);
  return { playlists, songs };
}

export async function getPlaylistDetail(params: PlaylistDetailParams) {
  const endpoints = await getRuntimeEndpointsCached();
  switch (params.source) {
    case "kg":
      return requestSignedGateway(
        buildUrl(endpoints.kgServer, "/playlist/detail", {
          ids: params.id,
        })
      );
    case "wy":
      return requestSignedGateway(
        buildUrl(endpoints.wyServer, "/playlist/detail", {
          id: params.id,
          s: 3,
        })
      );
  }
}

export async function getPlaylistTracks(params: PlaylistTracksParams) {
  const endpoints = await getRuntimeEndpointsCached();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 30;
  const offset = params.offset ?? pageSize * (page - 1);

  switch (params.source) {
    case "kg":
      return requestSignedGateway(
        buildUrl(endpoints.kgServer, "/playlist/track/all", {
          id: params.id,
          page: Math.floor(offset / pageSize) + 1,
          pagesize: pageSize,
        })
      );
    case "wy":
      return requestSignedGateway(
        buildUrl(endpoints.wyServer, "/playlist/track/all", {
          id: params.id,
          limit: pageSize,
          offset,
        })
      );
  }
}

export async function getDynamicCover(params: DynamicCoverParams) {
  const endpoints = await getRuntimeEndpointsCached();
  return requestSignedGateway(
    buildUrl(endpoints.wyServer, "/song/dynamic/cover", {
      id: params.id,
    })
  );
}

export async function resolvePlayableUrl(track: PlayableTrackPayload) {
  if (track.source === "local") {
    const filePath = track.filePath || track.urlParam || track.id || "";
    return filePath ? pathToFileURL(filePath).toString() : "";
  }

  const id = track.urlParam || track.id;
  if (!id) return "";

  const response: any = await resolveMusicUrl({
    source: track.source,
    id,
    qualityKey: track.qualityKey,
    quality: track.quality,
    br: track.br,
    level: track.level,
  });

  switch (track.source) {
    case "kg":
      return firstString(response?.url) || firstString(response?.backupUrl) || "";
    case "wy":
      return firstString(response?.data?.map((item: { url?: string }) => item.url)) || "";
    case "kw":
      return typeof response?.url === "string" ? response.url : "";
  }
}

async function resolveKgMusicUrl(
  endpoints: Awaited<ReturnType<typeof getRuntimeEndpointsCached>>,
  id: string,
  quality = "128"
) {
  const cookie = getUserCookie("kg");
  const serviceUrl = buildUrl(endpoints.kgServer, "/song/url", {
    hash: id,
    quality,
  });
  if (cookie) {
    try {
      return (await requestSignedGatewayWithCookie(serviceUrl, { cookie })).data;
    } catch {
      // 高品质 Cookie 取链失败时沿用普通取链兜底，避免播放被打断。
    }
  }
  return requestSignedGateway(
    buildUrl(endpoints.kgProxy, "/song/url", {
      hash: id,
      quality,
    })
  );
}

async function resolveWyMusicUrl(
  endpoints: Awaited<ReturnType<typeof getRuntimeEndpointsCached>>,
  id: string,
  quality: { br?: number; level?: string }
) {
  const cookie = getUserCookie("wy");
  const endpoint = quality.level ? "/song/url/v1" : "/song/url";
  const params = quality.level
    ? { id, level: quality.level, realIP: "116.25.146.177" }
    : { id, br: quality.br ?? 128000, realIP: "116.25.146.177" };
  const serviceUrl = buildUrl(endpoints.wyServer, endpoint, params);
  if (cookie) {
    try {
      return (await requestSignedGatewayWithCookie(serviceUrl, { cookie })).data;
    } catch {
      // Cookie 取链失败后回退到普通代理，保留原有播放能力。
    }
  }
  return requestSignedGateway(buildUrl(endpoints.wyProxy, endpoint, params));
}

export async function fetchLyrics(params: MusicLyricParams): Promise<MusicLyricResult> {
  switch (params.source) {
    case "kg":
      return fetchKgLyrics(params.hash || params.id || "");
    case "wy":
      return fetchWyLyrics(params.id || params.hash || "");
    case "kw":
      return emptyLyrics();
  }
}

async function fetchKgLyrics(hash: string): Promise<MusicLyricResult> {
  if (!hash) return emptyLyrics();
  const endpoints = await getRuntimeEndpointsCached();
  const searchResult: any = await requestSignedGateway(
    buildUrl(endpoints.kgServer, "/search/lyric", { hash })
  );
  const candidate = searchResult?.candidates?.[0];
  if (!candidate?.id || !candidate?.accesskey) {
    return emptyLyrics();
  }

  const [krcResult, lrcResult]: any[] = await Promise.all([
    requestSignedGateway(
      buildUrl(endpoints.kgServer, "/lyric", {
        id: candidate.id,
        accesskey: candidate.accesskey,
        decode: "true",
        fmt: "krc",
      })
    ),
    requestSignedGateway(
      buildUrl(endpoints.kgServer, "/lyric", {
        id: candidate.id,
        accesskey: candidate.accesskey,
        decode: "true",
        fmt: "lrc",
      })
    ),
  ]);

  return {
    krc: krcResult?.decodeContent || "",
    lrc: lrcResult?.decodeContent || "",
  };
}

async function fetchWyLyrics(id: string): Promise<MusicLyricResult> {
  if (!id) return emptyLyrics();
  const endpoints = await getRuntimeEndpointsCached();
  const lyricResult: any = await requestSignedGateway(buildUrl(endpoints.wyServer, "/lyric/new", { id }));

  return {
    krc: lyricResult?.yrc?.lyric || "",
    lrc: lyricResult?.lrc?.lyric || "",
  };
}

function buildUrl(baseUrl: string, path: string, params: Record<string, string | number | undefined>) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(path.replace(/^\//, ""), normalizedBase);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function firstString(values: unknown) {
  if (!Array.isArray(values)) return "";
  const value = values.find((item) => typeof item === "string" && item.length > 0);
  return typeof value === "string" ? value : "";
}

function emptyLyrics(): MusicLyricResult {
  return { krc: "", lrc: "" };
}
