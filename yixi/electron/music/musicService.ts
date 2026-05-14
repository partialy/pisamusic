import { getRuntimeEndpointsCached, requestSignedGateway } from "../system/systemClient";
import { pathToFileURL } from "url";
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
  PlaylistTracksParams,
  TopPlaylistParams,
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

  switch (params.source) {
    case "kg":
      return requestSignedGateway(
        buildUrl(endpoints.kgProxy, "/song/url", {
          hash: params.id,
          quality: params.quality ?? "128",
        })
      );
    case "wy":
      return requestSignedGateway(
        buildUrl(endpoints.wyProxy, "/song/url", {
          id: params.id,
          br: params.br ?? 128000,
          realIP: "116.25.146.177",
        })
      );
    case "kw":
      return requestSignedGateway(
        buildUrl(endpoints.kwProxy, "/song/url", {
          id: params.id,
          quality: params.quality ?? "standard",
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
  const endpoints = await getRuntimeEndpointsCached();
  return requestSignedGateway(buildUrl(endpoints.kgServer, "/playlist/tags", {}));
}

export async function getTopPlaylists(params: TopPlaylistParams) {
  const endpoints = await getRuntimeEndpointsCached();
  return requestSignedGateway(
    buildUrl(endpoints.kgServer, "/top/playlist", {
      category_id: params.categoryId ?? 0,
      withsong: 0,
      withtag: 1,
      page: params.page ?? 1,
      pagesize: params.pageSize,
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
    quality: track.quality,
    br: track.br,
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
