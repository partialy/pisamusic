import {
  captureLibraryRevision,
  isCurrentLibraryRevision,
  onLibraryIdentityChanged,
} from "@/utils/libraryIdentity";
import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { CommonPlaylist, Song } from "@/types/song";
import {
  addSongToMinePlaylist,
  createMinePlaylist,
  importMinePlaylists,
  listMineCloudSongs,
  listMinePlaylistSongs,
  listMinePlaylists,
  removeMinePlaylist,
  replaceMineCloudSongs,
  retryMinePlaylistCover,
  saveMinePlaylistEdit,
  type CreatePlaylistPayload,
  type MineCloudSource,
} from "@/utils/api/mineLibraryAPI";
import {
  getCookieUserPlaylists,
  getUserCookie,
  getWyCloudSongs,
  type CookieSource,
} from "@/utils/api/cookieMusicAPI";
import { hasLoginCookie } from "@/composables/useCookieAccountStatus";
import { parseCookieUserPlaylistPage } from "@/utils/cookiePlaylist";
import { convertWyCloudSongs } from "@/utils/cookieCloudSong";
import { normalizePlaylist } from "@/utils/playlist";
import { showLimitedWarning } from "@/utils/limitedMessage";

const PLAYLIST_PAGE_SIZE = 30;
const CLOUD_PAGE_SIZE = 200;
const MAX_PLAYLIST_PAGES = 500;
const MAX_CLOUD_PAGES = 50;
const CANDIDATE_CACHE_SETTING_KEY = "mine-third-party-playlist-candidates";

export type ThirdPartyPlaylistCandidateCache = {
  kg: CommonPlaylist[];
  wy: CommonPlaylist[];
  updatedAt: string;
};

export const useMineLibraryStore = defineStore("mineLibrary", () => {
  const playlists = ref<CommonPlaylist[]>([]);
  const cloudSongs = ref<Song[]>([]);
  const playlistSongs = ref<Record<string, Song[]>>({});
  const candidateCache = ref<ThirdPartyPlaylistCandidateCache>({
    kg: [],
    wy: [],
    updatedAt: "",
  });
  const candidateCacheLoaded = ref(false);
  const candidatePulling = ref(false);
  const candidateError = ref("");
  const initialized = ref(false);
  const cloudRefreshing = ref(false);
  const playlistError = ref("");
  const cloudError = ref("");
  let stopMineLibraryListener: (() => void) | null = null;

  let cacheGeneration = 0;
  onLibraryIdentityChanged(() => {
    cacheGeneration++;
    playlists.value = [];
    playlistSongs.value = {};
    playlistError.value = "";
    void loadCache();
  });

  const localPlaylists = computed(() => playlists.value.filter((item) => item.source === "local"));
  const kgPlaylists = computed(() => playlists.value.filter((item) => item.source === "kg"));
  const wyPlaylists = computed(() => playlists.value.filter((item) => item.source === "wy"));
  const wyCloudSongs = computed(() => cloudSongs.value.filter((item) => item.source === "wy"));
  const playlistRefreshing = computed(() => candidatePulling.value);

  const candidatePlaylists = computed(() => [
    ...candidateCache.value.kg,
    ...candidateCache.value.wy,
  ]);
  const hasCandidateCache = computed(() => candidatePlaylists.value.length > 0);
  const importedPlaylistKeySet = computed(
    () => new Set(playlists.value.map((item) => `${item.source}:${item.id}`))
  );

  async function init() {
    if (initialized.value) return;
    initialized.value = true;
    await Promise.allSettled([loadCache(), loadCandidateCache()]);
    if (!stopMineLibraryListener && window.electronAPI.onMineLibraryChanged) {
      stopMineLibraryListener = window.electronAPI.onMineLibraryChanged(() => {
        playlistSongs.value = {};
        void loadCache();
      });
    }
    void refreshCloudSongs(true);
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

  async function loadCandidateCache(force = false) {
    if (candidateCacheLoaded.value && !force) return candidateCache.value;
    try {
      const record = await window.electronAPI.getSetting<ThirdPartyPlaylistCandidateCache>(
        CANDIDATE_CACHE_SETTING_KEY
      );
      const raw = record?.value;
      candidateCache.value = {
        kg: normalizeCandidateList("kg", raw?.kg),
        wy: normalizeCandidateList("wy", raw?.wy),
        updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : "",
      };
    } catch {
      candidateCache.value = { kg: [], wy: [], updatedAt: "" };
    } finally {
      candidateCacheLoaded.value = true;
    }
    return candidateCache.value;
  }

  async function saveCandidateCache(next: ThirdPartyPlaylistCandidateCache) {
    candidateCache.value = next;
    candidateCacheLoaded.value = true;
    await window.electronAPI.setSetting(CANDIDATE_CACHE_SETTING_KEY, next, 1);
  }

  async function clearCandidateCache(source?: CookieSource) {
    await loadCandidateCache();
    if (!source) {
      candidateCache.value = { kg: [], wy: [], updatedAt: "" };
      await window.electronAPI.deleteSetting(CANDIDATE_CACHE_SETTING_KEY);
      return;
    }
    const next: ThirdPartyPlaylistCandidateCache = {
      kg: source === "kg" ? [] : candidateCache.value.kg,
      wy: source === "wy" ? [] : candidateCache.value.wy,
      updatedAt: new Date().toISOString(),
    };
    await saveCandidateCache(next);
  }

  async function pullCandidatePlaylists(sources?: CookieSource[]) {
    if (candidatePulling.value) return candidatePlaylists.value;
    await loadCandidateCache();

    const [kgCookie, wyCookie] = await Promise.all([
      getUserCookie("kg"),
      getUserCookie("wy"),
    ]);
    const canFetchKg = hasLoginCookie("kg", kgCookie);
    const canFetchWy = hasLoginCookie("wy", wyCookie);
    const requested = sources?.length ? new Set<CookieSource>(sources) : new Set<CookieSource>(["kg", "wy"]);
    const pullKg = canFetchKg && requested.has("kg");
    const pullWy = canFetchWy && requested.has("wy");

    if (!canFetchKg && !canFetchWy) {
      await clearCandidateCache();
      throw new Error("请先登录酷狗或网易云账号");
    }

    if (!pullKg && !pullWy) {
      return candidatePlaylists.value;
    }

    candidatePulling.value = true;
    candidateError.value = "";
    try {
      const [kgResult, wyResult] = await Promise.allSettled([
        pullKg ? fetchCookiePlaylists("kg") : Promise.resolve(null),
        pullWy ? fetchCookiePlaylists("wy") : Promise.resolve(null),
      ]);

      const nextKg = !canFetchKg
        ? []
        : pullKg && kgResult.status === "fulfilled" && kgResult.value
          ? kgResult.value
          : candidateCache.value.kg;
      const nextWy = !canFetchWy
        ? []
        : pullWy && wyResult.status === "fulfilled" && wyResult.value
          ? wyResult.value
          : candidateCache.value.wy;

      await saveCandidateCache({
        kg: nextKg,
        wy: nextWy,
        updatedAt: new Date().toISOString(),
      });

      const rejectedReasons = [
        pullKg && kgResult.status === "rejected" ? kgResult.reason : null,
        pullWy && wyResult.status === "rejected" ? wyResult.reason : null,
      ].filter(Boolean);
      const totalAttempted = Number(pullKg) + Number(pullWy);
      if (totalAttempted > 0 && rejectedReasons.length === totalAttempted) {
        throw rejectedReasons[0];
      }
      if (rejectedReasons.length > 0) {
        showLimitedWarning("部分平台歌单拉取失败，请检查对应账号登录状态");
      }
      return candidatePlaylists.value;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "拉取三方歌单失败";
      candidateError.value = msg;
      throw error instanceof Error ? error : new Error(msg);
    } finally {
      candidatePulling.value = false;
    }
  }

  async function importCandidatePlaylists(targets: CommonPlaylist[]) {
    const revision = await captureLibraryRevision();
    const validTargets = targets.filter(
      (item) => item.source === "kg" || item.source === "wy"
    );
    if (!validTargets.length) {
      return { added: 0, skipped: 0 };
    }
    const result = await importMinePlaylists(validTargets, revision);
    await loadCache();
    return result;
  }

  function isPlaylistImported(playlist: Pick<CommonPlaylist, "source" | "id">) {
    return importedPlaylistKeySet.value.has(`${playlist.source}:${playlist.id}`);
  }

  async function refreshAll() {
    await Promise.allSettled([
      pullCandidatePlaylists().catch(() => null),
      refreshCloudSongs(true),
    ]);
  }

  async function refreshPlaylists(force = false) {
    if (!force && hasCandidateCache.value) return candidatePlaylists.value;
    return pullCandidatePlaylists();
  }

  async function refreshCloudSongs(force = false) {
    if (cloudRefreshing.value) return;
    if (!force && cloudSongs.value.length) return;
    const wyCookie = await getUserCookie("wy");
    if (!hasLoginCookie("wy", wyCookie)) return;
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
    if (!isCurrentLibraryRevision(input.identityRevision)) {
      throw new Error("账号已变化，请重新编辑");
    }
    return playlist;
  }

  async function removePlaylist(
    target: Pick<CommonPlaylist, "source" | "id"> | string,
    revision: number
  ) {
    const removed = await removeMinePlaylist(target, revision);
    await loadCache();
    if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，请重新确认");
    const playlistId = typeof target === "string" ? target : target.id;
    const source = typeof target === "string" ? "local" : target.source;
    if (source === "local") {
      delete playlistSongs.value[playlistId];
    }
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
    const seenKeys = new Set<string>();

    if (source === "kg") {
      let rawAccumulated = 0;
      for (let page = 1; page <= MAX_PLAYLIST_PAGES; page += 1) {
        const response = await getCookieUserPlaylists({
          source: "kg",
          page,
          pageSize: PLAYLIST_PAGE_SIZE,
        });
        const pageResult = parseCookieUserPlaylistPage("kg", response);
        if (pageResult.rawCount === 0) break;

        for (const item of pageResult.items) {
          const key = `${item.source}:${item.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            result.push(item);
          }
        }
        rawAccumulated += pageResult.rawCount;
        const total = pageResult.totalCount ?? rawAccumulated;
        if (rawAccumulated >= total) break;
      }
      return result;
    }

    let offset = 0;
    for (let page = 1; page <= MAX_PLAYLIST_PAGES; page += 1) {
      const response = await getCookieUserPlaylists({
        source: "wy",
        pageSize: PLAYLIST_PAGE_SIZE,
        offset,
      });
      const pageResult = parseCookieUserPlaylistPage("wy", response);
      for (const item of pageResult.items) {
        const key = `${item.source}:${item.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          result.push(item);
        }
      }
      if (!pageResult.hasMore || pageResult.rawCount === 0) break;
      offset += pageResult.rawCount;
    }
    return result;
  }

  async function fetchWyCloudSongs() {
    const result: Song[] = [];
    for (let page = 1; page <= MAX_CLOUD_PAGES; page += 1) {
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

  function normalizeCandidateList(source: CookieSource, list: unknown): CommonPlaylist[] {
    if (!Array.isArray(list)) return [];
    const items: CommonPlaylist[] = [];
    const seen = new Set<string>();
    for (const raw of list) {
      try {
        if (!raw || typeof raw !== "object") continue;
        const normalized = normalizePlaylist({ ...(raw as Record<string, unknown>), source });
        const key = `${normalized.source}:${normalized.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push(normalized);
        }
      } catch {
        // 忽略无效缓存项
      }
    }
    return items;
  }

  return {
    playlists,
    cloudSongs,
    playlistSongs,
    candidateCache,
    candidatePlaylists,
    candidateCacheLoaded,
    candidatePulling,
    candidateError,
    hasCandidateCache,
    importedPlaylistKeySet,
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
    loadCandidateCache,
    clearCandidateCache,
    pullCandidatePlaylists,
    importCandidatePlaylists,
    isPlaylistImported,
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
