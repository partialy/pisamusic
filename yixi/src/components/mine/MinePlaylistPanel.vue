<template>
  <div class="mine-playlist-panel">
    <div class="toolbar">
      <n-tabs v-if="!batchMode" v-model:value="activeSource" type="segment" size="small" class="source-tabs">
        <n-tab-pane name="all" tab="全部" />
        <n-tab-pane name="local" tab="自建" />
        <n-tab-pane name="kg" tab="KG" />
        <n-tab-pane name="wy" tab="WY" />
      </n-tabs>
      <span v-else>自建歌单批量管理</span>
      <div class="toolbar-actions">
        <n-button secondary round :disabled="batchBusy || !store.localPlaylists.length" @click="toggleBatch">{{ batchMode ? '退出批量' : '批量管理自建歌单' }}</n-button>
        <n-button secondary round @click="createDialogRef?.open()">
          <template #icon>
            <n-icon :component="Plus" />
          </template>
          添加
        </n-button>
        <n-button secondary round :loading="store.playlistRefreshing" @click="store.refreshPlaylists(true)">
          <template #icon>
            <n-icon :component="RefreshCw" />
          </template>
          刷新
        </n-button>
      </div>
    </div>
    <div v-if="batchMode" class="playlist-batch-actions">
      <span>已选择 {{ selection.count.value }} 个</span>
      <n-button round size="small" :disabled="batchBusy" @click="selection.selectVisible(true)">全选</n-button>
      <n-button round size="small" :disabled="batchBusy" @click="selection.invertVisible">反选</n-button>
      <n-button round size="small" type="error" :disabled="batchBusy || !selection.count.value" @click="deleteSelected">删除所选</n-button>
      <n-button v-if="batchBusy" round size="small" @click="batchController?.abort()">停止后续删除</n-button>
    </div>

    <div v-if="filteredPlaylists.length" class="playlist-grid" @scroll="emit('scroll', $event)">
      <article
        v-for="playlist in filteredPlaylists"
        :key="`${playlist.source}:${playlist.id}`"
        class="playlist-card"
        tabindex="0"
        @keydown.enter.self="activatePlaylist(playlist, $event)"
        @click="activatePlaylist(playlist, $event)"
        @contextmenu.stop="openContextMenu($event, playlist)">
        <div class="cover-wrap">
          <n-checkbox v-if="batchMode" class="playlist-checkbox" :checked="selection.selectedKeys.value.has(`${playlist.source}:${playlist.id}`)" :disabled="batchBusy" @click.stop @update:checked="selection.toggle(playlist)" />
          <img :src="getPlaylistCover(playlist, 480)" :alt="playlist.name" @error="playlistCoverFallback($event, playlist)" />
          <span class="source-badge">{{ sourceLabel(playlist.source) }}</span>
          <span class="song-count">{{ playlist.song_count || 0 }} 首</span>
        </div>
        <div class="playlist-info">
          <div class="playlist-name" :title="playlist.name">{{ playlist.name }}</div>
          <div class="playlist-desc" :title="playlist.desc">{{ playlist.desc || "暂无描述" }}</div>
          <div v-if="playlist.tags.length" class="tag-row">
            <span v-for="tag in playlist.tags.slice(0, 3)" :key="tag.id || tag.name">{{ tag.name }}</span>
          </div>
        </div>
        <div v-if="playlist.source === 'local' && !batchMode" class="management-actions" @click.stop>
          <n-button quaternary size="small" @click="editDialogRef?.open(playlist)">编辑</n-button>
          <n-button quaternary size="small" @click="confirmDelete(playlist)">删除</n-button>
          <span v-if="playlist.coverUploadStatus && playlist.coverUploadStatus.state !== 'synced'" class="upload-state" :title="playlist.coverUploadStatus.message">{{ playlist.coverUploadStatus.state === 'failed' ? '封面上传失败' : playlist.coverUploadStatus.state === 'local' ? '本机封面' : '封面待同步' }}</span>
        </div>
      </article>
      <ListEndState class="playlist-end-state" />
    </div>

    <n-empty
      v-else
      class="empty-state"
      :description="store.playlistError || '暂无歌单内容'" />

    <ContextMenu ref="contextMenuRef" />
    <CreatePlaylistDialog ref="createDialogRef" />
    <PlaylistEditDialog ref="editDialogRef" />
    <n-dropdown :show="batchMenu.show" :x="batchMenu.x" :y="batchMenu.y" trigger="manual" :options="[{ key: 'delete', label: '删除所选歌单' }]" @clickoutside="batchMenu.show = false" @select="batchMenu.show = false; deleteSelected()" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { NButton, NCheckbox, NDropdown, NEmpty, NIcon, NTabPane, NTabs } from "naive-ui";
import { Plus, RefreshCw } from "lucide-vue-next";
import type { CommonPlaylist } from "@/types/song";
import { getPlaylistCover, playlistCoverFallback } from "@/playlist/playlistCover";
import PlaylistEditDialog from "./PlaylistEditDialog.vue";
import { usePlaylistManagement } from "@/composables/usePlaylistManagement";
import { useMineLibraryStore } from "@/store";
import { useRouter } from "vue-router";
import ListEndState from "@/components/common/ListEndState.vue";
import ContextMenu from "@/components/common/ContextMenu.vue";
import CreatePlaylistDialog from "@/components/mine/CreatePlaylistDialog.vue";
import { useBatchSelection } from "@/composables/useBatchSelection";
import { runBatchAction } from "@/batch/BatchActionCoordinator";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";


type PlaylistFilter = "all" | "local" | "kg" | "wy";

const store = useMineLibraryStore();
const router = useRouter();
const { confirmDelete } = usePlaylistManagement();
const editDialogRef = ref<InstanceType<typeof PlaylistEditDialog> | null>(null);
const activeSource = ref<PlaylistFilter>("all");
const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null);
const createDialogRef = ref<InstanceType<typeof CreatePlaylistDialog> | null>(null);
const emit = defineEmits<{
  scroll: [event: Event];
}>();

const batchMode = ref(false), batchBusy = ref(false);
const batchMenu = ref({ show: false, x: 0, y: 0 });
let batchController: AbortController | undefined;
const filteredPlaylists = computed(() => batchMode.value ? store.localPlaylists : store.getPlaylistsBySource(activeSource.value));
const selection = useBatchSelection(() => store.localPlaylists, filteredPlaylists);
const stopIdentity = onLibraryIdentityChanged(() => { batchController?.abort(); selection.clear(); batchMode.value = false; batchMenu.value.show = false; });
onBeforeUnmount(() => { batchController?.abort(); stopIdentity(); });
function toggleBatch() { if (!batchBusy.value) { batchMode.value = !batchMode.value; selection.clear(); batchMenu.value.show = false; } }
function activatePlaylist(playlist: CommonPlaylist, event: MouseEvent | KeyboardEvent) {
  if (batchMode.value) { if (!batchBusy.value) selection.toggle(playlist, event); }
  else void openPlaylist(playlist);
}
async function deleteSelected() {
  if (batchBusy.value) return;
  const targets = selection.snapshot();
  if (!targets.length) return;
  const revision = await captureLibraryRevision();
  window.$dialog.warning({ title: "删除所选自建歌单？", content: `将删除 ${targets.length} 个歌单及其曲目关系，不删除音频文件。`, positiveText: "删除", negativeText: "取消", onPositiveClick: async () => {
    if (!isCurrentLibraryRevision(revision)) return false;
    batchBusy.value = true;
    batchController = new AbortController();
    try {
      const result = await runBatchAction(targets, async playlist => {
        if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化");
        const payload = { source: playlist.source, id: playlist.id, identityRevision: revision };
        return await window.electronAPI.removeUserPlaylist(payload) ? "succeeded" : "skipped";
      }, { signal: batchController.signal });
      if (!isCurrentLibraryRevision(revision)) return;
      await store.loadCache();
      window.$message.info(`已删除 ${result.succeeded}，跳过 ${result.skipped}，失败 ${result.failed}，未执行 ${result.unexecuted}。`);
      selection.clear();
    } catch (error) {
      if (isCurrentLibraryRevision(revision)) window.$message.error(error instanceof Error ? error.message : "批量删除失败");
      return false;
    } finally { batchBusy.value = false; }
  } });
}

async function openPlaylist(playlist: CommonPlaylist) {
  await router.push({
    path: "/playlist/detail",
    query: { id: playlist.id, origin: playlist.source },
  });
}

function openContextMenu(event: MouseEvent, playlist: CommonPlaylist) {
  if (batchMode.value) {
    event.preventDefault();
    if (batchBusy.value) return;
    selection.selectForContext(playlist);
    batchMenu.value = { show: true, x: event.clientX, y: event.clientY };
    return;
  }
  contextMenuRef.value?.openContextMenu(event, {
    type: "playlist",
    data: playlist,
  });
}

function sourceLabel(source: CommonPlaylist["source"]) {
  if (source === "local") return "自建";
  return source.toUpperCase();
}
</script>

<style scoped lang="scss">
.playlist-batch-actions { display: flex; align-items: center; gap: 10px; padding-bottom: 12px; }
.playlist-checkbox { position: absolute; top: 8px; left: 8px; z-index: 1; }
.mine-playlist-panel {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}

.source-tabs {
  width: 360px;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
}

.playlist-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.2rem, 1fr));
  grid-auto-rows: max-content;
  align-content: start;
  align-items: start;
  gap: 1rem;
  padding-right: 8px;
  overflow: auto;
}

.playlist-end-state {
  grid-column: 1 / -1;
}

.playlist-card {
  display: block;
  width: 100%;
  height: auto;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  overflow: hidden;
  text-align: left;
  line-height: 1.4;
  color: var(--text-primary);
  background: transparent;
  appearance: none;
  cursor: pointer;
}

.cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--radius-control);
  background: var(--surface-card);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.24s ease;
  }
}

.playlist-card:hover .cover-wrap img {
  transform: scale(1.05);
}

.source-badge,
.song-count {
  position: absolute;
  z-index: 2;
  height: 26px;
  padding: 0 9px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(12px);
}

.source-badge {
  top: 10px;
  left: 10px;
}

.song-count {
  right: 10px;
  bottom: 10px;
}

.playlist-info {
  padding: 10px 8px 4px;
}

.playlist-name,
.playlist-desc {
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-name {
  min-height: 40px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  font-weight: 700;
  color: var(--text-primary);
}

.playlist-desc {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;

  span {
    max-width: 100%;
    padding: 2px 7px;
    border-radius: 999px;
    color: var(--text-accent);
    background: var(--color-primary-10, rgba(24, 160, 88, 0.15));
    font-size: 11px;
  }
}

.management-actions { display: flex; align-items: center; gap: 4px; padding: 4px; :deep(.n-button) { border-radius: var(--radius-pill); } }
.upload-state { font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.empty-state {
  flex: 1;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}

</style>
