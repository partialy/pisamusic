import { getRuntimeEndpointsFresh, requestSignedGateway } from "../system/systemClient";
import type {
  MusicLyricParams,
  MusicLyricResult,
  MusicSearchParams,
  MusicUrlParams,
  PlayableTrackPayload,
} from "./types";

export async function searchMusic(params: MusicSearchParams) {
  const endpoints = await getRuntimeEndpointsFresh();
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

export async function resolveMusicUrl(params: MusicUrlParams) {
  const endpoints = await getRuntimeEndpointsFresh();

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

export async function resolvePlayableUrl(track: PlayableTrackPayload) {
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
  const endpoints = await getRuntimeEndpointsFresh();
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
  const endpoints = await getRuntimeEndpointsFresh();
  const [krcResult, lrcResult]: any[] = await Promise.all([
    requestSignedGateway(buildUrl(endpoints.wyServer, "/lyric/new", { id })),
    requestSignedGateway(buildUrl(endpoints.wyServer, "/lyric", { id })),
  ]);

  return {
    krc: krcResult?.yrc?.lyric || "",
    lrc: lrcResult?.lrc?.lyric || "",
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
