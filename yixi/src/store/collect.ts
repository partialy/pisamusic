import type { CommonPlaylist, Song } from "@/types/song";
import electronAPI from "@/utils/electron";
import { hasPlaylistIdentity, normalizePlaylist } from "@/utils/playlist";
import { hasSongIdentity, normalizeSong } from "@/utils/song";
import { defineStore } from "pinia";
import { computed, ref, toRaw } from "vue";

type FavoriteToggleResult<T> = {
  collected: boolean;
  item: T | null;
};

type FavoriteSongRecord = {
  favoriteKey: string;
  payload: unknown;
};

type FavoritePlaylistRecord = {
  favoriteKey: string;
  payload: unknown;
};

export const useCollectStore = defineStore("collect", () => {
  const songMap = ref(new Map<string, Song>());
  const playlistMap = ref(new Map<string, CommonPlaylist>());
  const changed = ref(false);
  let stopFavoritesListener: (() => void) | null = null;

  const songs = computed(() => Array.from(songMap.value.values()));
  const playlists = computed(() => Array.from(playlistMap.value.values()));

  async function initStore() {
    await reload();
    if (!stopFavoritesListener && electronAPI.onFavoritesChanged) {
      stopFavoritesListener = electronAPI.onFavoritesChanged(() => {
        void reload();
      });
    }
  }

  async function reload() {
    try {
      const [songItems, playlistItems] = await Promise.all([
        electronAPI.listFavoriteSongs(),
        electronAPI.listFavoritePlaylists(),
      ]);
      songMap.value = new Map(normalizeFavoriteSongs(songItems));
      playlistMap.value = new Map(normalizeFavoritePlaylists(playlistItems));
      changed.value = false;
    } catch (error: any) {
      void electronAPI.reportError(error, {
        scope: "collect",
        action: "reload",
      });
      window.$notification?.error({
        title: "读取收藏数据失败",
        content: error?.message || String(error),
        duration: 5000,
      });
      songMap.value = new Map();
      playlistMap.value = new Map();
    }
  }

  async function save() {
    changed.value = false;
  }

  async function collectSong(song?: Song) {
    if (!song) return;
    if (!hasSongIdentity(toRaw(song))) {
      window.$message.error("歌曲收藏失败：缺少来源或 ID");
      return;
    }

    const normalizedSong = normalizeSong(toRaw(song));
    const result = (await electronAPI.toggleFavoriteSong(
      normalizedSong
    )) as FavoriteToggleResult<FavoriteSongRecord>;
    if (result.collected) {
      const savedSong = result.item?.payload
        ? normalizeSong(result.item.payload as Record<string, unknown>)
        : normalizedSong;
      songMap.value.set(songKey(savedSong), savedSong);
      window.$message.success("已添加到收藏");
    } else {
      songMap.value.delete(songKey(normalizedSong));
      window.$message.success("已取消收藏");
    }
    changed.value = true;
  }

  async function collectList(playlist?: CommonPlaylist) {
    if (!playlist) return;
    if (!hasFavoriteIdentity(playlist)) {
      window.$message.error("歌单收藏失败：缺少来源或 ID");
      return;
    }

    try {
      const normalizedPlaylist = normalizePlaylist(toRaw(playlist));
      const result = (await electronAPI.toggleFavoritePlaylist(
        normalizedPlaylist
      )) as FavoriteToggleResult<FavoritePlaylistRecord>;
      if (result.collected) {
        const savedPlaylist = result.item?.payload
          ? normalizePlaylist(result.item.payload as Record<string, unknown>)
          : normalizedPlaylist;
        playlistMap.value.set(
          playlistFavoriteKey(savedPlaylist.source, savedPlaylist.id),
          savedPlaylist
        );
        window.$message.success("已添加到收藏");
      } else {
        playlistMap.value.delete(playlistFavoriteKey(normalizedPlaylist.source, normalizedPlaylist.id));
        window.$message.success("已取消收藏");
      }
      changed.value = true;
    } catch (error: any) {
      void electronAPI.reportError(error, {
        scope: "collect",
        action: "collectList",
        playlistId: playlist?.id,
        source: playlist?.source,
      });
      window.$message.error(error?.message || "歌单收藏失败");
    }
  }

  async function removeSong(song: Song) {
    if (!hasSongIdentity(toRaw(song))) return;
    const normalizedSong = normalizeSong(toRaw(song));
    await electronAPI.removeFavoriteSong({
      source: normalizedSong.source,
      id: normalizedSong.id,
    });
    songMap.value.delete(songKey(normalizedSong));
    changed.value = true;
  }

  async function removeList(playlist: CommonPlaylist) {
    if (!hasFavoriteIdentity(playlist)) return;
    const normalizedPlaylist = normalizePlaylist(toRaw(playlist));
    await electronAPI.removeFavoritePlaylist({
      source: normalizedPlaylist.source,
      id: normalizedPlaylist.id,
    });
    playlistMap.value.delete(playlistFavoriteKey(normalizedPlaylist.source, normalizedPlaylist.id));
    changed.value = true;
  }

  function containsSong(song?: Song) {
    if (!song) return false;
    if (!hasSongIdentity(toRaw(song))) return false;
    const normalizedSong = normalizeSong(toRaw(song));
    return songMap.value.has(songKey(normalizedSong));
  }

  function containSongById(id: string, source = "") {
    if (source) return songMap.value.has(favoriteKey(source, id));
    return Array.from(songMap.value.values()).some((song) => song.id === id);
  }

  function containsPlaylist(playlist?: CommonPlaylist) {
    if (!playlist || !hasFavoriteIdentity(playlist)) return false;
    const normalizedPlaylist = normalizePlaylist(toRaw(playlist));
    return playlistMap.value.has(playlistFavoriteKey(normalizedPlaylist.source, normalizedPlaylist.id));
  }

  function containPlaylistById(id: string, source = "") {
    if (source) return playlistMap.value.has(playlistFavoriteKey(source, id));
    return Array.from(playlistMap.value.values()).some((playlist) => playlist.id === id);
  }

  function songKey(song: Song) {
    return favoriteKey(song.source, song.id);
  }

  function playlistFavoriteKey(source: string, id: string) {
    return favoriteKey(source, id);
  }

  function favoriteKey(source: string, id: string) {
    return `${source}:${id}`;
  }

  function hasFavoriteIdentity(playlist: CommonPlaylist) {
    return hasPlaylistIdentity(toRaw(playlist));
  }

  function normalizeFavoritePlaylists(items: FavoritePlaylistRecord[]) {
    const entries: [string, CommonPlaylist][] = [];
    items.forEach((item) => {
      try {
        const playlist = normalizePlaylist(item.payload as Record<string, unknown>);
        entries.push([playlistFavoriteKey(playlist.source, playlist.id), playlist]);
      } catch (error) {
        console.warn("忽略无效收藏歌单", error);
      }
    });
    return entries;
  }

  function normalizeFavoriteSongs(items: FavoriteSongRecord[]) {
    const entries: [string, Song][] = [];
    items.forEach((item) => {
      try {
        const song = normalizeSong(item.payload as Record<string, unknown>);
        entries.push([songKey(song), song]);
      } catch (error) {
        console.warn("忽略无效收藏歌曲", error);
      }
    });
    return entries;
  }

  return {
    songMap,
    playlistMap,
    changed,
    songs,
    playlists,
    initStore,
    reload,
    save,
    collectSong,
    collectList,
    removeSong,
    removeList,
    containsSong,
    containSongById,
    containsPlaylist,
    containPlaylistById,
    playlistFavoriteKey,
  };
});

export default useCollectStore;
