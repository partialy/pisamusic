<template>
  <div class="mine-local-panel">
    <div class="toolbar batch-operation-toolbar">
      <div class="toolbar-left">
        <BatchSegmentedActions
          v-show="!isBatchMode"
          data-batch-trigger
          always-show-label
          aria-label="本地歌曲操作"
          :actions="defaultActions"
          @action="handleDefaultAction"
        />
        <span v-show="!isBatchMode" class="local-count-status">{{ localStatusText }}</span>
        <div ref="batchToolbarTarget" v-show="isBatchMode" class="batch-toolbar-target" />
      </div>
      <ExpandableSearchInput v-model:value="searchKey" placeholder="搜索歌名、歌手" />
    </div>

    <n-alert v-if="loadError" type="error" class="feedback" :bordered="false">
      {{ loadError }}，可点击刷新重试。
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
        v-if="mergedLocalSongs.length || isBatchMode"
        ref="songListRef"
        :songs="mergedLocalSongs"
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
        batch-context="local"
        batch-removable
        @batch-mode-change="isBatchMode = $event"
        @batch-preparing-change="batchPreparing = $event"
        @batch-refresh="refreshData(true)"
        @scroll="emit('scroll', $event)"
        @scroll-to-top="emit('scrollToTop', $event)"
        @remove-song="prepareSongDelete([$event], 'local')"
        @batch-remove="prepareSongDelete($event, 'local')"
      />
      <n-empty v-else class="empty-state" description="暂无本地歌曲" />
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
import { Play, RefreshCw, SquarePen } from "lucide-vue-next";
import BatchSegmentedActions, { type SegmentedActionItem } from "@/components/batch/BatchSegmentedActions.vue";
import ExpandableSearchInput from "@/components/common/ExpandableSearchInput.vue";
import DownloadDeleteConfirm from "@/components/download/DownloadDeleteConfirm.vue";
import DownloadRecordDetail from "@/components/download/DownloadRecordDetail.vue";
import SongList from "@/components/list/SongList.vue";
import { useBatchToolbarMorph } from "@/composables/useBatchToolbarMorph";
import { useLocalDownloadLibrary } from "@/composables/useLocalDownloadLibrary";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";

const emit = defineEmits<{
  scroll: [event: Event];
  scrollToTop: [event: Event];
  wheel: [event: WheelEvent];
  expandHeader: [];
}>();

const playbackCommands = usePlaybackCommands();
const {
  mergedLocalSongs,
  refreshing,
  busy,
  loadError,
  deleteResult,
  deleteShown,
  deleting,
  deleteAll,
  deleteCount,
  detailShown,
  detailTarget,
  failedDeleteTargets,
  failedScanPaths,
  localStatusText,
  refreshData,
  reloadDownloadData,
  prepareSongDelete,
  retryUnfinishedDelete,
  confirmDelete,
} = useLocalDownloadLibrary({ poll: true });

const searchKey = ref("");
const isBatchMode = ref(false);
const batchPreparing = ref(false);
const songListRef = ref<InstanceType<typeof SongList> | null>(null);
const batchToolbarTarget = ref<HTMLElement | null>(null);
const batchMorph = useBatchToolbarMorph(isBatchMode, batchToolbarTarget);

const currentSongs = computed(() => {
  const query = searchKey.value.trim().toLowerCase();
  if (!query) return mergedLocalSongs.value;
  return mergedLocalSongs.value.filter((song) =>
    [song.name, song.singer, song.album].some((val) =>
      val?.toLowerCase().includes(query)
    )
  );
});

const defaultActions = computed<SegmentedActionItem[]>(() => [
  {
    key: "playAll",
    label: "播放全部",
    icon: Play,
    primary: true,
    disabled: !currentSongs.value.length || busy.value,
  },
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
    disabled: busy.value || !mergedLocalSongs.value.length,
  },
]);

function handleDefaultAction(key: string, event: MouseEvent) {
  if (key === "playAll") {
    if (currentSongs.value.length) playbackCommands.playAll(currentSongs.value);
  } else if (key === "refresh") {
    void refreshData(true);
  } else if (key === "batch") {
    if (busy.value || batchPreparing.value) return;
    batchMorph.captureOrigin(event);
    void songListRef.value?.enterBatch();
  }
}

watch(searchKey, () => emit("expandHeader"));
</script>

<style scoped lang="scss">
.mine-local-panel {
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
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
}

.local-count-status {
  color: var(--text-secondary);
  font-size: 13px;
  white-space: nowrap;
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

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
