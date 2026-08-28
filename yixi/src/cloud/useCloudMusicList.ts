import { computed, ref } from "vue";
import type { Song } from "@/types/song";
import type { CloudMusicSummary } from "@/types/cloudMusic";
import { toCloudSong } from "@/types/cloudMusic";
import { getCloudSummary, searchCloudMusic } from "@/utils/api/cloudMusicAPI";

const PAGE_SIZE = 20;

export function useCloudMusicList() {
  const summary = ref<CloudMusicSummary>({
    total: 0,
    latestUpdatedAt: null,
  });
  const songs = ref<Song[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const total = ref(0);
  const keyword = ref("");
  const errorMessage = ref<string | null>(null);

  let searchToken = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const hasMore = computed(() => songs.value.length < total.value);

  async function fetchSummary() {
    try {
      const data = await getCloudSummary();
      summary.value = data;
    } catch (error) {
      console.warn("获取云盘概览失败", error);
    }
  }

  async function loadFirstPage(currentKeyword: string) {
    const currentToken = ++searchToken;
    loading.value = true;
    errorMessage.value = null;

    try {
      const result = await searchCloudMusic({
        keyword: currentKeyword.trim() || undefined,
        offset: 0,
        limit: PAGE_SIZE,
      });

      if (currentToken !== searchToken) return;

      const items = (result.items || []).map(toCloudSong);
      songs.value = items;
      total.value = result.total || 0;
    } catch (error) {
      if (currentToken !== searchToken) return;
      errorMessage.value = error instanceof Error ? error.message : "加载云盘歌曲失败";
      songs.value = [];
      total.value = 0;
    } finally {
      if (currentToken === searchToken) {
        loading.value = false;
      }
    }
  }

  async function loadMore() {
    if (loading.value || loadingMore.value || !hasMore.value) return;

    loadingMore.value = true;
    const currentToken = searchToken;
    const currentKeyword = keyword.value;
    const currentOffset = songs.value.length;

    try {
      const result = await searchCloudMusic({
        keyword: currentKeyword.trim() || undefined,
        offset: currentOffset,
        limit: PAGE_SIZE,
      });

      if (currentToken !== searchToken) return;

      const newSongs = (result.items || []).map(toCloudSong);
      const existingIds = new Set(songs.value.map((s) => s.id));
      const filtered = newSongs.filter((s) => !existingIds.has(s.id));

      songs.value = [...songs.value, ...filtered];
      total.value = result.total || 0;
    } catch (error) {
      if (currentToken !== searchToken) return;
      console.error("加载更多云盘歌曲失败", error);
    } finally {
      if (currentToken === searchToken) {
        loadingMore.value = false;
      }
    }
  }

  function setKeyword(newKeyword: string) {
    keyword.value = newKeyword;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      void loadFirstPage(newKeyword);
    }, 300);
  }

  async function refresh() {
    void fetchSummary();
    await loadFirstPage(keyword.value);
  }

  return {
    summary,
    songs,
    loading,
    loadingMore,
    hasMore,
    total,
    keyword,
    errorMessage,
    setKeyword,
    loadMore,
    refresh,
    fetchSummary,
  };
}
