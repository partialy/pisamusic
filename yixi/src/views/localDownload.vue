<template>
  <div class="local-download-page">
    <div class="page-header" :class="{ collapsed: isHeaderCollapsed }">
      <h1>本地与下载</h1>
      <div class="page-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="switchLocalDownloadTab(tab.key)">
          {{ tab.label }} <span>{{ tab.count }}</span>
        </button>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <n-button
          type="primary"
          class="play-all"
          :disabled="!canPlayAll"
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
        <n-button secondary @click="reloadDownloadData">
          <template #icon>
            <n-icon :component="RefreshCw" />
          </template>
          刷新下载
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

    <div class="page-content" @wheel.passive="handleScrollableContentWheel">
      <SongList
        v-if="(activeTab === 'local' || activeTab === 'download') && currentSongs.length"
        :songs="currentSongs"
        :min-size="64"
        removable
        show-footer
        show-header
        @scroll="handleScrollableContentScroll"
        @scroll-to-top="handleScrollableContentTop"
        @remove-song="openRemoveConfirm" />

      <div v-else-if="activeTab === 'downloading'" class="task-list" @scroll="handleScrollableContentScroll">
        <div v-if="downloadTasks.length" class="task-rows">
          <div v-for="task in downloadTasks" :key="task.taskId" class="task-row">
            <div class="task-main">
              <div class="task-title">{{ task.name }}</div>
              <div class="task-meta">
                {{ qualityLabel(task.qualityKey) }} · {{ statusLabel(task.status) }}
                <span v-if="task.speedBytesPerSecond > 0"> · {{ formatBytes(task.speedBytesPerSecond) }}/s</span>
              </div>
            </div>
            <n-progress
              class="task-progress"
              type="line"
              :percentage="Math.round(task.progress)"
              :status="task.status === 'failed' ? 'error' : task.status === 'completed' ? 'success' : 'default'" />
            <div class="task-size">
              {{ formatBytes(task.receivedBytes) }} / {{ task.totalBytes ? formatBytes(task.totalBytes) : "未知" }}
            </div>
          </div>
        </div>
        <n-empty v-else class="empty-state" description="暂无正在下载的任务" />
      </div>

      <div v-else-if="activeTab === 'records'" class="record-list" @scroll="handleScrollableContentScroll">
        <div v-if="downloadRecords.length" class="record-rows">
          <div v-for="record in downloadRecords" :key="record.id" class="record-row">
            <div class="record-main">
              <div class="record-title">{{ record.payload?.name || record.songId }}</div>
              <div class="record-meta">
                {{ qualityLabel(record.qualityKey) }} · {{ statusLabel(record.status) }} ·
                元数据 {{ metadataLabel(record.metadataStatus) }}
              </div>
              <div class="record-path">{{ record.filePath || record.cachePath || record.downloadDirectory }}</div>
            </div>
            <div class="record-time">{{ formatDate(record.completedAt || record.updatedAt) }}</div>
          </div>
        </div>
        <n-empty v-else class="empty-state" description="暂无下载记录" />
      </div>

      <n-empty
        v-else
        class="empty-state"
        :description="activeTab === 'download' ? '暂无下载歌曲' : '暂无本地歌曲'" />
    </div>

    <DialogWrapper v-model:visible="showRemoveConfirm">
      <template #all-content>
        <n-card
          title="移除歌曲"
          class="remove-song-dialog"
          closable
          @close="closeRemoveConfirm">
          <div class="content">
            确认从列表移除「{{ removeCandidate?.name || "未知歌曲" }}」？
          </div>
          <div class="footer">
            <n-button tertiary @click="closeRemoveConfirm">取消</n-button>
            <n-button secondary :loading="removing" @click="confirmRemove(false)">移除</n-button>
            <n-button type="error" secondary :loading="removing" @click="confirmRemove(true)">彻底删除</n-button>
          </div>
        </n-card>
      </template>
    </DialogWrapper>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NButton, NCard, NEmpty, NIcon, NInput, NProgress } from "naive-ui";
import { Play, RefreshCw, Search } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import SongList from "@/components/list/SongList.vue";
import DialogWrapper from "@/components/common/DialogWrapper.vue";
import { useLocalLibraryStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import type { Song } from "@/types/song";
import { normalizeSong } from "@/utils/song";
import {
  listDownloadedSongs,
  listDownloadRecords,
  listDownloadTasks,
  type DownloadRecordItem,
  type DownloadTaskSnapshot,
} from "@/utils/api/downloadAPI";
import { getQualityOption } from "@/utils/musicQuality";
import { useCollapsiblePageHeader } from "@/composables/useCollapsiblePageHeader";

type LocalDownloadTab = "local" | "download" | "downloading" | "records";

const playbackCommands = usePlaybackCommands();
const localLibrary = useLocalLibraryStore();
const { songs: localSongs } = storeToRefs(localLibrary);

const activeTab = ref<LocalDownloadTab>("local");
const searchKey = ref("");
const searchFocused = ref(false);
const {
  isHeaderCollapsed,
  expandHeader,
  handleScrollableContentScroll,
  handleScrollableContentTop,
  handleScrollableContentWheel,
} = useCollapsiblePageHeader();
const downloadedSongs = ref<Song[]>([]);
const downloadTasks = ref<DownloadTaskSnapshot[]>([]);
const downloadRecords = ref<DownloadRecordItem[]>([]);
const showRemoveConfirm = ref(false);
const removeCandidate = ref<Song | null>(null);
const removing = ref(false);
let pollingTimer: number | undefined;

const tabs = computed(() => [
  { key: "local" as const, label: "本地歌曲", count: mergedLocalSongs.value.length },
  { key: "download" as const, label: "下载歌曲", count: downloadedSongs.value.length },
  { key: "downloading" as const, label: "正在下载", count: downloadTasks.value.length },
  { key: "records" as const, label: "下载记录", count: downloadRecords.value.length },
]);

const normalizedSearch = computed(() => searchKey.value.trim().toLowerCase());
const sourceSongs = computed(() => activeTab.value === "download" ? downloadedSongs.value : mergedLocalSongs.value);
const currentSongs = computed(() => filterSongs(sourceSongs.value));
const canPlayAll = computed(() => (activeTab.value === "local" || activeTab.value === "download") && currentSongs.value.length > 0);

const mergedLocalSongs = computed(() => {
  const map = new Map<string, Song>();
  [...localSongs.value, ...downloadedSongs.value].forEach((song) => {
    const key = song.filePath || `${song.source}:${song.id}`;
    if (!map.has(key)) map.set(key, song);
  });
  return [...map.values()];
});

const mergedLocalSongCount = computed(() => mergedLocalSongs.value.length);

const statusText = computed(() => {
  const status = localLibrary.status;
  if (status.scanning) return "正在扫描本地音乐...";
  if (status.lastError) return `扫描失败：${status.lastError}`;
  if (status.lastFinishedAt) {
    return status.skipped
      ? `本地曲库已是最新，共 ${mergedLocalSongCount.value} 首`
      : `本地曲库已更新，共 ${mergedLocalSongCount.value} 首`;
  }
  return "";
});

function filterSongs(songs: Song[]) {
  const keyword = normalizedSearch.value;
  if (!keyword) return songs;
  return songs.filter((song) =>
    [song.name, song.singer, song.album]
      .filter(Boolean)
      .some((text) => text.toLowerCase().includes(keyword))
  );
}

function playAll() {
  if (!currentSongs.value.length) return;
  playbackCommands.playAll(currentSongs.value as Song[]);
}

function switchLocalDownloadTab(tab: LocalDownloadTab) {
  activeTab.value = tab;
  expandHeader();
}

async function refreshLocalLibrary() {
  await localLibrary.refresh();
  await reloadDownloadData();
}

async function reloadDownloadData() {
  const [songs, tasks, records] = await Promise.all([
    listDownloadedSongs(),
    listDownloadTasks(),
    listDownloadRecords(),
  ]);
  downloadedSongs.value = songs.map((song) => normalizeSong(song));
  downloadTasks.value = tasks;
  downloadRecords.value = records;
}

function openRemoveConfirm(song: Song) {
  removeCandidate.value = song;
  showRemoveConfirm.value = true;
}

function closeRemoveConfirm() {
  if (removing.value) return;
  showRemoveConfirm.value = false;
  removeCandidate.value = null;
}

async function confirmRemove(deleteFile: boolean) {
  const song = removeCandidate.value;
  const filePath = song?.filePath || song?.urlParam;
  if (!filePath) {
    window.$message.warning("当前歌曲没有可移除的本地文件路径");
    closeRemoveConfirm();
    return;
  }

  removing.value = true;
  try {
    await localLibrary.removeSongFromList(String(filePath), deleteFile);
    await reloadDownloadData();
    window.$message.success(deleteFile ? "已彻底删除" : "已从列表移除");
    showRemoveConfirm.value = false;
    removeCandidate.value = null;
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : "移除失败");
  } finally {
    removing.value = false;
  }
}

function startPolling() {
  stopPolling();
  pollingTimer = window.setInterval(() => {
    void reloadDownloadData();
  }, 1000);
}

function stopPolling() {
  if (pollingTimer !== undefined) {
    window.clearInterval(pollingTimer);
    pollingTimer = undefined;
  }
}

function qualityLabel(key: string) {
  return getQualityOption(key)?.shortLabel || key || "AUTO";
}

function statusLabel(status: string) {
  if (status === "queued") return "等待中";
  if (status === "running") return "下载中";
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  return status;
}

function metadataLabel(status: string) {
  if (status === "embedded") return "已嵌入";
  if (status === "sidecar") return "缓存侧车";
  if (status === "failed") return "失败";
  return status;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

watch(searchKey, expandHeader);

onMounted(() => {
  void localLibrary.init();
  void reloadDownloadData();
  startPolling();
});

onBeforeUnmount(() => {
  stopPolling();
});
</script>

<style lang="scss" scoped>
@keyframes fade-in {
  from {
    opacity: 0.4;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.local-download-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--color-text-default);
}

.page-header {
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

.page-tabs {
  display: flex;
  align-items: center;
  gap: 36px;
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

.task-list,
.record-list {
  height: 100%;
  overflow: auto;
}

.task-rows,
.record-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-row,
.record-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px 110px;
  align-items: center;
  gap: 18px;
  padding: 14px 16px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}

.record-row {
  grid-template-columns: minmax(0, 1fr) 180px;
}

.task-title,
.record-title {
  color: var(--color-text-default);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-meta,
.record-meta,
.record-path,
.task-size,
.record-time {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.record-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-progress {
  min-width: 0;
}

.empty-state {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.remove-song-dialog {
  width: 500px;
  border-radius: 10px;
  padding: 10px;
  background: var(--color-bg-track);
  animation: fade-in 0.4s ease-in-out;

  .content {
    margin-bottom: 20px;
    color: var(--color-text-default);
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }
}
</style>
