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

    <div class="toolbar batch-operation-toolbar">
      <div class="toolbar-left">
        <template v-if="!isBatchMode">
          <n-button data-batch-play-all v-if="activeTab === 'songs'" round type="primary" :disabled="!filteredSongs.length" @click="playAll">
            <template #icon><n-icon :component="Play" /></template>播放全部
          </n-button>
          <n-button data-batch-trigger round secondary :disabled="!currentItemsCount" @click="enterBatchMode">
            <template #icon><n-icon :component="SquarePen" /></template>多选
          </n-button>
        </template>
        <div ref="batchToolbarTarget" v-show="isBatchMode" class="favorite-batch-target">
          <template v-if="isBatchMode && activeTab === 'playlists'">
            <BatchSegmentedActions :actions="playlistActions" @action="handlePlaylistAction" />
            <span class="selected-count">已选择 {{ selectedKeys.size }} 个歌单</span>
          </template>
        </div>
      </div>
      <n-input v-model:value="searchKey" class="favorite-search" :class="{ focused: searchFocused || searchKey }" clearable placeholder="搜索" @focus="searchFocused = true" @blur="searchFocused = false">
        <template #prefix><n-icon :component="Search" /></template>
      </n-input>
    </div>

    <div class="favorite-content" @wheel.passive="handleScrollableContentWheel">
      <SongList
        v-if="activeTab === 'songs' && (songs.length || isBatchMode)"
        ref="songListRef" batch-external :batch-toolbar-target="batchToolbarTarget" @batch-mode-change="isBatchMode = $event"
        :songs="songs"
        :search-key="searchKey"
        :min-size="64"
        batch-enabled
        batch-context="favorites"
        show-footer
        show-header
        @scroll="handleScrollableContentScroll"
        @scroll-to-top="handleScrollableContentTop" />

      <PlaylistCollect
        v-else-if="activeTab === 'playlists' && (filteredPlaylists.length || isBatchMode)"
        :playlist="filteredPlaylists"
        :selectable="isBatchMode"
        :selected-keys="selectedKeys"
        @toggle-select="toggleSelectPlaylist" @context-select="openPlaylistBatchContext" />

      <n-empty v-else class="empty-state" description="暂无收藏内容" />
    </div>
    <AppConfirmDialog ref="confirmDialogRef" />
    <n-dropdown :show="playlistBatchMenu.show" :x="playlistBatchMenu.x" :y="playlistBatchMenu.y" trigger="manual" :options="[{ key: 'remove', label: '取消收藏所选歌单' }]" @clickoutside="playlistBatchMenu.show = false" @select="playlistBatchMenu.show = false; handleBatchDelete()" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { NButton, NDropdown, NEmpty, NIcon, NInput } from "naive-ui";
import { SquarePen, Play, Search, Trash2, ListChecks, ArrowLeftRight, LogOut, Square } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import PlaylistCollect from "@/components/list/PlaylistCollect.vue";
import { useBatchToolbarMorph } from "@/composables/useBatchToolbarMorph";
import BatchSegmentedActions from "@/components/batch/BatchSegmentedActions.vue";
import SongList from "@/components/list/SongList.vue";
import AppConfirmDialog from "@/components/common/AppConfirmDialog.vue";
import { useCollectStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { useCollapsiblePageHeader } from "@/composables/useCollapsiblePageHeader";
import type { CommonPlaylist } from "@/types/song";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";
import { runBatchAction } from "@/batch/BatchActionCoordinator";
import { useBatchSelection } from "@/composables/useBatchSelection";

const playbackCommands = usePlaybackCommands();
const collector = useCollectStore();
const { songs, playlists } = storeToRefs(collector);

const activeTab = ref<"songs" | "playlists">("songs");
const searchKey = ref("");
const searchFocused = ref(false);
const isBatchMode = ref(false);
const batchToolbarTarget = ref<HTMLElement | null>(null);
const batchMorph = useBatchToolbarMorph(isBatchMode, batchToolbarTarget);
const songListRef = ref<InstanceType<typeof SongList> | null>(null);
const selectedKeys = ref<Set<string>>(new Set());
const isBatchDeleting = ref(false);
const playlistBatchMenu = ref({ show: false, x: 0, y: 0 });
let deleteController: AbortController | undefined;
const stopIdentity = onLibraryIdentityChanged(() => { deleteController?.abort(); selectedKeys.value = new Set(); isBatchMode.value = false; playlistBatchMenu.value.show = false; });
onBeforeUnmount(() => { deleteController?.abort(); stopIdentity(); });

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
const playlistSelection = useBatchSelection(playlists, filteredPlaylists, selectedKeys);
watch(playlists, items => {
  const available = new Set(items.map(item => `${item.source}:${item.id}`));
  selectedKeys.value = new Set([...selectedKeys.value].filter(key => available.has(key)));
});

const playlistActions = computed(() => [
  { key: "all", label: "全选", icon: ListChecks, disabled: isBatchDeleting.value },
  { key: "invert", label: "反选", icon: ArrowLeftRight, disabled: isBatchDeleting.value },
  { key: "remove", label: "移除", icon: Trash2, disabled: !selectedKeys.value.size || isBatchDeleting.value },
  { key: "exit", label: isBatchDeleting.value ? "停止后续操作" : "退出", icon: isBatchDeleting.value ? Square : LogOut },
]);
function handlePlaylistAction(key: string) {
  if (key === "exit") { if (isBatchDeleting.value) deleteController?.abort(); else exitBatchMode(); return; }
  if (isBatchDeleting.value) return;
  if (key === "all") playlistSelection.selectVisible(true);
  else if (key === "invert") playlistSelection.invertVisible();
  else if (key === "remove") void handleBatchDelete();
}

function enterBatchMode(event: MouseEvent) {
  batchMorph.captureOrigin(event);
  if (activeTab.value === "songs") { void songListRef.value?.enterBatch(); return; }
  isBatchMode.value = true;
  playlistSelection.clear();
}

function exitBatchMode() {
  songListRef.value?.exitBatch();
  isBatchMode.value = false;
  playlistSelection.clear();
  playlistBatchMenu.value.show = false;
}

function toggleSelectPlaylist(playlist: CommonPlaylist, event?: MouseEvent) {
  if (!isBatchDeleting.value) playlistSelection.toggle(playlist, event);
}
function openPlaylistBatchContext(playlist: CommonPlaylist, event: MouseEvent) {
  if (isBatchDeleting.value) return;
  playlistSelection.selectForContext(playlist);
  playlistBatchMenu.value = { show: true, x: event.clientX, y: event.clientY };
}


async function handleBatchDelete() {
  if (isBatchDeleting.value) return;
  const revision = await captureLibraryRevision();
  const targets = JSON.parse(JSON.stringify(playlists.value.filter(p => selectedKeys.value.has(`${p.source}:${p.id}`)))) as CommonPlaylist[];
  const count = targets.length;
  if (!count) return;
  const typeText = activeTab.value === "songs" ? "首歌曲" : "个歌单";

  const confirmed = await confirmDialogRef.value?.open({
    title: "提示",
    content: `确定要执行此操作吗？将取消收藏选中的 ${count} ${typeText}，执行后将无法撤回。`,
    confirmText: "确认",
    cancelText: "取消",
    confirmColor: "#ff4d4f",
  });

  if (!confirmed || !isCurrentLibraryRevision(revision)) return;

  isBatchDeleting.value = true;
  deleteController = new AbortController();
  try {
    const result = await runBatchAction(targets, async playlist => {
      if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化");
      const payload = { source: playlist.source, id: playlist.id, identityRevision: revision };
      return await window.electronAPI.removeFavoritePlaylist(payload) ? "succeeded" : "skipped";
    }, { signal: deleteController.signal });
    if (!isCurrentLibraryRevision(revision)) return;
    await collector.reload();
    window.$message?.info?.(`已取消 ${result.succeeded} 个，跳过 ${result.skipped} 个，失败 ${result.failed} 个，未执行 ${result.unexecuted} 个`);
    playlistBatchMenu.value.show = false;
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
  if (isBatchDeleting.value) return;
  if (activeTab.value !== tab) {
    batchMorph.reset();
    exitBatchMode();
  }
  activeTab.value = tab;
  expandHeader();
}

watch(searchKey, () => {
  expandHeader();
});

</script>

<style lang="scss" scoped>
.favorite-batch-target { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.selected-count { color: var(--text-secondary); font-size: 12px; white-space: nowrap; }
.toolbar-left { min-width: 0; flex-wrap: wrap; }
.favorite-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
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
    color: var(--text-primary);
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
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  transition: color 0.2s ease;

  span {
    margin-left: 4px;
    font-size: 14px;
  }

  &:hover {
    color: var(--color-primary-hover);
  }

  &.active {
    color: var(--color-primary);
    font-weight: 600;
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
  border-radius: var(--radius-pill);
  background: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
  color: #fff !important;

  &:hover:not(:disabled) {
    background: var(--color-primary-hover) !important;
    border-color: var(--color-primary-hover) !important;
  }
}

.batch-btn,
.exit-batch-btn,
.batch-delete-btn {
  height: 40px;
  border-radius: var(--radius-pill);
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
