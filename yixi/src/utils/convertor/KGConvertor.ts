import type {
  KGSearchSong,
  KGEveryDayRecommendSong,
  KGPlaylistSongs,
  KGTopSongItem,
  KGTopCardSong,
  KGTopPlaylistItem,
  KGSearchListItem,
} from "@/utils/webapi";
import type { CommonPlaylist, Song } from "@/types/song";
import type { KGPlaylistDetailData } from "../webapi";
import { kgUtils } from "../common";
import { normalizePlaylist } from "../playlist";

const convertKGSearchSong = (item: KGSearchSong): Song => {
  return {
    id: item.FileHash,
    urlParam: item.SQ?.Hash || item.HQ?.Hash || item.FileHash,
    name: item.OriSongName + (item.Suffix ?? item.Suffix),
    singer: item.SingerName,
    album: item.AlbumName,
    duration: item.Duration > 6000 ? item.Duration : item.Duration * 1000,
    cover: kgUtils.getCoverUrl(item),
    url: "",
    source: "kg",
    vip: item.PayType == 1,
  };
};

const convertKGRecommendSong = (item: KGEveryDayRecommendSong): Song => {
  return {
    id: item.hash,
    urlParam:
      item.hash_flac ||
      item.hash_ape ||
      item.hash_320 ||
      item.hash_128 ||
      item.hash,
    name: item.songname,
    singer: item.singerinfo.map((s) => s.name).join("、"),
    album: item.album_name,
    duration:
      item.time_length > 6000 ? item.time_length : item.time_length * 1000,
    cover: kgUtils.getCoverUrl(item),
    size: {
      size: item.file_size,
      size128: item.filesize_128,
      size320: item.filesize_320,
      sizeflac: item.filesize_flac,
      sizeape: item.filesize_ape,
      sizeother: item.filesize_other,
      size192: item.filesize_192,
    },
    url: "",
    source: "kg",
    vip: item.pay_type == 1,
  };
};

const convertKGPlaylistSong = (item: KGPlaylistSongs): Song => {
  return {
    id: item.hash,
    urlParam: item.hash,
    name: item.name?.includes("-") ? item.name.split("-")[1].trim() : item.name,
    singer: item.singerinfo.map((s) => s.name).join("、"),
    album: item.albuminfo.name,
    duration: item.timelen > 6000 ? item.timelen : item.timelen * 1000,
    cover: kgUtils.getCoverUrl(item),
    size: {
      size: item.size,
    },
    url: "",
    source: "kg",
    vip: item.feetype != 1,
  };
};

const convertKGTopSong = (item: KGTopSongItem): Song => {
  return {
    id: item.hash,
    urlParam:
      item.hash_super ||
      item.hash_flac ||
      item.hash_320 ||
      item.hash_128 ||
      item.hash,
    name: item.songname,
    singer: item.author_name,
    album: item.album_name,
    duration: item.timelength > 6000 ? item.timelength : item.timelength * 1000,
    cover: kgUtils.getCoverUrl(item),
    size: {
      size: item.filesize,
      size128: item.filesize_128,
      size320: item.filesize_320,
      sizeflac: item.filesize_flac,
      sizehigh: item.filesize_high,
      sizesuper: item.filesize_super,
    },
    url: "",
    source: "kg",
    vip: item.pay_type == 1,
  };
};

const convertKGTopCardSong = (item: KGTopCardSong): Song => {
  return {
    id: item.hash,
    urlParam:
      item.hash_ape ||
      item.hash_flac ||
      item.hash_320 ||
      item.hash_128 ||
      item.hash,
    name: item.songname,
    singer: item.author_name,
    album: item.album_name,
    duration:
      item.time_length > 6000 ? item.time_length : item.time_length * 1000,
    cover: kgUtils.getCoverUrl(item),
    size: {
      size: item.file_size,
      size128: item.filesize_128,
      size320: item.filesize_320,
      sizeflac: item.filesize_flac,
      sizehigh: item.filesize_ape,
      sizeother: item.filesize_other,
    },
    url: "",
    source: "kg",
    vip: item.pay_type == 1,
  };
};

const convertKGPlaylist = (
  item: KGPlaylistDetailData | KGTopPlaylistItem,
  type: "detail" | "item"
): CommonPlaylist => {
  if (type == "detail") {
    const i = item as KGPlaylistDetailData;
    return normalizePlaylist({
      id: i.global_collection_id,
      name: i.name,
      cover: kgUtils.getCoverUrl(item),
      desc: i.intro,
      play_count: i.count,
      collect_count: i.collect_total,
      tags: i.musiclib_tags.map((tag) => {
        return {
          name: tag.tag_name,
          id: tag.tag_id.toString(),
        };
      }),
      source: "kg",
    });
  } else {
    const i = item as KGTopPlaylistItem;
    return normalizePlaylist({
      id: i.global_collection_id,
      name: i.specialname,
      cover: kgUtils.getCoverUrl(i),
      desc: i.intro,
      play_count: i.play_count,
      collect_count: i.collectcount,
      source: "kg",
      tags: i.tags?.map((tag) => {
        return {
          name: tag.tag_name,
          id: tag.tag_id.toString(),
        };
      }) || [],
    });
  }
};

const convertSearchList = (item: KGSearchListItem): CommonPlaylist => { 
  return normalizePlaylist({
    id: item.gid,
    name: item.specialname,
    cover: kgUtils.getCoverUrl(item),
    desc: item.intro,
    song_count: item.song_count,
    play_count: item.play_count,
    collect_count: item.collect_count,
    source: "kg",
    tags: item.abtags.map((tag) => {
      return {
        name: tag.tag_name,
        id: tag.tag_id.toString(),
      }
    })
  })
};

export const KGConverter = {
  convertKGRecommendSong,
  convertKGSearchSong,
  convertKGPlaylistSong,
  convertKGTopSong,
  convertKGTopCardSong,
  convertKGPlaylist,
  convertSearchList
};
