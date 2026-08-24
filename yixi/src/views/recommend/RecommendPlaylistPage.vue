<template>
  <div class="recommend-playlist-page mw1600">
    <header class="page-header">
      <div class="header-copy">
        <span class="header-kicker">CURATED FOR YOU</span>
        <h1>{{ pageTitle }}</h1>
      </div>
      <div class="header-actions">
        <n-button
          type="primary"
          class="shuffle-btn"
          :disabled="!playlists.length"
          :loading="playingRandom"
          @click="handleRandomPlay">
          <template #icon>
            <n-icon :component="Play" />
          </template>
          随机播放
        </n-button>
        <div class="filter-tabs">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            :class="{ active: activeFilter === option.value }"
            @click="handleFilterChange(option.value)">
            {{ option.label }}
          </button>
        </div>
      </div>
    </header>

    <PlaylistCollect
      :playlist="playlists"
      :loading="loading"
      :skeleton-count="24" />

    <n-empty v-if="!loading && !playlists.length" class="empty-state" description="暂无推荐歌单" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NButton, NEmpty, NIcon } from "naive-ui";
import { Play } from "lucide-vue-next";
import PlaylistCollect from "@/components/list/PlaylistCollect.vue";
import type { CommonPlaylist } from "@/types/song";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { convertor } from "@/utils/convertor";
import {
  getHomeRecommendations,
  getTopPlaylists,
  getWyPersonalizedPlaylists,
} from "@/utils/api/musicAPI";
import { fetchAllPlaylistTracks } from "@/utils/playlistTracks";
import {
  PLAYLIST_SOURCE_META,
  normalizePlaylistType,
  queryString,
  type RecommendPlaylistType,
} from "./recommendSources";

type PlaylistFilter = "recommend" | "hot" | "new";

const route = useRoute();
const router = useRouter();
const playbackCommands = usePlaybackCommands();
const playlists = ref<CommonPlaylist[]>([]);
const loading = ref(false);
const playingRandom = ref(false);
const activeFilter = ref<PlaylistFilter>("recommend");

const sourceType = computed(() => normalizePlaylistType(route.query.type));
const sourceMeta = computed(() => PLAYLIST_SOURCE_META[sourceType.value]);
const pageTitle = computed(() => queryString(route.query.title) || sourceMeta.value.title);
const filterOptions = computed(() => {
  if (sourceType.value === "wy-top") {
    return [
      { label: "最热", value: "hot" as const },
      { label: "最新", value: "new" as const },
    ];
  }
  return [{ label: "推荐", value: "recommend" as const }];
});

async function loadPlaylists() {
  loading.value = true;
  try {
    playlists.value = await fetchPlaylistSource(sourceType.value, activeFilter.value);
  } catch (error) {
    playlists.value = [];
    window.$message?.warning(`${pageTitle.value}加载失败`);
    void window.electronAPI.reportError(error, {
      scope: "recommend",
      action: "loadPlaylists",
      type: sourceType.value,
    });
  } finally {
    loading.value = false;
  }
}

async function fetchPlaylistSource(type: RecommendPlaylistType, filter: PlaylistFilter) {
  if (type === "wy-top") {
    const res: any = await getTopPlaylists({
      source: "wy",
      page: 1,
      pageSize: 40,
      order: filter === "new" ? "new" : "hot",
      cat: "全部",
    });
    return (res?.playlists || []).map((item: any) => convertor.WY.convertWYTopPlaylist(item));
  }

  if (type === "wy-personalized") {
    const res: any = await getWyPersonalizedPlaylists({ limit: 40 });
    return (res?.result || []).map((item: any) => convertor.WY.convertWYPersonalizedPlaylist(item));
  }

  const res: any = await getHomeRecommendations();
  return (res?.playlists?.data?.special_list || []).map((item: any) =>
    convertor.KG.convertKGPlaylist(item, "item")
  );
}

async function handleRandomPlay() {
  const playlist = playlists.value[Math.floor(Math.random() * playlists.value.length)];
  if (!playlist) return;
  playingRandom.value = true;
  try {
    const songs = await fetchAllPlaylistTracks(playlist);
    if (!songs.length) {
      window.$message?.warning("歌单暂无可播放歌曲");
      return;
    }
    playbackCommands.playAll(songs);
  } catch (error) {
    window.$message?.warning("随机播放失败");
    void window.electronAPI.reportError(error, {
      scope: "recommend",
      action: "randomPlayPlaylist",
      playlistId: playlist.id,
      source: playlist.source,
    });
  } finally {
    playingRandom.value = false;
  }
}

function handleFilterChange(filter: PlaylistFilter) {
  if (activeFilter.value === filter) return;
  activeFilter.value = filter;
  if (sourceType.value === "wy-top") {
    router.replace({
      path: route.path,
      query: {
        ...route.query,
        order: filter,
      },
    });
  }
}

watch(
  () => [route.query.type, route.query.order],
  () => {
    const nextType = normalizePlaylistType(route.query.type);
    activeFilter.value =
      nextType === "wy-top" && queryString(route.query.order) === "new" ? "new" : filterOptions.value[0].value;
    void loadPlaylists();
  }
);

onMounted(() => {
  activeFilter.value =
    sourceType.value === "wy-top" && queryString(route.query.order) === "new" ? "new" : filterOptions.value[0].value;
  void loadPlaylists();
});
</script>

<style lang="scss" scoped>
.recommend-playlist-page {
  width: 100%;
  min-height: 100%;
  padding-bottom: 32px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
  padding: 4px 4px 10px;

  h1 {
    margin: 4px 0 0;
    color: var(--color-text-default);
    font-size: clamp(26px, 2vw, 32px);
    line-height: 1.2;
    font-weight: 650;
    letter-spacing: -0.025em;
  }
}

.header-copy {
  min-width: 0;
}

.header-kicker {
  color: var(--color-primary);
  font-size: 10px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-shrink: 0;
}

.shuffle-btn {
  height: 34px;
  border-radius: 5px;
  padding: 0 18px;
}

.filter-tabs {
  display: flex;
  align-items: center;
  gap: 2px;

  button {
    border: 0;
    padding: 6px 13px;
    color: var(--color-text-secondary);
    font-size: 14px;
    background: transparent;
    cursor: pointer;
    transition: color 0.18s ease;

    &:hover,
    &.active {
      color: var(--color-primary);
    }
  }
}

.empty-state {
  margin-top: 80px;
}

@media (max-width: 820px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
