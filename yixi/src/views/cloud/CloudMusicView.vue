<template>
  <div class="cloud-music-page">
    <div class="cloud-header" :class="{ collapsed: isHeaderCollapsed }">
      <div class="cloud-header-titles">
        <h1>共享云盘</h1>
        <p class="subtitle">汇聚分享，独立音源曲库</p>
      </div>

      <div class="cloud-header-group" role="group" aria-label="云盘概览与投稿">
        <n-tooltip trigger="hover">
          <template #trigger>
            <span class="cloud-stat-segment">
              <strong class="stat-num">{{ summary.total }}</strong>
              <span>总数</span>
            </span>
          </template>
          当前云盘歌曲总数
        </n-tooltip>

        <n-tooltip trigger="hover">
          <template #trigger>
            <span class="cloud-stat-segment">
              <strong class="stat-num">{{ summary.myContributions ?? 0 }}</strong>
              <span>我的</span>
            </span>
          </template>
          我的共享总数
        </n-tooltip>

        <n-tooltip trigger="hover">
          <template #trigger>
            <span class="cloud-stat-segment">
              <strong class="stat-num">{{ formattedLatestDate }}</strong>
              <span>更新</span>
            </span>
          </template>
          最近云盘更新日期
        </n-tooltip>

        <button type="button" class="cloud-submit-segment" @click="goToSubmit">
          <UploadCloud :size="17" :stroke-width="1.8" class="submit-icon" aria-hidden="true" />
          <span>投稿</span>
        </button>
      </div>
    </div>

    <div class="toolbar batch-operation-toolbar">
      <div class="toolbar-left">
        <BatchSegmentedActions
          v-show="!isBatchMode"
          data-batch-trigger
          always-show-label
          aria-label="云盘操作"
          :actions="defaultActions"
          @action="handleDefaultAction"
        />
        <div ref="batchToolbarTarget" v-show="isBatchMode" class="cloud-batch-target" />
      </div>
      <ExpandableSearchInput v-model:value="searchInput" @update:value="onSearchInput" />
    </div>

    <div class="cloud-content" @wheel.passive="handleScrollableContentWheel">
      <SongList
        v-if="songs.length > 0 || loading || isBatchMode"
        ref="songListRef"
        :songs="songs"
        :loading="loading && songs.length === 0"
        :has-more="hasMore"
        :min-size="64"
        batch-enabled
        batch-external
        :batch-toolbar-target="batchToolbarTarget"
        batch-context="songs"
        show-footer
        show-header
        @batch-mode-change="isBatchMode = $event"
        @scroll="handleScrollableContentScroll"
        @scroll-to-top="handleScrollableContentTop"
        @scroll-to-bottom="loadMore"
      />

      <div v-else-if="errorMessage" class="error-state">
        <p class="error-text">{{ errorMessage }}</p>
        <n-button type="primary" size="small" round @click="refresh">重试</n-button>
      </div>

      <n-empty
        v-else
        class="empty-state"
        :description="searchInput ? '未找到相关云盘歌曲' : '共享云盘暂无歌曲'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NEmpty, NTooltip } from "naive-ui";
import { Play, RefreshCw, SquarePen, UploadCloud } from "lucide-vue-next";
import BatchSegmentedActions, { type SegmentedActionItem } from "@/components/batch/BatchSegmentedActions.vue";
import ExpandableSearchInput from "@/components/common/ExpandableSearchInput.vue";
import SongList from "@/components/list/SongList.vue";
import { useCloudMusicList } from "@/cloud/useCloudMusicList";
import { useBatchToolbarMorph } from "@/composables/useBatchToolbarMorph";
import { useCollapsiblePageHeader } from "@/composables/useCollapsiblePageHeader";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";

defineOptions({ name: "CloudMusicView" });

const router = useRouter();
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
const isBatchMode = ref(false);
const songListRef = ref<InstanceType<typeof SongList> | null>(null);
const batchToolbarTarget = ref<HTMLElement | null>(null);
const batchMorph = useBatchToolbarMorph(isBatchMode, batchToolbarTarget);

const {
  isHeaderCollapsed,
  handleScrollableContentScroll,
  handleScrollableContentTop,
  handleScrollableContentWheel,
} = useCollapsiblePageHeader();

const formattedLatestDate = computed(() => {
  const ts = summary.value.latestUpdatedAt;
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getMonth() + 1}-${d.getDate()}`;
});

const defaultActions = computed<SegmentedActionItem[]>(() => [
  {
    key: "playAll",
    label: "播放全部",
    icon: Play,
    primary: true,
    disabled: songs.value.length === 0 || loading.value,
  },
  {
    key: "refresh",
    label: "刷新",
    icon: RefreshCw,
    loading: loading.value,
    spinIcon: true,
  },
  {
    key: "batch",
    label: "多选",
    icon: SquarePen,
    disabled: songs.value.length === 0 || loading.value,
  },
]);

function handleDefaultAction(key: string, event: MouseEvent) {
  if (key === "playAll") {
    handlePlayAll();
  } else if (key === "refresh") {
    void refresh();
  } else if (key === "batch") {
    if (songs.value.length === 0 || loading.value) return;
    batchMorph.captureOrigin(event);
    void songListRef.value?.enterBatch();
  }
}

function goToSubmit() {
  void router.push("/cloud/submit");
}

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
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  max-height: 96px;
  margin-bottom: 18px;
  transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top;

  .cloud-header-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

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

.cloud-header-group {
  box-sizing: border-box;
  height: var(--batch-control-height, 36px);
  display: inline-flex;
  align-items: stretch;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: var(--surface-card);
  color: var(--text-primary);
}

.cloud-stat-segment,
.cloud-submit-segment {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 100%;
  padding: 0 14px;
  font-size: 13px;
  white-space: nowrap;
}

.cloud-stat-segment {
  color: var(--text-secondary);
  cursor: default;
  user-select: none;

  .stat-num {
    color: var(--text-primary);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  & + .cloud-stat-segment {
    border-left: 1px solid var(--border-subtle);
  }
}

.cloud-submit-segment {
  border: 0;
  background: var(--color-primary);
  color: var(--text-on-accent, #ffffff);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, opacity 0.2s ease;

  &:hover {
    background: var(--color-primary-hover);
  }

  .submit-icon {
    flex: 0 0 auto;
  }
}

.toolbar {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
  box-sizing: border-box;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
    flex: 1;
  }
}

.cloud-batch-target {
  min-width: 0;
  flex: 1;
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
