import { ipcMain } from "electron";
import {
  fetchLyrics,
  getKgDailyRecommend,
  getKgPlaylistTags,
  getPlaylistDetail,
  getPlaylistTracks,
  getTopPlaylists,
  resolveMusicUrl,
  resolvePlayableUrl,
  searchMusic,
  searchPlaylists,
} from "../music/musicService";
import type {
  MusicLyricParams,
  MusicSearchParams,
  MusicUrlParams,
  PlayableTrackPayload,
  PlaylistDetailParams,
  PlaylistSearchParams,
  PlaylistTracksParams,
  TopPlaylistParams,
} from "../music/types";

let registered = false;

export function setupMusicApiIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("music:search", (_event, params: MusicSearchParams) => searchMusic(params));
  ipcMain.handle("music:search-playlists", (_event, params: PlaylistSearchParams) =>
    searchPlaylists(params)
  );
  ipcMain.handle("music:kg-playlist-tags", () => getKgPlaylistTags());
  ipcMain.handle("music:top-playlists", (_event, params: TopPlaylistParams) => getTopPlaylists(params));
  ipcMain.handle("music:kg-daily-recommend", (_event, platform?: string) =>
    getKgDailyRecommend(platform)
  );
  ipcMain.handle("music:playlist-detail", (_event, params: PlaylistDetailParams) =>
    getPlaylistDetail(params)
  );
  ipcMain.handle("music:playlist-tracks", (_event, params: PlaylistTracksParams) =>
    getPlaylistTracks(params)
  );
  ipcMain.handle("music:resolve-url", (_event, params: MusicUrlParams) => resolveMusicUrl(params));
  ipcMain.handle("music:resolve-playable-url", (_event, track: PlayableTrackPayload) =>
    resolvePlayableUrl(track)
  );
  ipcMain.handle("music:fetch-lyrics", (_event, params: MusicLyricParams) => fetchLyrics(params));
}
