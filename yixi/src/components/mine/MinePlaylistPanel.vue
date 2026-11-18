<template>
  <div class="mine-playlist-panel">
    <div class="toolbar batch-operation-toolbar">
      <div class="toolbar-left">
        <BatchSegmentedActions
          v-show="!batchMode"
          data-batch-trigger
          always-show-label
          aria-label="歌单操作"
          :actions="defaultActions"
          @action="handleDefaultAction"
        />
        <div ref="batchToolbarTarget" v-show="batchMode" class="playlist-batch-target">
          <BatchSegmentedActions :actions="batchActions" @action="handleBatchAction" />
          <span class="selected-count">已选择 {{ selection.count.value }} 个歌单</span>
        </div>
      </div>

      <div class="toolbar-right">
        <BatchSegmentedActions
          aria-label="歌单来源筛选"
          :actions="sourceActions"
          @action="handleSourceAction"
        />
        <ExpandableSearchInput v-model:value="searchKey" placeholder="搜索歌单" />
      </div>
    </div>

    <div class="playlist-scroll" @scroll.passive="emit('scroll', $event)">
      <template v-if="filteredPlaylists.length">
        <PlaylistCollect
          :playlist="filteredPlaylists"
          :selectable="batchMode"
          :selected-keys="selection.selectedKeys.value"
          playlist-editable
          @toggle-select="activatePlaylist"
          @context-select="openContextMenu"
          @edit-playlist="editDialogRef?.open($event)"
          @delete-playlist="confirmDelete($event)"
        />
        <ListEndState />
      </template>

      <n-empty
        v-else
        class="empty-state"
        :description="store.playlistError || '暂无歌单内容'"
      />
    </div>

    <CreatePlaylistDialog ref="createDialogRef" />
    <PlaylistEditDialog ref="editDialogRef" />
    <n-dropdown
      :show="batchMenu.show"
      :x="batchMenu.x"
      :y="batchMenu.y"
      trigger="manual"
      :options="[{ key: 'delete', label: '删除所选歌单' }]"
      @clickoutside="batchMenu.show = false"
      @select="batchMenu.show = false; deleteSelected()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { NDropdown, NEmpty } from "naive-ui";
import {
  ArrowLeftRight,
  ListChecks,
  ListMusic,
  LogOut,
  Plus,
  RefreshCw,
  Square,
  SquarePen,
  Trash2,
} from "lucide-vue-next";
import { KGIcon, ListUnorderedIcon, NeteaseIcon } from "@/icons";
import type { CommonPlaylist } from "@/types/song";
import PlaylistEditDialog from "./PlaylistEditDialog.vue";
import { usePlaylistManagement } from "@/composables/usePlaylistManagement";
import { useMineLibraryStore } from "@/store";
import CreatePlaylistDialog from "@/components/mine/CreatePlaylistDialog.vue";
import PlaylistCollect from "@/components/list/PlaylistCollect.vue";
import BatchSegmentedActions, {
  type SegmentedActionItem,
} from "@/components/batch/BatchSegmentedActions.vue";
import ExpandableSearchInput from "@/components/common/ExpandableSearchInput.vue";
import ListEndState from "@/components/common/ListEndState.vue";
import { useBatchSelection } from "@/composables/useBatchSelection";
import { useBatchToolbarMorph } from "@/composables/useBatchToolbarMorph";
import { runBatchAction } from "@/batch/BatchActionCoordinator";
import {
  captureLibraryRevision,
  isCurrentLibraryRevision,
  onLibraryIdentityChanged,
} from "@/utils/libraryIdentity";

type PlaylistFilter = "all" | "local" | "kg" | "wy";

const store = useMineLibraryStore();
const { confirmDelete } = usePlaylistManagement();
const editDialogRef = ref<InstanceType<typeof PlaylistEditDialog> | null>(null);
const createDialogRef = ref<InstanceType<typeof CreatePlaylistDialog> | null>(null);
const activeSource = ref<PlaylistFilter>("all");
const searchKey = ref("");

const emit = defineEmits<{
  scroll: [event: Event];
  expandHeader: [];
}>();

const sourceActions = computed<SegmentedActionItem[]>(() => [
  {
    key: "all",
    label: "全部",
    icon: ListUnorderedIcon,
    active: activeSource.value === "all",
    primary: activeSource.value === "all",
    disabled: batchMode.value || batchBusy.value,
  },
  {
    key: "local",
    label: "自建",
    icon: ListMusic,
    iconColor: "#18a058",
    active: activeSource.value === "local",
    primary: activeSource.value === "local",
    disabled: batchMode.value || batchBusy.value,
  },
  {
    key: "kg",
    label: "KG",
    icon: KGIcon,
    iconColor: "#1296DB",
    active: activeSource.value === "kg",
    primary: activeSource.value === "kg",
    disabled: batchMode.value || batchBusy.value,
  },
  {
    key: "wy",
    label: "WY",
    icon: NeteaseIcon,
    iconColor: "#d71920",
    active: activeSource.value === "wy",
    primary: activeSource.value === "wy",
    disabled: batchMode.value || batchBusy.value,
  },
]);

const batchMode = ref(false);
const batchBusy = ref(false);
const batchToolbarTarget = ref<HTMLElement | null>(null);
const batchMorph = useBatchToolbarMorph(batchMode, batchToolbarTarget);
const batchMenu = ref({ show: false, x: 0, y: 0 });
let batchController: AbortController | undefined;

const normalizedSearch = computed(() => searchKey.value.trim().toLowerCase());

const sourcePlaylists = computed(() =>
  batchMode.value
    ? store.localPlaylists
    : store.getPlaylistsBySource(activeSource.value)
);

const filteredPlaylists = computed(() => {
  const keyword = normalizedSearch.value;
  if (!keyword) return sourcePlaylists.value;
  return sourcePlaylists.value.filter((playlist) =>
    [playlist.name, playlist.desc, playlist.source]
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(keyword))
  );
});

const selection = useBatchSelection(
  () => store.localPlaylists,
  filteredPlaylists
);

const defaultActions = computed<SegmentedActionItem[]>(() => [
  {
    key: "add",
    label: "添加",
    icon: Plus,
    disabled: batchBusy.value,
  },
  {
    key: "refresh",
    label: "刷新",
    icon: RefreshCw,
    loading: store.playlistRefreshing,
    spinIcon: true,
    disabled: batchBusy.value,
  },
  {
    key: "batch",
    label: "多选",
    icon: SquarePen,
    disabled: batchBusy.value || !store.localPlaylists.length,
  },
]);

const batchActions = computed<SegmentedActionItem[]>(() => [
  {
    key: "all",
    label: "全选",
    icon: ListChecks,
    disabled: batchBusy.value,
  },
  {
    key: "invert",
    label: "反选",
    icon: ArrowLeftRight,
    disabled: batchBusy.value,
  },
  {
    key: "delete",
    label: "删除",
    icon: Trash2,
    disabled: !selection.count.value || batchBusy.value,
  },
  {
    key: "exit",
    label: batchBusy.value ? "停止后续操作" : "退出",
    icon: batchBusy.value ? Square : LogOut,
  },
]);

const stopIdentity = onLibraryIdentityChanged(() => {
  batchController?.abort();
  selection.clear();
  batchMorph.reset();
  batchMode.value = false;
  batchMenu.value.show = false;
});

onBeforeUnmount(() => {
  batchController?.abort();
  stopIdentity();
});

watch(searchKey, () => emit("expandHeader"));

function handleSourceAction(key: string) {
  if (batchMode.value || batchBusy.value) return;
  const next = key as PlaylistFilter;
  if (next === activeSource.value) return;
  activeSource.value = next;
  emit("expandHeader");
}

function handleDefaultAction(key: string, event: MouseEvent) {
  if (key === "add") {
    createDialogRef.value?.open();
  } else if (key === "refresh") {
    void store.refreshPlaylists(true);
  } else if (key === "batch") {
    if (batchBusy.value || !store.localPlaylists.length) return;
    batchMorph.captureOrigin(event);
    selection.clear();
    batchMode.value = true;
    batchMenu.value.show = false;
  }
}

function handleBatchAction(key: string) {
  if (key === "exit") {
    if (batchBusy.value) {
      batchController?.abort();
    } else {
      batchMode.value = false;
      selection.clear();
      batchMenu.value.show = false;
    }
    return;
  }
  if (batchBusy.value) return;
  if (key === "all") selection.selectVisible(true);
  else if (key === "invert") selection.invertVisible();
  else if (key === "delete") void deleteSelected();
}

function activatePlaylist(playlist: CommonPlaylist, event?: MouseEvent) {
  if (batchMode.value && !batchBusy.value) {
    selection.toggle(playlist, event);
  }
}

function openContextMenu(playlist: CommonPlaylist, event: MouseEvent) {
  if (!batchMode.value || batchBusy.value) return;
  selection.selectForContext(playlist);
  batchMenu.value = { show: true, x: event.clientX, y: event.clientY };
}

async function deleteSelected() {
  if (batchBusy.value) return;
  const targets = selection.snapshot();
  if (!targets.length) return;
  const revision = await captureLibraryRevision();
  window.$dialog.warning({
    title: "删除所选自建歌单？",
    content: `将删除 ${targets.length} 个歌单及其曲目关系，不删除音频文件。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      if (!isCurrentLibraryRevision(revision)) return false;
      batchBusy.value = true;
      batchController = new AbortController();
      try {
        const result = await runBatchAction(
          targets,
          async (playlist) => {
            if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化");
            const payload = {
              source: playlist.source,
              id: playlist.id,
              identityRevision: revision,
            };
            return (await window.electronAPI.removeUserPlaylist(payload))
              ? "succeeded"
              : "skipped";
          },
          { signal: batchController.signal }
        );
        if (!isCurrentLibraryRevision(revision)) return;
        await store.loadCache();
        window.$message.info(
          `已删除 ${result.succeeded}，跳过 ${result.skipped}，失败 ${result.failed}，未执行 ${result.unexecuted}。`
        );
        selection.clear();
      } catch (error) {
        if (isCurrentLibraryRevision(revision)) {
          window.$message.error(
            error instanceof Error ? error.message : "批量删除失败"
          );
        }
        return false;
      } finally {
        batchBusy.value = false;
      }
    },
  });
}
</script>

<style scoped lang="scss">
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

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.playlist-batch-target {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.selected-count {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.playlist-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.empty-state {
  height: 100%;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
