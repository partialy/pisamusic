<template>
  <div class="mine-download-panel">
    <div class="toolbar batch-operation-toolbar">
      <div class="toolbar-left">
        <BatchSegmentedActions
          v-show="!isBatchMode"
          data-batch-trigger
          always-show-label
          aria-label="下载管理操作"
          :actions="defaultActions"
          @action="handleDefaultAction"
        />
        <div ref="batchToolbarTarget" v-show="isBatchMode" class="batch-toolbar-target" />
      </div>
      <div class="toolbar-right">
        <BatchSegmentedActions
          aria-label="下载记录切换"
          :actions="subTabActions"
          @action="handleSubTabAction"
        />
        <ExpandableSearchInput v-model:value="searchKey" placeholder="搜索歌名、歌手" />
      </div>
    </div>

    <n-alert v-if="loadError" type="error" class="feedback" :bordered="false">
      {{ loadError }}，可点击刷新重试。
    </n-alert>
    <n-alert v-if="actionMessage" type="info" class="feedback" closable :bordered="false" @close="actionMessage = ''">
      {{ actionMessage }}
    </n-alert>
    <n-alert v-if="deleteResult" type="info" class="feedback" closable :bordered="false" @close="deleteResult = null">
      删除结果：移除记录 {{ deleteResult.recordsRemoved }}；删除文件 {{ deleteResult.filesDeleted }}；共享跳过 {{ deleteResult.sharedSkipped }}；占用 {{ deleteResult.occupied }}；失败 {{ deleteResult.failed }}；未执行 {{ deleteResult.notExecuted }}。
      <div v-if="deleteResult.items.some((item) => item.message)" class="result-items">
        <div v-for="(item, index) in deleteResult.items.filter((item) => item.message)" :key="index">
          {{ item.fileId || item.taskId }}：{{ item.message }}
        </div>
      </div>
      <n-button
        v-if="failedDeleteTargets.length || failedScanPaths.length"
        round
        size="small"
        :disabled="busy"
        @click="retryUnfinishedDelete"
      >
        <template #icon><n-icon :component="RefreshCw" /></template>
        重新预览未完成项
      </n-button>
    </n-alert>

    <div class="panel-content" @wheel.passive="emit('wheel', $event)">
      <SongList
        v-if="isSongTab && (downloadedSongs.length || isBatchMode)"
        ref="songListRef"
        :songs="downloadedSongs"
        :search-key="searchKey"
        :min-size="64"
        play-mode="append"
        removable
        show-footer
        show-header
        batch-enabled
        batch-external
        :batch-toolbar-target="batchToolbarTarget"
        :batch-refreshing="refreshing"
        :batch-disabled="busy"
        batch-context="download"
        batch-removable
        @batch-mode-change="isBatchMode = $event"
        @batch-preparing-change="batchPreparing = $event"
        @batch-refresh="refreshData(false)"
        @scroll="emit('scroll', $event)"
        @scroll-to-top="emit('scrollToTop', $event)"
        @remove-song="prepareSongDelete([$event], 'download')"
        @batch-remove="prepareSongDelete($event, 'download')"
      />
      <div
        v-else-if="!isSongTab"
        class="download-scroll"
        @scroll.passive="emit('scroll', $event)"
      >
        <DownloadTaskList
          ref="taskListRef"
          :key="activeSubTab"
          :tasks="activeSubTab === 'records' ? downloadTasks : ongoingTasks"
          :search-key="searchKey"
          :search-terms="taskSearchTerms"
          :busy="busy"
          :refreshing="refreshing"
          :batch-toolbar-target="batchToolbarTarget"
          @batch-mode-change="isBatchMode = $event"
          @refresh="refreshData(false)"
          @action="runTaskAction"
          @change-directory="changeTaskDirectory"
          @detail="openDetail"
          @remove="prepareDelete"
        />
        <ListEndState v-if="activeSubTab === 'records' ? downloadTasks.length : ongoingTasks.length" />
      </div>
      <n-empty v-else class="empty-state" description="暂无下载歌曲" />
    </div>

    <DownloadRecordDetail v-model:show="detailShown" :target="detailTarget" @changed="reloadDownloadData" />
    <DownloadDeleteConfirm
      v-model:show="deleteShown"
      :count="deleteCount"
      :busy="deleting"
      :all="deleteAll"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NAlert, NButton, NEmpty, NIcon } from "naive-ui";
import { Check, Download, History, Play, RefreshCw, SquarePen } from "lucide-vue-next";
import BatchSegmentedActions, { type SegmentedActionItem } from "@/components/batch/BatchSegmentedActions.vue";
import ExpandableSearchInput from "@/components/common/ExpandableSearchInput.vue";
import ListEndState from "@/components/common/ListEndState.vue";
import DownloadDeleteConfirm from "@/components/download/DownloadDeleteConfirm.vue";
import DownloadRecordDetail from "@/components/download/DownloadRecordDetail.vue";
import DownloadTaskList from "@/components/download/DownloadTaskList.vue";
import SongList from "@/components/list/SongList.vue";
import { useBatchToolbarMorph } from "@/composables/useBatchToolbarMorph";
import { useLocalDownloadLibrary } from "@/composables/useLocalDownloadLibrary";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";

type DownloadSubTab = "downloaded" | "downloading" | "records";

const emit = defineEmits<{
  scroll: [event: Event];
  scrollToTop: [event: Event];
  wheel: [event: WheelEvent];
  expandHeader: [];
}>();

const playbackCommands = usePlaybackCommands();
const {
  downloadedSongs,
  downloadTasks,
  ongoingTasks,
  refreshing,
  busy,
  loadError,
  actionMessage,
  deleteResult,
  deleteShown,
  deleting,
  deleteAll,
  deleteCount,
  detailShown,
  detailTarget,
  failedDeleteTargets,
  failedScanPaths,
  taskSearchTerms,
  refreshData,
  reloadDownloadData,
  runTaskAction,
  changeTaskDirectory,
  openDetail,
  prepareDelete,
  prepareSongDelete,
  retryUnfinishedDelete,
  confirmDelete,
} = useLocalDownloadLibrary({ poll: true });

const activeSubTab = ref<DownloadSubTab>("downloaded");
const searchKey = ref("");
const isBatchMode = ref(false);
const batchPreparing = ref(false);
const songListRef = ref<InstanceType<typeof SongList> | null>(null);
const taskListRef = ref<InstanceType<typeof DownloadTaskList> | null>(null);
const batchToolbarTarget = ref<HTMLElement | null>(null);
const batchMorph = useBatchToolbarMorph(isBatchMode, batchToolbarTarget);

const subTabActions = computed<SegmentedActionItem[]>(() => [
  {
    key: "downloaded",
    label: "已下载歌曲",
    icon: Check,
    active: activeSubTab.value === "downloaded",
    primary: activeSubTab.value === "downloaded",
    disabled: busy.value,
  },
  {
    key: "downloading",
    label: "正在下载",
    icon: Download,
    active: activeSubTab.value === "downloading",
    primary: activeSubTab.value === "downloading",
    disabled: busy.value,
  },
  {
    key: "records",
    label: "下载记录",
    icon: History,
    active: activeSubTab.value === "records",
    primary: activeSubTab.value === "records",
    disabled: busy.value,
  },
]);

const isSongTab = computed(() => activeSubTab.value === "downloaded");

const currentDownloadedSongs = computed(() => {
  const query = searchKey.value.trim().toLowerCase();
  if (!query) return downloadedSongs.value;
  return downloadedSongs.value.filter((song) =>
    [song.name, song.singer, song.album].some((val) =>
      val?.toLowerCase().includes(query)
    )
  );
});

const currentItemsCount = computed(() => {
  if (activeSubTab.value === "downloaded") return downloadedSongs.value.length;
  if (activeSubTab.value === "records") return downloadTasks.value.length;
  return ongoingTasks.value.length;
});

const defaultActions = computed<SegmentedActionItem[]>(() => {
  const items: SegmentedActionItem[] = [];
  if (isSongTab.value) {
    items.push({
      key: "playAll",
      label: "播放全部",
      icon: Play,
      primary: true,
      disabled: !currentDownloadedSongs.value.length || busy.value,
    });
  }
  items.push(
    {
      key: "refresh",
      label: "刷新",
      icon: RefreshCw,
      loading: refreshing.value,
      spinIcon: true,
      disabled: busy.value,
    },
    {
      key: "batch",
      label: "多选",
      icon: SquarePen,
      disabled: busy.value || !currentItemsCount.value,
    }
  );
  return items;
});

function handleSubTabAction(key: string) {
  const nextTab = key as DownloadSubTab;
  if (nextTab === activeSubTab.value) return;
  activeSubTab.value = nextTab;
  handleSubTabChange();
}

function handleSubTabChange() {
  batchMorph.reset();
  songListRef.value?.exitBatch();
  taskListRef.value?.exitBatch();
  isBatchMode.value = false;
  batchPreparing.value = false;
  emit("expandHeader");
}

function handleDefaultAction(key: string, event: MouseEvent) {
  if (key === "playAll") {
    if (currentDownloadedSongs.value.length) {
      playbackCommands.playAll(currentDownloadedSongs.value);
    }
  } else if (key === "refresh") {
    void refreshData(false);
  } else if (key === "batch") {
    if (busy.value || batchPreparing.value) return;
    batchMorph.captureOrigin(event);
    if (isSongTab.value) void songListRef.value?.enterBatch();
    else taskListRef.value?.enterBatch();
  }
}

watch(searchKey, () => emit("expandHeader"));
</script>

<style scoped lang="scss">
.mine-download-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
  min-width: 0;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.batch-toolbar-target {
  display: flex;
  align-items: center;
  gap: 10px;
}

.feedback {
  margin-bottom: 12px;
}

.result-items {
  max-height: 130px;
  overflow: auto;
  margin-top: 8px;
  font-size: 12px;
}

.panel-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.download-scroll {
  height: 100%;
  overflow: auto;
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
