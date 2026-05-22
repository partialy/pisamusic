import { ipcMain } from "electron";
import {
  fetchLyrics,
  getDynamicCover,
  getHomeRecommendations,
  getKgDailyRecommend,
  getKgPlaylistTags,
  getPlaylistDetail,
  getPlaylistTags,
  getPlaylistTracks,
  getTopPlaylists,
  getTopSongs,
  getWyPersonalizedNewSongs,
  getWyPersonalizedPlaylists,
  resolveMusicUrl,
  resolvePlayableUrl,
  searchMusic,
  searchSuggest,
  searchPlaylists,
} from "../music/musicService";
import type {
  DynamicCoverParams,
  MusicLyricParams,
  MusicSearchParams,
  MusicSuggestParams,
  MusicUrlParams,
  PlayableTrackPayload,
  PlaylistDetailParams,
  PlaylistSearchParams,
  PlaylistTagsParams,
  PlaylistTracksParams,
  TopPlaylistParams,
  TopSongsParams,
  WyPersonalizedNewSongParams,
  WyPersonalizedPlaylistParams,
} from "../music/types";

let registered = false;

export function setupMusicApiIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("music:search", (_event, params: MusicSearchParams) => searchMusic(params));
  ipcMain.handle("music:search-suggest", (_event, params: MusicSuggestParams) =>
    searchSuggest(params)
  );
  ipcMain.handle("music:search-playlists", (_event, params: PlaylistSearchParams) =>
    searchPlaylists(params)
  );
  ipcMain.handle("music:kg-playlist-tags", () => getKgPlaylistTags());
  ipcMain.handle("music:playlist-tags", (_event, params: PlaylistTagsParams) =>
    getPlaylistTags(params)
  );
  ipcMain.handle("music:top-playlists", (_event, params: TopPlaylistParams) => getTopPlaylists(params));
  ipcMain.handle("music:top-songs", (_event, params: TopSongsParams) =>
    getTopSongs(params)
  );
  ipcMain.handle("music:wy-personalized-playlists", (_event, params: WyPersonalizedPlaylistParams) =>
    getWyPersonalizedPlaylists(params)
  );
  ipcMain.handle("music:wy-personalized-new-songs", (_event, params: WyPersonalizedNewSongParams) =>
    getWyPersonalizedNewSongs(params)
  );
  ipcMain.handle("music:kg-daily-recommend", (_event, platform?: string) =>
    getKgDailyRecommend(platform)
  );
  ipcMain.handle("music:home-recommendations", () => getHomeRecommendations());
  ipcMain.handle("music:playlist-detail", (_event, params: PlaylistDetailParams) =>
    getPlaylistDetail(params)
  );
  ipcMain.handle("music:playlist-tracks", (_event, params: PlaylistTracksParams) =>
    getPlaylistTracks(params)
  );
  ipcMain.handle("music:dynamic-cover", (_event, params: DynamicCoverParams) =>
    getDynamicCover(params)
  );
  ipcMain.handle("music:resolve-url", (_event, params: MusicUrlParams) => resolveMusicUrl(params));
  ipcMain.handle("music:resolve-playable-url", (_event, track: PlayableTrackPayload) =>
    resolvePlayableUrl(track)
  );
  ipcMain.handle("music:fetch-lyrics", (_event, params: MusicLyricParams) => fetchLyrics(params));
}
