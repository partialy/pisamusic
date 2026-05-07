import { ipcMain } from "electron";
import { fetchLyrics, resolveMusicUrl, resolvePlayableUrl, searchMusic } from "../music/musicService";
import type {
  MusicLyricParams,
  MusicSearchParams,
  MusicUrlParams,
  PlayableTrackPayload,
} from "../music/types";

let registered = false;

export function setupMusicApiIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("music:search", (_event, params: MusicSearchParams) => searchMusic(params));
  ipcMain.handle("music:resolve-url", (_event, params: MusicUrlParams) => resolveMusicUrl(params));
  ipcMain.handle("music:resolve-playable-url", (_event, track: PlayableTrackPayload) =>
    resolvePlayableUrl(track)
  );
  ipcMain.handle("music:fetch-lyrics", (_event, params: MusicLyricParams) => fetchLyrics(params));
}
