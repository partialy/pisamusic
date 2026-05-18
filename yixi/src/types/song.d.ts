import type { KGAPI } from "../utils/webapi";
export interface Song {
  id: string;
  urlParam: string;
  name: string;
  singer: string;
  album: string;
  cover: string;
  d_cover?: string;
  coverSize?: {
    s: string;
    m: string;
    l: string;
    xl: string;
  };
  url?: string;
  lyric?: string;
  krc?: string;
  size?: {
    [key: string]: number;
  };
  vip?: boolean;
  // 单位ms
  duration: number;
  // 来源
  source: "kg" | "qq" | "wy" | "kw" | "local";
  filePath?: string;
}

export interface API {
  kg: KGAPI;
  qq: QQAPI;
  wy: WYAPI;
  kw: KWAPI;
}

export interface CommonPlaylist {
  id: string;
  source: "kg" | "qq" | "wy" | "kw" | "local";
  name: string;
  desc: string;
  cover: string;
  coverSize?: {
    s: string;
    m: string;
    l: string;
    xl: string;
  };
  tags: {
    name: string;
    id: string;
  }[];
  song_count?: number | string;
  play_count?: number | string;
  collect_count?: number | string;
}
