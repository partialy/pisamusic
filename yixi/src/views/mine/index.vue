<template>
  <div class="mine-page">
    <div class="mine-header">
      <h1>我的</h1>
      <div class="mine-tabs">
        <button
          v-for="item in tabs"
          :key="item.key"
          class="tab-btn"
          :class="{ active: activeTab === item.key }"
          @click="activeTab = item.key">
          {{ item.label }}
          <span>{{ item.meta }}</span>
        </button>
      </div>
    </div>

    <div class="mine-content">
      <MineAccountCards v-if="activeTab === 'account'" />

      <div v-else-if="activeTab === 'kgCloud' || activeTab === 'wyCloud'" class="cloud-panel">
        <SongList
          :songs="cloudSongs"
          :min-size="64"
          show-header
          show-footer />
      </div>

      <div v-else class="playlist-panel">
        <div class="toolbar">
          <n-button
            secondary
            round
            :loading="activePlaylistState.loading"
            @click="loadActivePlaylists(true)">
            <template #icon>
              <n-icon :component="RefreshCw" />
            </template>
            刷新
          </n-button>
        </div>

        <PlaylistCollect
          v-if="activePlaylistState.items.length || activePlaylistState.loading"
          :playlist="activePlaylistState.items"
          :loading="activePlaylistState.loading" />
        <n-empty v-else class="empty-state" :description="activePlaylistState.error || '暂无歌单内容'" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { NButton, NEmpty, NIcon } from "naive-ui";
import { RefreshCw } from "lucide-vue-next";
import MineAccountCards from "@/components/mine/MineAccountCards.vue";
import SongList from "@/components/list/SongList.vue";
import PlaylistCollect from "@/components/list/PlaylistCollect.vue";
import type { CommonPlaylist, Song } from "@/types/song";
import { getCookieUserPlaylists, type CookieSource } from "@/utils/api/cookieMusicAPI";
import { convertCookieUserPlaylists } from "@/utils/cookiePlaylist";

type MineTab = "account" | "kgCloud" | "wyCloud" | "kgPlaylist" | "wyPlaylist";
type PlaylistState = {
  items: CommonPlaylist[];
  loading: boolean;
  loaded: boolean;
  error: string;
};

const activeTab = ref<MineTab>("account");
const cloudSongs = ref<Song[]>([]);
const playlistState = reactive<Record<CookieSource, PlaylistState>>({
  kg: createPlaylistState(),
  wy: createPlaylistState(),
});

const tabs = computed(() => [
  { key: "account" as const, label: "账号", meta: "2" },
  { key: "kgCloud" as const, label: "KG云盘", meta: activeTab.value === "kgCloud" ? cloudSongs.value.length : "待接入" },
  { key: "wyCloud" as const, label: "WY云盘", meta: activeTab.value === "wyCloud" ? cloudSongs.value.length : "待接入" },
  { key: "kgPlaylist" as const, label: "KG歌单", meta: playlistState.kg.items.length || "待加载" },
  { key: "wyPlaylist" as const, label: "WY歌单", meta: playlistState.wy.items.length || "待加载" },
]);

const activePlaylistSource = computed<CookieSource | null>(() => {
  if (activeTab.value === "kgPlaylist") return "kg";
  if (activeTab.value === "wyPlaylist") return "wy";
  return null;
});

const activePlaylistState = computed(() => {
  const source = activePlaylistSource.value;
  return source ? playlistState[source] : createPlaylistState();
});

watch(
  activePlaylistSource,
  (source) => {
    if (!source || playlistState[source].loaded) return;
    void loadPlaylists(source);
  },
  { immediate: true }
);

function createPlaylistState(): PlaylistState {
  return {
    items: [],
    loading: false,
    loaded: false,
    error: "",
  };
}

function loadActivePlaylists(force = false) {
  const source = activePlaylistSource.value;
  if (!source) return;
  void loadPlaylists(source, force);
}

async function loadPlaylists(source: CookieSource, force = false) {
  const state = playlistState[source];
  if (state.loading) return;
  if (state.loaded && !force) return;

  state.loading = true;
  state.error = "";
  try {
    const response = await getCookieUserPlaylists({
      source,
      page: 1,
      pageSize: 30,
    });
    state.items = convertCookieUserPlaylists(source, response);
    state.loaded = true;
  } catch (error) {
    state.items = [];
    state.loaded = false;
    state.error = error instanceof Error ? error.message : "歌单加载失败";
    window.$message.error(state.error);
  } finally {
    state.loading = false;
  }
}
</script>

<style scoped lang="scss">
.mine-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--color-text-default);
}

.mine-header {
  h1 {
    margin: 0 0 22px;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 0;
  }
}

.mine-tabs {
  display: flex;
  align-items: center;
  gap: 48px;
  margin-bottom: 26px;
}

.tab-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 18px;
  cursor: pointer;
  transition: color 0.2s ease;

  span {
    margin-left: 4px;
    font-size: 14px;
  }

  &.active {
    color: var(--color-primary);
  }
}

.mine-content {
  flex: 1;
  min-height: 0;
}

.cloud-panel,
.playlist-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.playlist-panel {
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 18px;
}

.empty-state {
  flex: 1;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
