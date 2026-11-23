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
        v-else-if="missingThirdPartyLogin"
        class="empty-state"
        description="登录三方账号后可拉取并导入歌单"
      >
        <template #extra>
          <n-button type="primary" round @click="emit('goAccount')">去登录</n-button>
        </template>
      </n-empty>

      <n-empty
        v-else
        class="empty-state"
        :description="store.playlistError || '暂无歌单内容'"
      />
    </div>

    <CreatePlaylistDialog ref="createDialogRef" />
    <PlaylistEditDialog ref="editDialogRef" />
    <ThirdPartyPlaylistImportModal
      ref="importModalRef"
      @go-account="emit('goAccount')"
    />
    <n-dropdown
      :show="batchMenu.show"
      :x="batchMenu.x"
      :y="batchMenu.y"
      trigger="manual"
      :options="[{ key: 'delete', label: '删除/移除所选歌单' }]"
      @clickoutside="batchMenu.show = false"
      @select="batchMenu.show = false; deleteSelected()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { NButton, NDropdown, NEmpty } from "naive-ui";
import {
  ArrowLeftRight,
  Download,
  ListChecks,
  ListMusic,
  LogOut,
  Plus,
  Square,
  SquarePen,
  Trash2,
} from "lucide-vue-next";
import { KGIcon, ListUnorderedIcon, NeteaseIcon } from "@/icons";
import type { CommonPlaylist } from "@/types/song";
import PlaylistEditDialog from "./PlaylistEditDialog.vue";
import ThirdPartyPlaylistImportModal from "./ThirdPartyPlaylistImportModal.vue";
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
import { useCookieAccountStatus } from "@/composables/useCookieAccountStatus";
import { runBatchAction } from "@/batch/BatchActionCoordinator";
import {
  captureLibraryRevision,
  isCurrentLibraryRevision,
  onLibraryIdentityChanged,
} from "@/utils/libraryIdentity";

type PlaylistFilter = "all" | "local" | "kg" | "wy";

const store = useMineLibraryStore();
const { accounts } = useCookieAccountStatus();
const { confirmDelete } = usePlaylistManagement();
const editDialogRef = ref<InstanceType<typeof PlaylistEditDialog> | null>(null);
const createDialogRef = ref<InstanceType<typeof CreatePlaylistDialog> | null>(null);
const importModalRef = ref<InstanceType<typeof ThirdPartyPlaylistImportModal> | null>(null);
const activeSource = ref<PlaylistFilter>("all");
const searchKey = ref("");

const emit = defineEmits<{
  scroll: [event: Event];
  expandHeader: [];
  goAccount: [];
}>();

const sourceActions = computed<SegmentedActionItem[]>(() => [
  {
    key: "all",
    label: "全部",
    icon: ListUnorderedIcon,
    active: activeSource.value === "all",
    primary: activeSource.value === "all",
    disabled: batchBusy.value,
  },
  {
    key: "local",
    label: "自建",
    icon: ListMusic,
    iconColor: "#18a058",
    active: activeSource.value === "local",
    primary: activeSource.value === "local",
    disabled: batchBusy.value,
  },
  {
    key: "kg",
    label: "KG",
    icon: KGIcon,
    iconColor: "#1296DB",
    active: activeSource.value === "kg",
    primary: activeSource.value === "kg",
    disabled: batchBusy.value,
  },
  {
    key: "wy",
    label: "WY",
    icon: NeteaseIcon,
    iconColor: "#d71920",
    active: activeSource.value === "wy",
    primary: activeSource.value === "wy",
    disabled: batchBusy.value,
  },
]);

const batchMode = ref(false);
const batchBusy = ref(false);
const batchToolbarTarget = ref<HTMLElement | null>(null);
const batchMorph = useBatchToolbarMorph(batchMode, batchToolbarTarget);
const batchMenu = ref({ show: false, x: 0, y: 0 });
let batchController: AbortController | undefined;

const normalizedSearch = computed(() => searchKey.value.trim().toLowerCase());

const missingThirdPartyLogin = computed(() => {
  if (batchMode.value) return false;
  if (activeSource.value === "kg") return !accounts.kg.loggedIn;
  if (activeSource.value === "wy") return !accounts.wy.loggedIn;
  return false;
});

const sourcePlaylists = computed(() =>
  store.getPlaylistsBySource(activeSource.value)
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
  () => store.playlists,
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
    key: "import",
    label: "导入歌单",
    icon: Download,
    loading: store.candidatePulling,
    disabled: batchBusy.value || store.candidatePulling,
  },
  {
    key: "batch",
    label: "多选",
    icon: SquarePen,
    disabled: batchBusy.value || !store.playlists.length,
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
  if (batchBusy.value) return;
  const next = key as PlaylistFilter;
  if (next === activeSource.value) return;
  activeSource.value = next;
  emit("expandHeader");
}

function handleDefaultAction(key: string, event: MouseEvent) {
  if (key === "add") {
    createDialogRef.value?.open();
  } else if (key === "import") {
    void handleOpenImportModal();
  } else if (key === "batch") {
    if (batchBusy.value || !store.playlists.length) return;
    batchMorph.captureOrigin(event);
    selection.clear();
    batchMode.value = true;
    batchMenu.value.show = false;
  }
}

async function handleOpenImportModal() {
  if (batchBusy.value || store.candidatePulling) return;
  await store.loadCandidateCache();
  if (store.hasCandidateCache) {
    importModalRef.value?.open();
    return;
  }

  if (!accounts.kg.loggedIn && !accounts.wy.loggedIn) {
    window.$message.warning("请先登录酷狗或网易云账号后再拉取导入歌单");
    emit("goAccount");
    return;
  }

  try {
    await store.pullCandidatePlaylists();
    importModalRef.value?.open();
  } catch (error) {
    window.$message.error(
      error instanceof Error ? error.message : "拉取三方歌单失败，请检查账号登录状态"
    );
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
    title: "删除/移除所选歌单？",
    content: `将删除或移除所选的 ${targets.length} 个歌单（不删除本地音频文件，不影响第三方平台原歌单）。`,
    positiveText: "确认",
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
          `已移除 ${result.succeeded}，跳过 ${result.skipped}，失败 ${result.failed}，未执行 ${result.unexecuted}。`
        );
        selection.clear();
      } catch (error) {
        if (isCurrentLibraryRevision(revision)) {
          window.$message.error(
            error instanceof Error ? error.message : "批量移除失败"
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
