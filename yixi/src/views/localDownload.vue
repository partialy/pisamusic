<template>
  <div class="local-download-page">
    <div class="page-header">
      <h1>本地与下载</h1>
      <div class="page-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'local' }"
          @click="activeTab = 'local'">
          本地歌曲 <span>{{ localSongs.length }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'download' }"
          @click="activeTab = 'download'">
          下载歌曲 <span>0</span>
        </button>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <n-button
          type="primary"
          class="play-all"
          :disabled="activeTab !== 'local' || filteredLocalSongs.length === 0"
          @click="playAll">
          <template #icon>
            <n-icon :component="Play" />
          </template>
          播放全部
        </n-button>
        <n-button
          secondary
          :loading="localLibrary.scanning"
          :disabled="activeTab !== 'local'"
          @click="refreshLocalLibrary">
          <template #icon>
            <n-icon :component="RefreshCw" />
          </template>
          立即刷新
        </n-button>
      </div>

      <n-input
        v-model:value="searchKey"
        class="page-search"
        :class="{ focused: searchFocused || searchKey }"
        round
        clearable
        placeholder="搜索"
        @focus="searchFocused = true"
        @blur="searchFocused = false">
        <template #prefix>
          <n-icon :component="Search" />
        </template>
      </n-input>
    </div>

    <div v-if="activeTab === 'local' && statusText" class="scan-status">
      {{ statusText }}
    </div>

    <div class="page-content">
      <SongList
        v-if="activeTab === 'local' && filteredLocalSongs.length"
        :songs="filteredLocalSongs"
        :min-size="64"
        show-footer
        show-header />

      <n-empty
        v-else-if="activeTab === 'local'"
        class="empty-state"
        description="暂无本地歌曲" />

      <n-empty
        v-else
        class="empty-state"
        description="下载歌曲功能即将接入" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { NButton, NEmpty, NIcon, NInput } from "naive-ui";
import { Play, RefreshCw, Search } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import SongList from "@/components/list/SongList.vue";
import { useAudioStore, useLocalLibraryStore } from "@/store";
import type { Song } from "@/types/song";

const player = useAudioStore();
const localLibrary = useLocalLibraryStore();
const { songs: localSongs } = storeToRefs(localLibrary);

const activeTab = ref<"local" | "download">("local");
const searchKey = ref("");
const searchFocused = ref(false);

const normalizedSearch = computed(() => searchKey.value.trim().toLowerCase());

const filteredLocalSongs = computed(() => {
  const keyword = normalizedSearch.value;
  if (!keyword) return localSongs.value;
  return localSongs.value.filter((song) =>
    [song.name, song.singer, song.album]
      .filter(Boolean)
      .some((text) => text.toLowerCase().includes(keyword))
  );
});

const statusText = computed(() => {
  const status = localLibrary.status;
  if (status.scanning) return "正在扫描本地音乐...";
  if (status.lastError) return `扫描失败：${status.lastError}`;
  if (status.lastFinishedAt) {
    return status.skipped
      ? `本地曲库已是最新，共 ${status.total} 首`
      : `本地曲库已更新，共 ${status.total} 首`;
  }
  return "";
});

function playAll() {
  if (!filteredLocalSongs.value.length) return;
  player.switchPlayList(filteredLocalSongs.value as Song[], true);
}

async function refreshLocalLibrary() {
  await localLibrary.refresh();
}

onMounted(() => {
  void localLibrary.init();
});
</script>

<style lang="scss" scoped>
.local-download-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--color-text-default);
}

.page-header {
  h1 {
    margin: 0 0 22px;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 0;
  }
}

.page-tabs {
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

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.play-all {
  min-width: 108px;
  height: 40px;
  border-radius: 6px;
  background: var(--color-primary);
}

.page-search {
  width: 92px;
  transition: width 0.25s ease;

  &.focused {
    width: 220px;
  }
}

.scan-status {
  margin-bottom: 12px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.page-content {
  flex: 1;
  min-height: 0;
}

.empty-state {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
