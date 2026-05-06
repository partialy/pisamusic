import type { KWSong } from "@/utils/webapi";
import type { Song } from "@/types/song";

export const convertKWSong = (item: KWSong): Song => {
  return {
    id: item.id.toString(),
    urlParam: item.id.toString(),
    name: item.name,
    singer: item.artist,
    album: item.album,
    duration: item.duration > 6000 ? item.duration : item.duration * 1000,
    cover: "",
    url: "",
    source: "kw",
    vip: false
  };
};
