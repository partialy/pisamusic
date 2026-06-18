import type { CommonPlaylist, Song } from "@/types/song";
import {
  toPlaylistSharePayload,
  toSongSharePayload,
  type PublicShareRecord,
  type ShareCreateResult,
} from "./shareModels";

export async function createSongShare(song: Song): Promise<ShareCreateResult> {
  return window.electronAPI.createShare({
    type: "song",
    rawJson: toSongSharePayload(song),
  }) as Promise<ShareCreateResult>;
}

export async function createPlaylistShare(playlist: CommonPlaylist): Promise<ShareCreateResult> {
  return window.electronAPI.createShare({
    type: "playlist",
    rawJson: toPlaylistSharePayload(playlist),
  }) as Promise<ShareCreateResult>;
}

export async function getPublicShare(uuid: string): Promise<PublicShareRecord> {
  return window.electronAPI.getPublicShare(uuid) as Promise<PublicShareRecord>;
}
