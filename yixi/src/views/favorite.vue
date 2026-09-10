<template>
  <div class="favorite-page">
    <div class="favorite-header" :class="{ collapsed: isHeaderCollapsed }">
      <h1>我的收藏</h1>
      <div class="favorite-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'songs' }"
          @click="switchFavoriteTab('songs')">
          单曲 <span>{{ songs.length }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'playlists' }"
          @click="switchFavoriteTab('playlists')">
          歌单 <span>{{ playlists.length }}</span>
        </button>
      </div>
    </div>

    <div class="toolbar">
      <!-- 常规模式工具栏 -->
      <template v-if="!isBatchMode">
        <div class="toolbar-left">
          <n-button
            type="primary"
            class="play-all"
            :disabled="activeTab !== 'songs' || filteredSongs.length === 0"
            @click="playAll">
            <template #icon>
              <n-icon :component="Play" />
            </template>
            播放全部
          </n-button>
        </div>

        <div class="toolbar-right">
          <n-button
            secondary
            class="batch-btn"
            :disabled="currentItemsCount === 0"
            @click="enterBatchMode">
            <template #icon>
              <n-icon :component="CheckSquare" />
            </template>
            批量管理
          </n-button>

          <n-input
            v-model:value="searchKey"
            class="favorite-search"
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
      </template>

      <!-- 批量模式工具栏 -->
      <template v-else>
        <div class="toolbar-left batch-actions">
          <n-checkbox
            :checked="isAllSelected"
            :indeterminate="isIndeterminate"
            @update:checked="toggleSelectAll">
            全选
          </n-checkbox>

          <span class="selected-count">
            已选择 <strong>{{ selectedKeys.size }}</strong> {{ activeTab === 'songs' ? '首歌曲' : '个歌单' }}
          </span>

          <n-button
            type="error"
            secondary
            class="batch-delete-btn"
            :disabled="selectedKeys.size === 0"
            :loading="isBatchDeleting"
            @click="handleBatchDelete">
            <template #icon>
              <n-icon :component="Trash2" />
            </template>
            取消收藏
          </n-button>
        </div>

        <div class="toolbar-right">
          <n-button
            secondary
            class="exit-batch-btn"
            @click="exitBatchMode">
            退出管理
          </n-button>

          <n-input
            v-model:value="searchKey"
            class="favorite-search"
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
      </template>
    </div>

    <div class="favorite-content" @wheel.passive="handleScrollableContentWheel">
      <SongList
        v-if="activeTab === 'songs' && filteredSongs.length"
        :songs="filteredSongs"
        :min-size="64"
        :selectable="isBatchMode"
        :selected-keys="selectedKeys"
        show-footer
        show-header
        @toggle-select="toggleSelectSong"
        @select-all="toggleSelectAll"
        @scroll="handleScrollableContentScroll"
        @scroll-to-top="handleScrollableContentTop" />

      <PlaylistCollect
        v-else-if="activeTab === 'playlists' && filteredPlaylists.length"
        :playlist="filteredPlaylists"
        :selectable="isBatchMode"
        :selected-keys="selectedKeys"
        @toggle-select="toggleSelectPlaylist" />

      <n-empty v-else class="empty-state" description="暂无收藏内容" />
    </div>
    <AppConfirmDialog ref="confirmDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NCheckbox, NEmpty, NIcon, NInput } from "naive-ui";
import { CheckSquare, Play, Search, Trash2 } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import PlaylistCollect from "@/components/list/PlaylistCollect.vue";
import SongList from "@/components/list/SongList.vue";
import AppConfirmDialog from "@/components/common/AppConfirmDialog.vue";
import { useCollectStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { useCollapsiblePageHeader } from "@/composables/useCollapsiblePageHeader";
import type { CommonPlaylist, Song } from "@/types/song";

const playbackCommands = usePlaybackCommands();
const collector = useCollectStore();
const { songs, playlists } = storeToRefs(collector);

const activeTab = ref<"songs" | "playlists">("songs");
const searchKey = ref("");
const searchFocused = ref(false);
const isBatchMode = ref(false);
const selectedKeys = ref<Set<string>>(new Set());
const isBatchDeleting = ref(false);

const confirmDialogRef = ref<InstanceType<typeof AppConfirmDialog> | null>(null);

const {
  isHeaderCollapsed,
  expandHeader,
  handleScrollableContentScroll,
  handleScrollableContentTop,
  handleScrollableContentWheel,
} = useCollapsiblePageHeader();

const normalizedSearch = computed(() => searchKey.value.trim().toLowerCase());

const filteredSongs = computed(() => {
  const keyword = normalizedSearch.value;
  if (!keyword) return songs.value;
  return songs.value.filter((song) =>
    [song.name, song.singer, song.album]
      .filter(Boolean)
      .some((text) => text.toLowerCase().includes(keyword))
  );
});

const filteredPlaylists = computed(() => {
  const keyword = normalizedSearch.value;
  if (!keyword) return playlists.value;
  return playlists.value.filter((playlist) =>
    [playlist.name, playlist.desc, playlist.source]
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(keyword))
  );
});

const currentItemsCount = computed(() => {
  return activeTab.value === "songs" ? filteredSongs.value.length : filteredPlaylists.value.length;
});

const isAllSelected = computed(() => {
  if (!currentItemsCount.value) return false;
  if (activeTab.value === "songs") {
    return filteredSongs.value.every((s) => selectedKeys.value.has(`${s.source}:${s.id}`));
  } else {
    return filteredPlaylists.value.every((p) => selectedKeys.value.has(`${p.source}:${p.id}`));
  }
});

const isIndeterminate = computed(() => {
  if (!selectedKeys.value.size) return false;
  return !isAllSelected.value;
});

function enterBatchMode() {
  isBatchMode.value = true;
  selectedKeys.value = new Set();
}

function exitBatchMode() {
  isBatchMode.value = false;
  selectedKeys.value = new Set();
}

function toggleSelectSong(song: Song) {
  const key = `${song.source}:${song.id}`;
  const next = new Set(selectedKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  selectedKeys.value = next;
}

function toggleSelectPlaylist(playlist: CommonPlaylist) {
  const key = `${playlist.source}:${playlist.id}`;
  const next = new Set(selectedKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  selectedKeys.value = next;
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedKeys.value = new Set();
  } else {
    const next = new Set<string>();
    if (activeTab.value === "songs") {
      filteredSongs.value.forEach((s) => next.add(`${s.source}:${s.id}`));
    } else {
      filteredPlaylists.value.forEach((p) => next.add(`${p.source}:${p.id}`));
    }
    selectedKeys.value = next;
  }
}

async function handleBatchDelete() {
  const count = selectedKeys.value.size;
  if (!count) return;
  const typeText = activeTab.value === "songs" ? "首歌曲" : "个歌单";

  const confirmed = await confirmDialogRef.value?.open({
    title: "提示",
    content: `确定要执行此操作吗？将取消收藏选中的 ${count} ${typeText}，执行后将无法撤回。`,
    confirmText: "确认",
    cancelText: "取消",
    confirmColor: "#ff4d4f",
  });

  if (!confirmed) return;

  isBatchDeleting.value = true;
  try {
    if (activeTab.value === "songs") {
      const targets = songs.value.filter((s) => selectedKeys.value.has(`${s.source}:${s.id}`));
      await collector.batchRemoveSongs(targets);
    } else {
      const targets = playlists.value.filter((p) => selectedKeys.value.has(`${p.source}:${p.id}`));
      await collector.batchRemovePlaylists(targets);
    }
    window.$message?.success?.(`已取消收藏 ${count} ${typeText}`);
    exitBatchMode();
  } catch (error: any) {
    window.$message?.error?.(`批量取消收藏失败：${error?.message || error}`);
  } finally {
    isBatchDeleting.value = false;
  }
}

function playAll() {
  if (!filteredSongs.value.length) return;
  playbackCommands.playAll(filteredSongs.value);
}

function switchFavoriteTab(tab: "songs" | "playlists") {
  if (activeTab.value !== tab) {
    exitBatchMode();
  }
  activeTab.value = tab;
  expandHeader();
}

watch(searchKey, () => {
  selectedKeys.value = new Set();
  expandHeader();
});

</script>

<style lang="scss" scoped>
.favorite-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: #30343b;
}

.favorite-header {
  max-height: 120px;
  overflow: hidden;
  opacity: 1;
  transform: translateY(0);
  transition:
    max-height 0.28s ease,
    opacity 0.2s ease,
    transform 0.28s ease;

  &.collapsed {
    max-height: 0;
    opacity: 0;
    transform: translateY(-10px);
    pointer-events: none;
  }

  h1 {
    margin: 0 0 22px;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 0;
  }
}

.favorite-tabs {
  display: flex;
  align-items: center;
  gap: 48px;
  margin-bottom: 26px;
}

.tab-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: #7d838c;
  font-size: 18px;
  cursor: pointer;
  transition: color 0.2s ease;

  span {
    margin-left: 4px;
    font-size: 14px;
  }

  &.active {
    color: #087bff;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
  gap: 16px;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 16px;

    &.batch-actions {
      display: flex;
      align-items: center;
      gap: 20px;

      .selected-count {
        font-size: 14px;
        color: var(--color-text-secondary);

        strong {
          color: var(--color-primary);
          font-weight: 700;
        }
      }
    }
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.play-all {
  min-width: 108px;
  height: 40px;
  border-radius: 6px;
  background: #087bff;
}

.batch-btn,
.exit-batch-btn,
.batch-delete-btn {
  height: 40px;
  border-radius: 8px;
}

.favorite-search {
  width: 92px;
  transition: width 0.25s ease;

  &.focused {
    width: 220px;
  }
}

.favorite-content {
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
