import type { CommonPlaylist, Song } from "@/types/song";
import { reportError } from "@/utils/errorReporter";

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

export async function replaceMinePlaylists(source: Exclude<CommonPlaylist["source"], "local">, playlists: CommonPlaylist[]) {
  return invokeMineApi("replaceMinePlaylists", { source, count: playlists.length }, async () => {
    const items = await window.electronAPI.replaceUserPlaylists({
      source,
      playlists,
    });
    return items.map((item) => item.payload as CommonPlaylist);
  });
}

export async function listMinePlaylistSongs(playlistId: string) {
  return invokeMineApi("listMinePlaylistSongs", { playlistId }, async () => {
    const items = await window.electronAPI.listUserPlaylistTracks({ playlistId });
    return items.map((item) => item.payload as Song);
  });
}

export async function addSongToMinePlaylist(playlistId: string, song: Song) {
  return invokeMineApi("addSongToMinePlaylist", { playlistId, songId: song.id, source: song.source }, async () => {
    const items = await window.electronAPI.addUserPlaylistTrack({
      playlistId,
      track: song,
    });
    return items.map((item) => item.payload as Song);
  });
}

export async function listMineCloudSongs(cloudSource: MineCloudSource = "all") {
  return invokeMineApi("listMineCloudSongs", { cloudSource }, async () => {
    const items = await window.electronAPI.listUserCloudSongs({ cloudSource });
    return items.map((item) => item.payload as Song);
  });
}

export async function replaceMineCloudSongs(cloudSource: Exclude<MineCloudSource, "all">, songs: Song[]) {
  return invokeMineApi("replaceMineCloudSongs", { cloudSource, count: songs.length }, async () => {
    const items = await window.electronAPI.replaceUserCloudSongs({
      cloudSource,
      songs,
    });
    return items.map((item) => item.payload as Song);
  });
}

export async function selectPlaylistCover() {
  return invokeMineApi("selectPlaylistCover", {}, () => window.electronAPI.selectPlaylistCover());
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
  try {
    return await invoker();
  } catch (error) {
    void reportError(error, {
      scope: "mine-library",
      action,
      payload,
    });
    throw error;
  }
}
