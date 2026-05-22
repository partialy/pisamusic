import type {
  WYCloudSearchSong,
  WYSearchSong,
  WYPlaylistSong,
  WYRecommendSong,
  WYHighQualityPlaylist,
  WYRecommendResource,
} from "@/utils/webapi";
import type { CommonPlaylist, Song } from "@/types/song";
import type { WYPlaylistDetail } from "../webapi";
import { wyUtils } from "../common";
import type { WYCloudSearchListItem } from "../webapi/types/WY/WYCloudSearchList";
import { normalizePlaylist } from "../playlist";

type WYPersonalizedPlaylist = {
  id: number;
  name: string;
  copywriter?: string;
  picUrl: string;
  playCount?: number;
  trackCount?: number;
};

type WYPersonalizedNewSong = {
  id: number;
  name: string;
  picUrl: string;
  song?: {
    id: number;
    name: string;
    artists?: { name: string }[];
    album?: {
      name: string;
      picUrl?: string;
      blurPicUrl?: string;
    };
    duration?: number;
    fee?: number;
  };
};

const convertCloudSearchSong = (item: WYCloudSearchSong): Song => {
  const { cover, coverSize } = wyUtils.getCoverUrl(item);
  return {
    id: item.id.toString(),
    urlParam: item.id.toString(),
    name: item.name,
    singer: item.ar.map((s) => s.name).join("、"),
    album: item.al.name,
    duration: item.dt > 6000 ? item.dt : item.dt * 1000,
    cover: cover,
    coverSize: coverSize,
    url: "",
    source: "wy",
    vip: item.fee == 1 || item.fee == 4 || item.fee == 8,
  };
};

const convertSearchSong = (item: WYSearchSong): Song => {
  const { cover, coverSize } = wyUtils.getCoverUrl(item);
  return {
    id: item.id.toString(),
    urlParam: item.id.toString(),
    name: item.name,
    singer: item.artists.map((s) => s.name).join("、"),
    album: item.album.name,
    duration: item.duration > 6000 ? item.duration : item.duration * 1000,
    cover: cover,
    coverSize: coverSize,
    url: "",
    source: "wy",
    vip: item.fee == 1 || item.fee == 4 || item.fee == 8,
  };
};

const convertPlaylistSong = (item: WYPlaylistSong): Song => {
  const { cover, coverSize } = wyUtils.getCoverUrl(item);
  return {
    id: item.id.toString(),
    urlParam: item.id.toString(),
    name: item.name,
    singer: item.ar.map((s) => s.name).join("、"),
    album: item.al.name,
    duration: item.dt > 6000 ? item.dt : item.dt * 1000,
    cover: cover,
    coverSize: coverSize,
    url: "",
    source: "wy",
    vip: item.fee == 1 || item.fee == 4 || item.fee == 8,
  };
};

const convertRecommendSong = (item: WYRecommendSong): Song => {
  const { cover, coverSize } = wyUtils.getCoverUrl(item);
  return {
    id: item.id.toString(),
    urlParam: item.id.toString(),
    name: item.name,
    singer: item.ar.map((s) => s.name).join("、"),
    album: item.al.name,
    duration: item.dt > 6000 ? item.dt : item.dt * 1000,
    cover: cover,
    coverSize: coverSize,
    url: "",
    source: "wy",
    vip: item.fee == 1 || item.fee == 4 || item.fee == 8,
  };
};

const convertWYPlaylist = (item: WYPlaylistDetail): CommonPlaylist => {
  const { cover, coverSize } = wyUtils.getCoverUrl(item);
  return normalizePlaylist({
    id: item.id.toString(),
    name: item.name,
    cover: cover,
    coverSize: coverSize,
    desc: item.description,
    play_count: item.playCount,
    collect_count: item.subscribedCount,
    source: "wy",
    tags: item.tags.map((t) => {
      return {
        name: t,
        id: t,
      };
    }),
  });
};

const convertWYTopPlaylist = (item: WYHighQualityPlaylist): CommonPlaylist => {
  const { cover, coverSize } = wyUtils.getCoverUrl(item);
  return normalizePlaylist({
    id: item.id.toString(),
    name: item.name,
    cover,
    coverSize,
    desc: item.description || item.copywriter || "",
    play_count: item.playCount,
    collect_count: item.subscribedCount,
    song_count: item.trackCount,
    source: "wy",
    tags: (item.tags || []).map((tag) => ({ name: tag, id: tag })),
  });
};

const convertWYPersonalizedPlaylist = (
  item: WYPersonalizedPlaylist | WYRecommendResource
): CommonPlaylist => {
  const { cover, coverSize } = wyUtils.getCoverUrl({
    ...item,
    coverImgUrl: "picUrl" in item ? item.picUrl : "",
  });
  return normalizePlaylist({
    id: item.id.toString(),
    name: item.name,
    cover,
    coverSize,
    desc: item.copywriter || "",
    play_count: "playcount" in item ? item.playcount : item.playCount,
    song_count: item.trackCount,
    source: "wy",
  });
};

const convertWYPersonalizedNewSong = (item: WYPersonalizedNewSong): Song => {
  const song = item.song;
  const { cover, coverSize } = wyUtils.getCoverUrl({
    ...(song || {}),
    al: {
      name: song?.album?.name || "",
      picUrl: song?.album?.picUrl || song?.album?.blurPicUrl || item.picUrl,
    },
    picUrl: item.picUrl,
  });
  return {
    id: String(song?.id ?? item.id),
    urlParam: String(song?.id ?? item.id),
    name: song?.name || item.name,
    singer: (song?.artists || []).map((s) => s.name).join("、"),
    album: song?.album?.name || "",
    duration: song?.duration || 0,
    cover,
    coverSize,
    url: "",
    source: "wy",
    vip: song?.fee == 1 || song?.fee == 4 || song?.fee == 8,
  };
};

const convertSearchList = (item: WYCloudSearchListItem): CommonPlaylist => {
  const { cover, coverSize } = wyUtils.getCoverUrl(item);
  return normalizePlaylist({
    id: item.id.toString(),
    name: item.name,
    cover: cover,
    coverSize: coverSize,
    desc: item.description || "",
    play_count: item.playCount,
    song_count: item.trackCount,
    source: "wy",
  })
}

export const WYConvertor = {
  convertCloudSearchSong,
  convertSearchSong,
  convertPlaylistSong,
  convertRecommendSong,
  convertWYPlaylist,
  convertWYTopPlaylist,
  convertWYPersonalizedPlaylist,
  convertWYPersonalizedNewSong,
  convertSearchList
};
