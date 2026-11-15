import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";
import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { CommonPlaylist, Song } from "@/types/song";
import {
  addSongToMinePlaylist,
  saveMinePlaylistEdit,
  removeMinePlaylist,
  retryMinePlaylistCover,
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
import { showLimitedWarning } from "@/utils/limitedMessage";

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

  let cacheGeneration = 0;
  onLibraryIdentityChanged(() => {
    cacheGeneration++;
    playlists.value = [];
    playlistSongs.value = {};
    playlistRefreshing.value = false;
    playlistError.value = "";
    void loadCache();
  });
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
        playlistSongs.value = {};
        void loadCache();
      });
    }
    void refreshAll();
  }

  async function loadCache() {
    const generation = ++cacheGeneration;
    const revision = await captureLibraryRevision();
    const [playlistCache, cloudCache] = await Promise.all([
      listMinePlaylists("all"),
      listMineCloudSongs("all"),
    ]);
    if (!isCurrentLibraryRevision(revision) || generation !== cacheGeneration) return;
    playlists.value = playlistCache;
    cloudSongs.value = cloudCache;
  }

  async function refreshAll() {
    await Promise.allSettled([refreshPlaylists(true), refreshCloudSongs(true)]);
  }

  async function refreshPlaylists(force = false) {
    const revision = await captureLibraryRevision();
    if (playlistRefreshing.value) return;
    if (!force && playlists.value.length) return;
    playlistRefreshing.value = true;
    playlistError.value = "";
    try {
      const [kgResult, wyResult] = await Promise.allSettled([
        fetchCookiePlaylists("kg"),
        fetchCookiePlaylists("wy"),
      ]);

      if (!isCurrentLibraryRevision(revision)) return;
      if (kgResult.status === "fulfilled") {
        await replaceMinePlaylists("kg", kgResult.value, revision);
      }
      if (wyResult.status === "fulfilled") {
        await replaceMinePlaylists("wy", wyResult.value, revision);
      }
      if (kgResult.status === "rejected" && wyResult.status === "rejected") {
        throw kgResult.reason;
      }
      const next = await listMinePlaylists("all");
      if (isCurrentLibraryRevision(revision)) playlists.value = next;
    } catch (error) {
      if (!isCurrentLibraryRevision(revision)) return;
      playlistError.value = error instanceof Error ? error.message : "歌单刷新失败";
      showLimitedWarning("歌单刷新失败，已显示本地缓存");
    } finally {
      if (isCurrentLibraryRevision(revision)) playlistRefreshing.value = false;
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
      showLimitedWarning("云盘刷新失败，已显示本地缓存");
    } finally {
      cloudRefreshing.value = false;
    }
  }

  async function createPlaylist(payload: CreatePlaylistPayload) {
    const revision = await captureLibraryRevision();
    const playlist = await createMinePlaylist(payload);
    if (!playlist) throw new Error("创建歌单失败");
    const next = await listMinePlaylists("all");
    if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，请重试");
    playlists.value = next;
    return playlist;
  }

  async function savePlaylistEdit(input: import("@/types/playlistCover").PlaylistEditInput) {
    const playlist = await saveMinePlaylistEdit(input);
    await loadCache();
    if (!isCurrentLibraryRevision(input.identityRevision)) throw new Error("账号已变化，请重新编辑");
    return playlist;
  }
  async function removePlaylist(playlistId: string, revision: number) {
    const removed = await removeMinePlaylist(playlistId, revision);
    await loadCache();
    if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，请重新确认");
    delete playlistSongs.value[playlistId];
    return removed;
  }
  async function retryPlaylistCover(playlistId: string, revision: number) {
    await retryMinePlaylistCover(playlistId, revision);
    await loadCache();
  }

  async function addSongToPlaylist(playlistId: string, song: Song) {
    const revision = await captureLibraryRevision();
    const songs = await addSongToMinePlaylist(playlistId, song);
    if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，请重试");
    playlistSongs.value = {
      ...playlistSongs.value,
      [playlistId]: songs,
    };
    const next = await listMinePlaylists("all");
    if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，请重试");
    playlists.value = next;
    return songs;
  }

  async function loadPlaylistSongs(playlistId: string, force = false) {
    const revision = await captureLibraryRevision();
    if (!force && playlistSongs.value[playlistId]) return playlistSongs.value[playlistId];
    const songs = await listMinePlaylistSongs(playlistId);
    if (!isCurrentLibraryRevision(revision)) return [];
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
    savePlaylistEdit,
    removePlaylist,
    retryPlaylistCover,
    addSongToPlaylist,
    loadPlaylistSongs,
    getPlaylistsBySource,
    getCloudSongsBySource,
  };
});
