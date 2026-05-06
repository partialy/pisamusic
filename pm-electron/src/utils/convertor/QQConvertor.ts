import type {
  QQSearchSong,
  QQNewSong,
  QQSongListSong,
  QQRecommendDailySong,
} from "@/utils/webapi";
import type { Song } from "@/types/song";

const convertQQSearchSong = (item: QQSearchSong): Song => {
  return {
    id: item.songmid,
    urlParam: item.strMediaMid,
    name: item.songname,
    singer: item.singer.map((s) => s.name).join("、"),
    album: item.albumname,
    duration: item.interval > 6000 ? item.interval : item.interval * 1000,
    cover: "",
    size: {
      size128: item.size128,
      size320: item.size320,
      sizeape: item.sizeape,
      sizeflac: item.sizeflac,
      sizeogg: item.sizeogg,
    },
    url: "",
    source: "qq",
    vip:item.pay.payplay == 1,
  };
};

const convertQQNewSong = (item: QQNewSong): Song => {
  return {
    id: item.mid,
    urlParam: item.id.toString(),
    name: item.name,
    singer: item.singer.map((s) => s.name).join("、"),
    album: item.album.name,
    duration: item.interval > 6000 ? item.interval : item.interval * 1000,
    cover: "",
    url: "",
    source: "qq",
    vip:item.pay.pay_play == 1,
  };
};

const convertQQSongListSong = (item: QQSongListSong): Song => {
  return {
    id: item.songmid,
    urlParam: item.strMediaMid,
    name: item.songname,
    singer: item.singer.map((s) => s.name).join("、"),
    album: item.albumname,
    duration: item.interval > 6000 ? item.interval : item.interval * 1000,
    cover: "",
    size: {
      size128: item.size128,
      size320: item.size320,
      sizeape: item.sizeape,
      sizeflac: item.sizeflac,
      sizeogg: item.sizeogg,
    },
    url: "",
    source: "qq",
    vip:item.pay.payplay == 1,
  };
};

const convertQQRecommendDailySong = (item: QQRecommendDailySong): Song => {
  return {
    id: item.songmid,
    urlParam: item.strMediaMid,
    name: item.songname,
    singer: item.singer.map((s) => s.name).join("、"),
    album: item.albumname,
    duration: item.interval > 6000 ? item.interval : item.interval * 1000,
    cover: "",
    size: {
      size128: item.size128,
      size320: item.size320,
      sizeape: item.sizeape,
      sizeflac: item.sizeflac,
      sizeogg: item.sizeogg,
    },
    url: "",
    source: "qq",
    vip:item.pay.payplay == 1,
  };
};

const convertQQSearchSongToSong = (item: QQSearchSong): Song => {
  return {
    id: item.songmid,
    urlParam: item.strMediaMid,
    name: item.songname,
    singer: item.singer.map((s) => s.name).join("、"),
    album: item.albumname,
    duration: item.interval > 6000 ? item.interval : item.interval * 1000,
    cover: "",
    size: {
      size128: item.size128,
      size320: item.size320,
      sizeape: item.sizeape,
      sizeflac: item.sizeflac,
      sizeogg: item.sizeogg,
    },
    url: "",
    source: "qq",
    vip:item.pay.payplay == 1,
  };
};

export const QQConverter = {
  convertQQSearchSong,
  convertQQNewSong,
  convertQQSongListSong,
  convertQQRecommendDailySong,
  convertQQSearchSongToSong,
};
