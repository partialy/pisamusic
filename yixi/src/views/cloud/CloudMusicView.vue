<template>
  <div class="cloud-music-page">
    <div class="cloud-header" :class="{ collapsed: isHeaderCollapsed }">
      <h1>共享云盘</h1>
      <p class="subtitle">汇聚分享，独立音源曲库</p>
    </div>

    <div class="overview-section" v-if="!isHeaderCollapsed">
      <CloudOverviewCard
        :total="summary.total"
        :latest-updated-at="summary.latestUpdatedAt" />
    </div>

    <div class="toolbar">
      <n-button
        type="primary"
        class="play-all"
        :disabled="songs.length === 0 || loading"
        @click="handlePlayAll">
        <template #icon>
          <n-icon :component="Play" />
        </template>
        播放全部
      </n-button>

      <div class="toolbar-right">
        <n-input
          v-model:value="searchInput"
          class="cloud-search"
          :class="{ focused: searchFocused || searchInput }"
          round
          clearable
          placeholder="搜索云盘歌曲"
          @update:value="onSearchInput"
          @focus="searchFocused = true"
          @blur="searchFocused = false">
          <template #prefix>
            <n-icon :component="Search" />
          </template>
        </n-input>

        <n-button
          quaternary
          circle
          class="refresh-btn"
          title="刷新云盘"
          :loading="loading"
          @click="refresh">
          <template #icon>
            <n-icon :component="RotateCw" />
          </template>
        </n-button>
      </div>
    </div>

    <div class="cloud-content" @wheel.passive="handleScrollableContentWheel">
      <SongList
        v-if="songs.length > 0 || loading"
        :songs="songs"
        :loading="loading && songs.length === 0"
        :has-more="hasMore"
        :min-size="64"
        show-footer
        show-header
        @scroll="handleScrollableContentScroll"
        @scroll-to-top="handleScrollableContentTop"
        @scroll-to-bottom="loadMore" />

      <div v-else-if="errorMessage" class="error-state">
        <p class="error-text">{{ errorMessage }}</p>
        <n-button type="primary" size="small" round @click="refresh">重试</n-button>
      </div>

      <n-empty
        v-else
        class="empty-state"
        :description="searchInput ? '未找到相关云盘歌曲' : '共享云盘暂无歌曲'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NButton, NEmpty, NIcon, NInput } from "naive-ui";
import { Play, RotateCw, Search } from "lucide-vue-next";
import CloudOverviewCard from "@/components/cloud/CloudOverviewCard.vue";
import SongList from "@/components/list/SongList.vue";
import { useCloudMusicList } from "@/cloud/useCloudMusicList";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { useCollapsiblePageHeader } from "@/composables/useCollapsiblePageHeader";

const {
  summary,
  songs,
  loading,
  hasMore,
  errorMessage,
  setKeyword,
  loadMore,
  refresh,
} = useCloudMusicList();

const playbackCommands = usePlaybackCommands();
const searchInput = ref("");
const searchFocused = ref(false);

const {
  isHeaderCollapsed,
  handleScrollableContentScroll,
  handleScrollableContentTop,
  handleScrollableContentWheel,
} = useCollapsiblePageHeader();

function onSearchInput(val: string) {
  setKeyword(val);
}

function handlePlayAll() {
  if (songs.value.length === 0) return;
  void playbackCommands.playAll(songs.value, true);
}

onMounted(() => {
  void refresh();
});
</script>

<style scoped lang="scss">
.cloud-music-page {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.cloud-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
  transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top;

  h1 {
    font-size: 26px;
    font-weight: 800;
    color: var(--color-text-default);
    line-height: 1.2;
    margin: 0;
  }

  .subtitle {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 0;
  }

  &.collapsed {
    max-height: 0;
    opacity: 0;
    margin-bottom: 0;
    padding: 0;
    overflow: hidden;
    transform: translateY(-8px) scaleY(0.92);
    pointer-events: none;
  }
}

.overview-section {
  width: 100%;
  margin-bottom: 14px;
  transition: all 0.25s ease;
  box-sizing: border-box;
}

.toolbar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.play-all {
  font-weight: 600;
  padding: 0 20px;
  border-radius: 20px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cloud-search {
  width: 220px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &.focused {
    width: 280px;
  }
}

.refresh-btn {
  color: var(--color-text-secondary);

  &:hover {
    color: var(--color-primary);
  }
}

.cloud-content {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
}

.error-text {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.empty-state {
  margin-top: 60px;
}
</style>
