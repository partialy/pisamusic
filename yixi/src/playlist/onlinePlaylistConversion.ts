import type { CommonPlaylist, Song } from "@/types/song";
import { normalizeSong } from "@/utils/song";
import { isCurrentLibraryRevision } from "@/utils/libraryIdentity";

/** 只在全集核验后调用一次 main 组合事务；每次明确转换创建新的 UUID 副本。 */
export async function saveConvertedPlaylist(playlist: CommonPlaylist, songs: Song[], identityRevision: number): Promise<CommonPlaylist> {
  if (!isCurrentLibraryRevision(identityRevision)) throw new Error("账号已变化，请重新确认转换。");
  const result = await window.electronAPI.createUserPlaylistWithTracks({
    playlist: { id: "", source: "local", name: playlist.name, desc: playlist.desc, cover: playlist.cover,
      tags: playlist.tags.map(tag => ({ ...tag })), coverResource: null, coverPreset: null },
    tracks: songs.map(song => normalizeSong(song as unknown as Record<string, unknown>)),
    identityRevision,
  });
  if (!isCurrentLibraryRevision(identityRevision)) throw new Error("账号已变化，副本已保留在原账号中。");
  return result.playlist.payload as CommonPlaylist;
}
