import { captureLibraryRevision, isCurrentLibraryRevision } from "@/utils/libraryIdentity";
import type { CommonPlaylist, Song } from "@/types/song";
import { reportError } from "@/utils/errorReporter";
import { normalizePlaylist } from "@/utils/playlist";
import { normalizeSong } from "@/utils/song";
import { toRaw } from "vue";

export type MinePlaylistSource = CommonPlaylist["source"] | "all";
export type MineCloudSource = "all" | "private" | "kg" | "wy";

export type CreatePlaylistPayload = {
  name: string;
  desc?: string;
  cover?: string;
  tags?: CommonPlaylist["tags"];
};

export async function listMinePlaylists(source: MinePlaylistSource = "all") {
  return invokeMineApi("listMinePlaylists", { source }, async () => {
    const items = await window.electronAPI.listUserPlaylists({ source });
    return items.map((item) => item.payload as CommonPlaylist);
  });
}

export async function createMinePlaylist(payload: CreatePlaylistPayload) {
  return invokeMineApi("createMinePlaylist", payload, async () => {
    const item = await window.electronAPI.createUserPlaylist({
      id: "",
      source: "local",
      name: payload.name,
      desc: payload.desc || "",
      cover: payload.cover || "",
      tags: normalizeTags(payload.tags),
      song_count: 0,
    });
    return item?.payload as CommonPlaylist | null;
  });
}

export async function replaceMinePlaylists(source: Exclude<CommonPlaylist["source"], "local">, playlists: CommonPlaylist[], identityRevision?: number) {
  return invokeMineApi("replaceMinePlaylists", { source, count: playlists.length }, async () => {
    const items = await window.electronAPI.replaceUserPlaylists({
      source,
      playlists,
      identityRevision,
    });
    return items.map((item) => item.payload as CommonPlaylist);
  });
}

export async function importMinePlaylists(playlists: CommonPlaylist[], identityRevision?: number) {
  const normalizedPlaylists = playlists.map((item) =>
    normalizePlaylist(toRaw(item) as unknown as Record<string, unknown>)
  );
  return invokeMineApi("importMinePlaylists", { count: normalizedPlaylists.length }, async () => {
    if (identityRevision !== undefined && !isCurrentLibraryRevision(identityRevision)) {
      throw new Error("账号已变化，请重试");
    }
    return window.electronAPI.importUserPlaylists({
      playlists: normalizedPlaylists,
      identityRevision,
    });
  });
}

export async function listMinePlaylistSongs(playlistId: string) {
  return invokeMineApi("listMinePlaylistSongs", { playlistId }, async () => {
    const items = await window.electronAPI.listUserPlaylistTracks({ playlistId });
    return items.map((item) => normalizeSong(item.payload as Record<string, unknown>));
  });
}

export async function addSongToMinePlaylist(playlistId: string, song: Song) {
  const normalizedSong = normalizeSong(toRaw(song) as unknown as Record<string, unknown>);
  return invokeMineApi("addSongToMinePlaylist", { playlistId, songId: normalizedSong.id, source: normalizedSong.source }, async () => {
    const items = await window.electronAPI.addUserPlaylistTrack({
      playlistId,
      track: normalizedSong,
    });
    return items.map((item) => normalizeSong(item.payload as Record<string, unknown>));
  });
}

export async function listMineCloudSongs(cloudSource: MineCloudSource = "all") {
  return invokeMineApi("listMineCloudSongs", { cloudSource }, async () => {
    const items = await window.electronAPI.listUserCloudSongs({ cloudSource });
    return items.map((item) => item.payload as Song);
  });
}

export async function replaceMineCloudSongs(cloudSource: Exclude<MineCloudSource, "all">, songs: Song[]) {
  const normalizedSongs = songs.map((song) => normalizeSong(toRaw(song) as unknown as Record<string, unknown>));
  return invokeMineApi("replaceMineCloudSongs", { cloudSource, count: songs.length }, async () => {
    const items = await window.electronAPI.replaceUserCloudSongs({
      cloudSource,
      songs: normalizedSongs,
    });
    return items.map((item) => normalizeSong(item.payload as Record<string, unknown>));
  });
}

export async function saveMinePlaylistEdit(input: import("@/types/playlistCover").PlaylistEditInput) {
  return invokeMineApi("saveMinePlaylistEdit", { playlistId: input.playlistId }, async () => {
    if (!isCurrentLibraryRevision(input.identityRevision)) throw new Error("账号已变化，请重新编辑");
    const item = await window.electronAPI.savePlaylistEdit(input);
    return item.payload as CommonPlaylist;
  });
}
export async function removeMinePlaylist(
  target: Pick<CommonPlaylist, "source" | "id"> | string,
  identityRevision: number
) {
  const source = typeof target === "string" ? "local" : target.source;
  const playlistId = typeof target === "string" ? target : target.id;
  return invokeMineApi("removeMinePlaylist", { source, playlistId }, async () => {
    if (!isCurrentLibraryRevision(identityRevision)) throw new Error("账号已变化，请重新确认");
    return window.electronAPI.removeUserPlaylist({ source, id: playlistId, identityRevision });
  });
}
export async function retryMinePlaylistCover(playlistId: string, identityRevision: number) {
  return invokeMineApi("retryMinePlaylistCover", { playlistId }, () => window.electronAPI.retryPlaylistCover({ playlistId, identityRevision }));
}

export async function selectPlaylistCover() {
  return invokeMineApi("selectPlaylistCover", {}, () => window.electronAPI.selectManagedPlaylistCover());
}

function normalizeTags(tags?: CommonPlaylist["tags"]) {
  const tagNames = new Set<string>();
  return (tags || [])
    .map((tag) => tag.name.trim())
    .filter((name) => {
      if (!name || tagNames.has(name)) return false;
      tagNames.add(name);
      return true;
    })
    .slice(0, 3)
    .map((name) => ({ name, id: name }));
}

async function invokeMineApi<T>(
  action: string,
  payload: Record<string, unknown>,
  invoker: () => Promise<T>
) {
  const revision = await captureLibraryRevision();
  try {
    const result = await invoker();
    if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，请重试");
    return result;
  } catch (error) {
    void reportError(error, {
      scope: "mine-library",
      action,
      payload,
    });
    throw error;
  }
}
