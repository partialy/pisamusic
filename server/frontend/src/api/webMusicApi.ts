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

export type WebSearchData = {
  songs: WebSong[];
  total: number;
  hasMore: boolean;
};

type ApiResponse<T> = {
  code: number;
  msg: string;
  data: T | null;
  success: boolean;
};

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`);
  }
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success || json.data === null) {
    throw new Error(json.msg || "接口响应异常");
  }
  return json.data;
}

export async function searchWebMusic(
  source: WebMusicSource,
  keywords: string
): Promise<WebSearchData> {
  const query = new URLSearchParams({ source, keywords });
  return request<WebSearchData>(`/api/web/music/search?${query.toString()}`);
}

export async function getWebRecommendations(
  source: WebMusicSource
): Promise<{ songs: WebSong[] }> {
  const query = new URLSearchParams({ source });
  return request<{ songs: WebSong[] }>(`/api/web/music/recommend?${query.toString()}`);
}

export async function getWebSongUrl(
  source: WebMusicSource,
  id: string
): Promise<{ url: string }> {
  const query = new URLSearchParams({ source, id });
  return request<{ url: string }>(`/api/web/music/url?${query.toString()}`);
}

export async function getWebSongLyric(
  source: WebMusicSource,
  id: string
): Promise<{ lrc: string }> {
  const query = new URLSearchParams({ source, id });
  return request<{ lrc: string }>(`/api/web/music/lyric?${query.toString()}`);
}
