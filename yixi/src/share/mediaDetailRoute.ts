import type { Router } from "vue-router";
import type { CommonPlaylist, Song } from "@/types/song";
import {
  encodeMediaDetailPayload,
  toPlaylistSharePayload,
  toSongSharePayload,
} from "./shareModels";

export function openSongDetail(router: Router, song: Song) {
  return router.push({
    path: "/media/detail",
    query: {
      kind: "song",
      payload: encodeMediaDetailPayload({
        kind: "song",
        song: toSongSharePayload(song),
      }),
    },
  });
}

export function openPlaylistDetail(router: Router, playlist: CommonPlaylist) {
  return router.push({
    path: "/media/detail",
    query: {
      kind: "playlist",
      payload: encodeMediaDetailPayload({
        kind: "playlist",
        playlist: toPlaylistSharePayload(playlist),
      }),
    },
  });
}

export function openSharedMediaDetail(router: Router, uuid: string) {
  return router.push({
    path: "/media/detail",
    query: {
      kind: "share",
      uuid,
    },
  });
}
