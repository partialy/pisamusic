import type { BootstrapConfigData } from "@shared/system";
import type { LyricRequest, LyricResult, PlayUrlResult, ResolveUrlRequest, SearchRequest, SourceGroupedResult, TrackSearchResult } from "@shared/music";
import { MUSIC_SOURCE_LABEL } from "@shared/music";
import { fetchJson } from "@main/utils/http";
import { signGatewayUrl } from "@main/utils/gatewaySigner";
import { buildUrl, isValidHttpUrl } from "@main/utils/normalize";
import { ensureBootstrapConfig } from "./systemService";

type KgRegisterResponse = { data?: { dfid?: string } };
type KgSearchResponse = { data?: { lists?: KgSearchItem[] } };
type KgSearchItem = {
  FileHash?: string;
  SongName?: string;
  SingerName?: string;
  Image?: string;
  HQFileHash?: string;
  SQFileHash?: string;
  Duration?: number;
  songname_suffix?: string;
};
type KgSongUrlResponse = {
  data?: { url?: string[]; backupUrl?: string[] };
  url?: string[];
  backupUrl?: string[];
  extName?: string;
  fail_process?: string[];
};
type KgLyricSearchResponse = { candidates?: { id: string; accesskey: string }[] };
type KgLyricResponse = { decodeContent?: string };

type WySearchResponse = { result?: { songs?: WySong[] } };
type WySong = { id?: number; name?: string; ar?: { name?: string }[]; al?: { name?: string; picUrl?: string } };
type WyUrlResponse = { data?: { url?: string | null; br?: number }[] };
type WyLyricResponse = { lrc?: { lyric?: string } };

type KwSearchResponse = { data?: KwSearchItem[] };
type KwSearchItem = {
  id?: number;
  name?: string;
  artist?: string;
  album?: string;
  duration?: number;
  quality?: { lossless?: { size?: string }; exhigh?: { size?: string }; standard?: { size?: string } };
};
type KwUrlResponse = { url?: string; quality?: string };

let kgDfid: string | null = null;

export async function searchMusic(request: SearchRequest): Promise<SourceGroupedResult> {
  const keyword = request.keyword.trim();
  if (!keyword) {
    return emptyGroupedResult();
  }
  const config = await ensureBootstrapConfig();
  const sources = request.sources ?? ["kg", "wy", "kw"];
  const tasks = await Promise.allSettled(
    sources.map(async (source) => {
      if (source === "kg") return ["kg", await searchKg(config, keyword, request.page, request.pageSize)] as const;
      if (source === "wy") return ["wy", await searchWy(config, keyword, request.page, request.pageSize)] as const;
      return ["kw", await searchKw(config, keyword, request.page)] as const;
    }),
  );
  const grouped = emptyGroupedResult();
  tasks.forEach((task) => {
    if (task.status === "fulfilled") {
      const [source, list] = task.value;
      grouped[source] = list;
    }
  });
  return grouped;
}

export async function resolvePlayUrl(request: ResolveUrlRequest): Promise<PlayUrlResult> {
  const config = await ensureBootstrapConfig();
  const track = request.track;
  if (track.source === "kg") return resolveKgUrl(config, track);
  if (track.source === "wy") return resolveWyUrl(config, track);
  return resolveKwUrl(config, track);
}

export async function getLyric(request: LyricRequest): Promise<LyricResult> {
  const config = await ensureBootstrapConfig();
  const track = request.track;
  let text = "";
  try {
    if (track.source === "kg") text = await getKgLyric(config, track);
    if (track.source === "wy") text = await getWyLyric(config, track);
  } catch {
    text = "";
  }
  return { trackId: track.id, source: track.source, text };
}

function emptyGroupedResult(): SourceGroupedResult {
  return { kg: [], wy: [], kw: [] };
}

async function signedGet<T>(config: BootstrapConfigData, url: string): Promise<T> {
  const signed = signGatewayUrl(url, config.gatewaySign);
  return fetchJson<T>(signed.url, { headers: signed.headers });
}

async function ensureKgDfid(config: BootstrapConfigData): Promise<string | null> {
  if (kgDfid) return kgDfid;
  try {
    const response = await signedGet<KgRegisterResponse>(config, buildUrl(config.endpoints.kgBaseUrl, "register/dev"));
    kgDfid = response.data?.dfid ?? null;
  } catch {
    kgDfid = null;
  }
  return kgDfid;
}

async function searchKg(config: BootstrapConfigData, keyword: string, page = 1, pageSize = 20): Promise<TrackSearchResult[]> {
  const dfid = await ensureKgDfid(config);
  const url = buildUrl(config.endpoints.kgBaseUrl, "search", {
    keywords: keyword,
    page,
    pagesize: pageSize,
    ...(dfid ? { dfid } : {}),
  });
  const response = await signedGet<KgSearchResponse>(config, url);
  return response.data?.lists?.map(mapKgTrack).filter(Boolean) ?? [];
}

function mapKgTrack(item: KgSearchItem): TrackSearchResult {
  const id = item.SQFileHash || item.HQFileHash || item.FileHash || "";
  const suffix = item.songname_suffix?.trim() ?? "";
  return {
    id,
    source: "kg",
    sourceName: MUSIC_SOURCE_LABEL.kg,
    title: `${item.SongName ?? ""}${suffix}`.trim() || "未知歌曲",
    artist: item.SingerName || "未知歌手",
    coverUrl: item.Image?.replace("{size}", "240") ?? "",
    duration: item.Duration ?? 0,
    quality: item.SQFileHash ? "SQ" : item.HQFileHash ? "HQ" : "STD",
    raw: item,
  };
}

async function searchWy(config: BootstrapConfigData, keyword: string, page = 1, pageSize = 20): Promise<TrackSearchResult[]> {
  const offset = (Math.max(page, 1) - 1) * pageSize;
  const url = buildUrl(config.endpoints.wyBaseUrl, "cloudSearch", {
    keywords: keyword,
    limit: pageSize,
    offset,
  });
  const response = await signedGet<WySearchResponse>(config, url);
  return response.result?.songs?.map(mapWyTrack).filter(Boolean) ?? [];
}

function mapWyTrack(item: WySong): TrackSearchResult {
  return {
    id: String(item.id ?? ""),
    source: "wy",
    sourceName: MUSIC_SOURCE_LABEL.wy,
    title: item.name || "未知歌曲",
    artist: item.ar?.map((artist) => artist.name).filter(Boolean).join(" / ") || "未知歌手",
    album: item.al?.name,
    coverUrl: item.al?.picUrl,
    duration: 0,
    quality: "standard",
    raw: item,
  };
}

async function searchKw(config: BootstrapConfigData, keyword: string, page = 1): Promise<TrackSearchResult[]> {
  const url = buildUrl(config.endpoints.kwBaseUrl, "search", { keywords: keyword, page });
  const response = await signedGet<KwSearchResponse>(config, url);
  return response.data?.map(mapKwTrack).filter(Boolean) ?? [];
}

function mapKwTrack(item: KwSearchItem): TrackSearchResult {
  const quality = item.quality?.lossless ? "lossless" : item.quality?.exhigh ? "exhigh" : "standard";
  return {
    id: String(item.id ?? ""),
    source: "kw",
    sourceName: MUSIC_SOURCE_LABEL.kw,
    title: item.name || "未知歌曲",
    artist: item.artist || "未知歌手",
    album: item.album,
    duration: item.duration ?? 0,
    quality,
    raw: item,
  };
}

async function resolveKgUrl(config: BootstrapConfigData, track: TrackSearchResult): Promise<PlayUrlResult> {
  for (const quality of ["320", "128"]) {
    const url = new URL(config.endpoints.kgSongUrl);
    url.searchParams.set("hash", track.id);
    url.searchParams.set("quality", quality);
    const response = await signedGet<KgSongUrlResponse>(config, url.toString());
    if (response.fail_process?.includes("buy")) continue;
    const stream = pickKgStream(response);
    if (isValidHttpUrl(stream)) return { url: stream, quality, ext: response.extName ?? "mp3" };
  }
  throw new Error("KG 播放地址解析失败");
}

function pickKgStream(response: KgSongUrlResponse): string | undefined {
  return response.data?.url?.find(Boolean)
    ?? response.data?.backupUrl?.find(Boolean)
    ?? response.url?.find(Boolean)
    ?? response.backupUrl?.find(Boolean);
}

async function resolveWyUrl(config: BootstrapConfigData, track: TrackSearchResult): Promise<PlayUrlResult> {
  for (const level of ["jymaster", "hires", "lossless", "exhigh", "standard"]) {
    const url = new URL(config.endpoints.wySongUrlV1);
    url.searchParams.set("id", track.id);
    url.searchParams.set("level", level);
    const response = await signedGet<WyUrlResponse>(config, url.toString());
    const stream = response.data?.map((item) => item.url).find(isValidHttpUrl);
    if (stream) return { url: stream, quality: level, ext: level === "standard" ? "mp3" : "flac" };
  }
  for (const br of [320000, 128000]) {
    const url = new URL(config.endpoints.wySongUrl);
    url.searchParams.set("id", track.id);
    url.searchParams.set("br", String(br));
    const response = await signedGet<WyUrlResponse>(config, url.toString());
    const stream = response.data?.map((item) => item.url).find(isValidHttpUrl);
    if (stream) return { url: stream, quality: String(br), ext: "mp3" };
  }
  throw new Error("WY 播放地址解析失败");
}

async function resolveKwUrl(config: BootstrapConfigData, track: TrackSearchResult): Promise<PlayUrlResult> {
  for (const quality of ["exhigh", "standard"]) {
    const url = buildUrl(config.endpoints.kwBaseUrl, "url", { id: track.id, quality });
    const response = await signedGet<KwUrlResponse>(config, url);
    if (isValidHttpUrl(response.url)) return { url: response.url, quality: response.quality ?? quality, ext: "mp3" };
  }
  throw new Error("KW 播放地址解析失败");
}

async function getKgLyric(config: BootstrapConfigData, track: TrackSearchResult): Promise<string> {
  const search = await signedGet<KgLyricSearchResponse>(
    config,
    buildUrl(config.endpoints.kgBaseUrl, "search/lyric", { hash: track.id }),
  );
  const candidate = search.candidates?.[0];
  if (!candidate) return "";
  const lyric = await signedGet<KgLyricResponse>(
    config,
    buildUrl(config.endpoints.kgBaseUrl, "lyric", {
      id: candidate.id,
      accesskey: candidate.accesskey,
      fmt: "lrc",
      decode: true,
    }),
  );
  return lyric.decodeContent ?? "";
}

async function getWyLyric(config: BootstrapConfigData, track: TrackSearchResult): Promise<string> {
  const response = await signedGet<WyLyricResponse>(
    config,
    buildUrl(config.endpoints.wyBaseUrl, "lyric", { id: track.id }),
  );
  return response.lrc?.lyric ?? "";
}
