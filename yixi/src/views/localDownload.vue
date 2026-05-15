<template>
  <div class="local-download-page">
    <div class="page-header">
      <h1>本地与下载</h1>
      <div class="page-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key">
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

    <div class="page-content">
      <SongList
        v-if="(activeTab === 'local' || activeTab === 'download') && currentSongs.length"
        :songs="currentSongs"
        :min-size="64"
        show-footer
        show-header />

      <div v-else-if="activeTab === 'downloading'" class="task-list">
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

      <div v-else-if="activeTab === 'records'" class="record-list">
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { NButton, NEmpty, NIcon, NInput, NProgress } from "naive-ui";
import { Play, RefreshCw, Search } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import SongList from "@/components/list/SongList.vue";
import { useAudioStore, useLocalLibraryStore } from "@/store";
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

type LocalDownloadTab = "local" | "download" | "downloading" | "records";

const player = useAudioStore();
const localLibrary = useLocalLibraryStore();
const { songs: localSongs } = storeToRefs(localLibrary);

const activeTab = ref<LocalDownloadTab>("local");
const searchKey = ref("");
const searchFocused = ref(false);
const downloadedSongs = ref<Song[]>([]);
const downloadTasks = ref<DownloadTaskSnapshot[]>([]);
const downloadRecords = ref<DownloadRecordItem[]>([]);
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

const statusText = computed(() => {
  const status = localLibrary.status;
  if (status.scanning) return "正在扫描本地音乐...";
  if (status.lastError) return `扫描失败：${status.lastError}`;
  if (status.lastFinishedAt) {
    return status.skipped
      ? `本地曲库已是最新，共 ${status.total} 首`
      : `本地曲库已更新，共 ${status.total} 首`;
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
  player.switchPlayList(currentSongs.value as Song[], true);
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
.local-download-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--color-text-default);
}

.page-header {
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
</style>
