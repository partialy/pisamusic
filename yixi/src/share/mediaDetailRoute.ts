import { shallowRef } from "vue";
import type { Router, LocationQuery } from "vue-router";
import type { CommonPlaylist, Song } from "@/types/song";
import { decodeMediaDetailPayload, playlistFromSharePayload, songFromSharePayload } from "./shareModels";

export type MediaDetailRequest =
  | { kind: "song"; song: Song }
  | { kind: "playlist"; playlist: CommonPlaylist }
  | { kind: "share"; uuid: string }
  | { kind: "invalid" };

// 仅在 renderer 内传递详情，避免本地文件路径及大对象进入路由历史。
export const mediaDetailRequest = shallowRef<MediaDetailRequest | null>(null);

export function openSongDetail(_router: Router, song: Song) {
  mediaDetailRequest.value = { kind: "song", song };
}

export function openPlaylistDetail(_router: Router, playlist: CommonPlaylist) {
  mediaDetailRequest.value = { kind: "playlist", playlist };
}

export function openSharedMediaDetail(_router: Router, uuid: string) {
  mediaDetailRequest.value = { kind: "share", uuid };
}

export function closeMediaDetail() {
  mediaDetailRequest.value = null;
}

/** 兼容旧书签，只消费旧 query，详情展示始终交给全局弹窗。 */
export function openLegacyMediaDetail(query: LocationQuery) {
  if (query.kind === "share") {
    const uuid = Array.isArray(query.uuid) ? query.uuid[0] : query.uuid;
    mediaDetailRequest.value = uuid ? { kind: "share", uuid } : { kind: "invalid" };
    return;
  }
  const payload = decodeMediaDetailPayload(query.payload);
  mediaDetailRequest.value = !payload ? { kind: "invalid" }
    : payload.kind === "song" ? { kind: "song", song: songFromSharePayload(payload.song) }
    : { kind: "playlist", playlist: playlistFromSharePayload(payload.playlist) };
}
