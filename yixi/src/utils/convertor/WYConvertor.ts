import type {
  WYCloudSearchSong,
  WYSearchSong,
  WYPlaylistSong,
  WYRecommendSong,
} from "@/utils/webapi";
import type { CommonPlaylist, Song } from "@/types/song";
import type { WYPlaylistDetail } from "../webapi";
import { wyUtils } from "../common";
import type { WYCloudSearchListItem } from "../webapi/types/WY/WYCloudSearchList";
import { normalizePlaylist } from "../playlist";

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
  convertSearchList
};
