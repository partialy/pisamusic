import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { CommonPlaylist, Song } from "@/types/song";
import {
  addSongToMinePlaylist,
  createMinePlaylist,
  listMineCloudSongs,
  listMinePlaylistSongs,
  listMinePlaylists,
  replaceMineCloudSongs,
  replaceMinePlaylists,
  type CreatePlaylistPayload,
  type MineCloudSource,
} from "@/utils/api/mineLibraryAPI";
import { getCookieUserPlaylists, getWyCloudSongs, type CookieSource } from "@/utils/api/cookieMusicAPI";
import { convertCookieUserPlaylists } from "@/utils/cookiePlaylist";
import { convertWyCloudSongs } from "@/utils/cookieCloudSong";

const PLAYLIST_PAGE_SIZE = 100;
const CLOUD_PAGE_SIZE = 200;
const MAX_PAGE_COUNT = 50;

export const useMineLibraryStore = defineStore("mineLibrary", () => {
  const playlists = ref<CommonPlaylist[]>([]);
  const cloudSongs = ref<Song[]>([]);
  const playlistSongs = ref<Record<string, Song[]>>({});
  const initialized = ref(false);
  const playlistRefreshing = ref(false);
  const cloudRefreshing = ref(false);
  const playlistError = ref("");
  const cloudError = ref("");
  let stopMineLibraryListener: (() => void) | null = null;

  const localPlaylists = computed(() => playlists.value.filter((item) => item.source === "local"));
  const kgPlaylists = computed(() => playlists.value.filter((item) => item.source === "kg"));
  const wyPlaylists = computed(() => playlists.value.filter((item) => item.source === "wy"));
  const wyCloudSongs = computed(() => cloudSongs.value.filter((item) => item.source === "wy"));

  async function init() {
    if (initialized.value) return;
    initialized.value = true;
    await loadCache();
    if (!stopMineLibraryListener && window.electronAPI.onMineLibraryChanged) {
      stopMineLibraryListener = window.electronAPI.onMineLibraryChanged(() => {
        void loadCache();
      });
    }
    void refreshAll();
  }

  async function loadCache() {
    const [playlistCache, cloudCache] = await Promise.all([
      listMinePlaylists("all"),
      listMineCloudSongs("all"),
    ]);
    playlists.value = playlistCache;
    cloudSongs.value = cloudCache;
  }

  async function refreshAll() {
    await Promise.allSettled([refreshPlaylists(true), refreshCloudSongs(true)]);
  }

  async function refreshPlaylists(force = false) {
    if (playlistRefreshing.value) return;
    if (!force && playlists.value.length) return;
    playlistRefreshing.value = true;
    playlistError.value = "";
    try {
      const [kgResult, wyResult] = await Promise.allSettled([
        fetchCookiePlaylists("kg"),
        fetchCookiePlaylists("wy"),
      ]);

      if (kgResult.status === "fulfilled") {
        await replaceMinePlaylists("kg", kgResult.value);
      }
      if (wyResult.status === "fulfilled") {
        await replaceMinePlaylists("wy", wyResult.value);
      }
      if (kgResult.status === "rejected" && wyResult.status === "rejected") {
        throw kgResult.reason;
      }
      playlists.value = await listMinePlaylists("all");
    } catch (error) {
      playlistError.value = error instanceof Error ? error.message : "歌单刷新失败";
      window.$message?.warning("歌单刷新失败，已显示本地缓存");
    } finally {
      playlistRefreshing.value = false;
    }
  }

  async function refreshCloudSongs(force = false) {
    if (cloudRefreshing.value) return;
    if (!force && cloudSongs.value.length) return;
    cloudRefreshing.value = true;
    cloudError.value = "";
    try {
      const wySongs = await fetchWyCloudSongs();
      await replaceMineCloudSongs("wy", wySongs);
      cloudSongs.value = await listMineCloudSongs("all");
    } catch (error) {
      cloudError.value = error instanceof Error ? error.message : "云盘刷新失败";
      window.$message?.warning("云盘刷新失败，已显示本地缓存");
    } finally {
      cloudRefreshing.value = false;
    }
  }

  async function createPlaylist(payload: CreatePlaylistPayload) {
    const playlist = await createMinePlaylist(payload);
    if (!playlist) throw new Error("创建歌单失败");
    playlists.value = await listMinePlaylists("all");
    return playlist;
  }

  async function addSongToPlaylist(playlistId: string, song: Song) {
    const songs = await addSongToMinePlaylist(playlistId, song);
    playlistSongs.value = {
      ...playlistSongs.value,
      [playlistId]: songs,
    };
    playlists.value = await listMinePlaylists("all");
    return songs;
  }

  async function loadPlaylistSongs(playlistId: string, force = false) {
    if (!force && playlistSongs.value[playlistId]) return playlistSongs.value[playlistId];
    const songs = await listMinePlaylistSongs(playlistId);
    playlistSongs.value = {
      ...playlistSongs.value,
      [playlistId]: songs,
    };
    return songs;
  }

  function getPlaylistsBySource(source: CommonPlaylist["source"] | "all") {
    if (source === "all") return playlists.value;
    return playlists.value.filter((item) => item.source === source);
  }

  function getCloudSongsBySource(source: MineCloudSource) {
    if (source === "all") return cloudSongs.value;
    if (source === "wy") return wyCloudSongs.value;
    return [];
  }

  async function fetchCookiePlaylists(source: CookieSource) {
    const result: CommonPlaylist[] = [];
    for (let page = 1; page <= MAX_PAGE_COUNT; page += 1) {
      const response = await getCookieUserPlaylists({
        source,
        page,
        pageSize: PLAYLIST_PAGE_SIZE,
      });
      const pageItems = convertCookieUserPlaylists(source, response);
      result.push(...pageItems);
      if (pageItems.length < PLAYLIST_PAGE_SIZE) break;
    }
    return result;
  }

  async function fetchWyCloudSongs() {
    const result: Song[] = [];
    for (let page = 1; page <= MAX_PAGE_COUNT; page += 1) {
      const response = await getWyCloudSongs({
        page,
        pageSize: CLOUD_PAGE_SIZE,
      });
      const pageResult = convertWyCloudSongs(response);
      result.push(...pageResult.songs);
      if (!pageResult.hasMore || pageResult.songs.length < CLOUD_PAGE_SIZE) break;
    }
    return result;
  }

  return {
    playlists,
    cloudSongs,
    playlistSongs,
    initialized,
    playlistRefreshing,
    cloudRefreshing,
    playlistError,
    cloudError,
    localPlaylists,
    kgPlaylists,
    wyPlaylists,
    wyCloudSongs,
    init,
    loadCache,
    refreshAll,
    refreshPlaylists,
    refreshCloudSongs,
    createPlaylist,
    addSongToPlaylist,
    loadPlaylistSongs,
    getPlaylistsBySource,
    getCloudSongsBySource,
  };
});
