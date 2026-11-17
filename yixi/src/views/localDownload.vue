<template>
  <div class="local-download-page">
    <div class="page-header" :class="{ collapsed: isHeaderCollapsed }">
      <h1>本地与下载</h1>
      <div class="page-tabs"><button v-for="tab in tabs" :key="tab.key" class="tab-btn" :class="{ active: activeTab === tab.key }" @click="switchTab(tab.key)">{{ tab.label }} <span>{{ tab.count }}</span></button></div>
    </div>
    <div class="toolbar batch-operation-toolbar">
      <div class="toolbar-left">
        <BatchSegmentedActions
          v-show="!isBatchMode"
          data-batch-trigger
          always-show-label
          aria-label="本地与下载操作"
          :actions="defaultActions"
          @action="handleDefaultAction"
        />
        <div ref="batchToolbarTarget" class="batch-toolbar-target" />
      </div>
      <n-input v-model:value="searchKey" class="page-search" :class="{ focused: searchFocused || searchKey }" clearable placeholder="搜索歌名、歌手" @focus="searchFocused = true" @blur="searchFocused = false"><template #prefix><n-icon :component="Search" /></template></n-input>
    </div>
    <div v-if="activeTab === 'local' && statusText" class="scan-status">{{ statusText }}</div>
    <n-alert v-if="loadError" type="error" class="feedback" :bordered="false">{{ loadError }}，可点击刷新重试。</n-alert>
    <n-alert v-if="actionMessage" type="info" class="feedback" closable :bordered="false" @close="actionMessage = ''">{{ actionMessage }}</n-alert>
    <n-alert v-if="deleteResult" type="info" class="feedback" closable :bordered="false" @close="deleteResult = null">
      删除结果：移除记录 {{ deleteResult.recordsRemoved }}；删除文件 {{ deleteResult.filesDeleted }}；共享跳过 {{ deleteResult.sharedSkipped }}；占用 {{ deleteResult.occupied }}；失败 {{ deleteResult.failed }}；未执行 {{ deleteResult.notExecuted }}。
      <div v-if="deleteResult.items.some(item => item.message)" class="result-items"><div v-for="(item, index) in deleteResult.items.filter(item => item.message)" :key="index">{{ item.fileId || item.taskId }}：{{ item.message }}</div></div>
      <n-button v-if="failedDeleteTargets.length || failedScanPaths.length" round size="small" :disabled="busy" @click="retryUnfinishedDelete"><template #icon><n-icon :component="RefreshCw" /></template>重新预览未完成项</n-button>
    </n-alert>
    <div class="page-content" @wheel.passive="handleScrollableContentWheel">
      <SongList v-if="isSongTab && (sourceSongs.length || isBatchMode)" ref="songListRef" :key="activeTab" :songs="sourceSongs" :search-key="searchKey" :min-size="64" play-mode="append"
        removable show-footer show-header batch-enabled batch-external :batch-toolbar-target="batchToolbarTarget" :batch-refreshing="refreshing" :batch-disabled="busy" :batch-context="activeTab === 'download' ? 'download' : 'local'" batch-removable
        @batch-mode-change="isBatchMode = $event" @batch-preparing-change="batchPreparing = $event" @batch-refresh="refreshCurrentTab" @scroll="handleScrollableContentScroll" @scroll-to-top="handleScrollableContentTop" @remove-song="prepareSongDelete([$event])" @batch-remove="prepareSongDelete" />
      <div v-else-if="!isSongTab" class="download-scroll" @scroll="handleScrollableContentScroll">
        <DownloadTaskList ref="taskListRef" :key="activeTab" :tasks="activeTab === 'records' ? downloadTasks : ongoingTasks" :search-key="searchKey" :search-terms="taskSearchTerms" :busy="busy" :refreshing="refreshing" :batch-toolbar-target="batchToolbarTarget"
          @batch-mode-change="isBatchMode = $event" @refresh="refreshCurrentTab" @action="runTaskAction" @change-directory="changeTaskDirectory" @detail="openDetail" @remove="prepareDelete" />
        <ListEndState v-if="(activeTab === 'records' ? downloadTasks.length : ongoingTasks.length)" />
      </div>
      <n-empty v-else class="empty-state" :description="activeTab === 'download' ? '暂无下载歌曲' : '暂无本地歌曲'" />
    </div>
    <DownloadRecordDetail v-model:show="detailShown" :target="detailTarget" @changed="reloadDownloadData" />
    <DownloadDeleteConfirm v-model:show="deleteShown" :count="deleteCount" :busy="deleting" :all="deleteAll" @confirm="confirmDelete" />
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NAlert, NButton, NEmpty, NIcon, NInput } from "naive-ui";
import { Play, Search, RefreshCw, SquarePen } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import ListEndState from "@/components/common/ListEndState.vue";
import SongList from "@/components/list/SongList.vue";
import DownloadTaskList from "@/components/download/DownloadTaskList.vue";
import DownloadRecordDetail from "@/components/download/DownloadRecordDetail.vue";
import DownloadDeleteConfirm from "@/components/download/DownloadDeleteConfirm.vue";
import { useLocalLibraryStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import type { Song } from "@/types/song";
import type { DownloadTaskSnapshot, DownloadFileSnapshot, DownloadFileTarget, DownloadDeletePreview, DownloadDeleteResult } from "@/types/download";
import { normalizeSong } from "@/utils/song";
import { listDownloadedSongs, listDownloadTasks, listDownloadFiles, pauseDownload, resumeDownload, cancelDownload, retryDownload, selectDownloadTaskDirectory, previewDownloadDelete, deleteDownloads } from "@/utils/api/downloadAPI";
import { useBatchToolbarMorph } from "@/composables/useBatchToolbarMorph";
import BatchSegmentedActions, { type SegmentedActionItem } from "@/components/batch/BatchSegmentedActions.vue";
import { useCollapsiblePageHeader } from "@/composables/useCollapsiblePageHeader";
type LocalDownloadTab = "local" | "download" | "downloading" | "records";
const playbackCommands = usePlaybackCommands(), localLibrary = useLocalLibraryStore();
const { songs: localSongs } = storeToRefs(localLibrary);
const activeTab = ref<LocalDownloadTab>("local"), searchKey = ref(""), searchFocused = ref(false);
const { isHeaderCollapsed, expandHeader, handleScrollableContentScroll, handleScrollableContentTop, handleScrollableContentWheel } = useCollapsiblePageHeader();
const downloadedSongs = ref<Song[]>([]), downloadTasks = ref<DownloadTaskSnapshot[]>([]), downloadFiles = ref<DownloadFileSnapshot[]>([]);
const refreshing = ref(false), isBatchMode = ref(false), batchPreparing = ref(false);
const songListRef = ref<InstanceType<typeof SongList> | null>(null);
const taskListRef = ref<InstanceType<typeof DownloadTaskList> | null>(null);
const batchToolbarTarget = ref<HTMLElement | null>(null);
const batchMorph = useBatchToolbarMorph(isBatchMode, batchToolbarTarget);
const loadError = ref(""), actionBusy = ref(""), actionMessage = ref("");
const detailShown = ref(false), detailTarget = ref<DownloadFileTarget | null>(null);
const failedScanPaths = ref<string[]>([]);
const deleteShown = ref(false), deleting = ref(false), previewing = ref(false), deleteAll = ref(false);
const deletePreview = ref<DownloadDeletePreview | null>(null), scanDeleteTargets = ref<string[]>([]), deleteResult = ref<DownloadDeleteResult | null>(null);
const busy = computed(() => !!actionBusy.value || deleting.value || previewing.value || deleteShown.value);
let disposed = false, pollingTimer: ReturnType<typeof setTimeout> | undefined, pendingReload: Promise<void> | undefined;
const ongoingTasks = computed(() => downloadTasks.value.filter(task => !["completed", "failed", "cancelled"].includes(task.status)));
const tabs = computed(() => [
  { key: "local" as const, label: "本地歌曲", count: mergedLocalSongs.value.length },
  { key: "download" as const, label: "下载歌曲", count: downloadedSongs.value.length },
  { key: "downloading" as const, label: "正在下载", count: ongoingTasks.value.length },
  { key: "records" as const, label: "下载记录", count: downloadTasks.value.length },
]);
const mergedLocalSongs = computed(() => {
  const map = new Map<string, Song>();
  for (const song of [...localSongs.value, ...downloadedSongs.value]) { const key = song.filePath || `${song.source}:${song.id}`; if (!map.has(key)) map.set(key, song); }
  return [...map.values()];
});
const isSongTab = computed(() => activeTab.value === "local" || activeTab.value === "download");
const sourceSongs = computed(() => activeTab.value === "download" ? downloadedSongs.value : mergedLocalSongs.value);
const currentSongs = computed(() => { const query = searchKey.value.trim().toLowerCase(); return sourceSongs.value.filter(song => !query || [song.name, song.singer, song.album].some(value => value?.toLowerCase().includes(query))); });
const taskSearchTerms = computed(() => Object.fromEntries(downloadFiles.value.map(file => [file.taskId, [file.payload.name, file.payload.singer, file.payload.album].filter(Boolean).join(" ")])));
const statusText = computed(() => {
  const status = localLibrary.status;
  if (status.scanning) return "正在扫描本地音乐…";
  if (status.lastError) return `扫描失败：${status.lastError}`;
  return status.lastFinishedAt ? `本地曲库${status.skipped ? '已是最新' : '已更新'}，共 ${mergedLocalSongs.value.length} 首` : "";
});
const deleteCount = computed(() => (deletePreview.value?.count || 0) + scanDeleteTargets.value.length);
const failedDeleteTargets = computed(() => deleteResult.value?.items.filter(item => ["failed", "occupied", "shared", "not-executed"].includes(item.status) && !!(item.fileId || item.taskId)).map(item => item.fileId ? { fileId: item.fileId } : { taskId: item.taskId }) || []);
function playAll() { if (currentSongs.value.length) playbackCommands.playAll(currentSongs.value); }
const currentItemsCount = computed(() => isSongTab.value ? sourceSongs.value.length : activeTab.value === "records" ? downloadTasks.value.length : ongoingTasks.value.length);
const defaultActions = computed<SegmentedActionItem[]>(() => {
  const items: SegmentedActionItem[] = [];
  if (isSongTab.value) {
    items.push({
      key: "playAll",
      label: "播放全部",
      icon: Play,
      primary: true,
      disabled: !currentSongs.value.length || busy.value,
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
function handleDefaultAction(key: string, event: MouseEvent) {
  if (key === "playAll") playAll();
  else if (key === "refresh") void refreshCurrentTab();
  else if (key === "batch") enterBatch(event);
}
function enterBatch(event: MouseEvent) {
  if (busy.value || batchPreparing.value) return;
  batchMorph.captureOrigin(event);
  if (isSongTab.value) void songListRef.value?.enterBatch();
  else taskListRef.value?.enterBatch();
}
function switchTab(tab: LocalDownloadTab) {
  if (activeTab.value === tab || busy.value) return;
  batchMorph.reset();
  songListRef.value?.exitBatch(); taskListRef.value?.exitBatch();
  isBatchMode.value = false; batchPreparing.value = false;
  activeTab.value = tab; expandHeader();
}
function errorText(error: unknown) { return error instanceof Error ? error.message : String(error || "操作失败"); }
async function refreshCurrentTab() {
  if (refreshing.value || busy.value) return;
  const refreshLocal = activeTab.value === "local";
  refreshing.value = true;
  try {
    if (refreshLocal) await localLibrary.refresh();
    await pendingReload;
    await reloadDownloadData();
  } catch (error) { if (!disposed) window.$message.error(errorText(error)); }
  finally { if (!disposed) refreshing.value = false; }
}
function reloadDownloadData(): Promise<void> {
  if (pendingReload) return pendingReload;
  pendingReload = (async () => {
    try {
      const [songs, tasks, files] = await Promise.all([listDownloadedSongs(), listDownloadTasks(), listDownloadFiles()]);
      if (disposed) return;
      downloadedSongs.value = songs.map(song => normalizeSong(song)); downloadTasks.value = tasks; downloadFiles.value = files; loadError.value = "";
    } catch (error) { if (!disposed) loadError.value = errorText(error); }
    finally { pendingReload = undefined; }
  })();
  return pendingReload;
}
async function runTaskAction(action: "pause" | "resume" | "cancel" | "retry", id: string) {
  if (busy.value) return;
  actionBusy.value = id;
  try {
    const result = await ({ pause: pauseDownload, resume: resumeDownload, cancel: cancelDownload, retry: retryDownload })[action](id);
    if (!disposed) actionMessage.value = `${result.name || result.songId}：${({ pause: '暂停', resume: '继续', cancel: '取消', retry: '重试' })[action]}请求已处理，当前状态以列表为准。`;
    await pendingReload; await reloadDownloadData();
  } catch (error) { window.$message.error(errorText(error)); }
  finally { actionBusy.value = ""; }
}
async function changeTaskDirectory(id: string) {
  if (busy.value) return;
  actionBusy.value = id;
  try {
    const result = await selectDownloadTaskDirectory(id);
    if (!result || disposed) return;
    actionMessage.value = `${result.name || result.songId}：下载目录已更新，进度从零开始，其他入队配置保留。任务保持暂停，点击“继续”重新下载。`;
    await pendingReload; await reloadDownloadData();
  } catch (error) { if (!disposed) window.$message.error(errorText(error)); }
  finally { actionBusy.value = ""; }
}
function openDetail(target: DownloadFileTarget) { detailTarget.value = { ...target }; detailShown.value = true; }
async function prepareDelete(targets?: DownloadFileTarget[], all = false) {
  if (busy.value) return;
  previewing.value = true;
  try {
    const result = await previewDownloadDelete(all ? { all: true } : { targets: targets?.map(target => ({ ...target })) });
    if (disposed) return;
    if (!result.count) { window.$message.info("没有可清理的下载记录"); return; }
    deletePreview.value = result; scanDeleteTargets.value = []; deleteAll.value = all; deleteShown.value = true;
  } catch (error) { window.$message.error(errorText(error)); }
  finally { previewing.value = false; }
}
async function prepareSongDelete(songs: Song[]) {
  if (busy.value || !songs.length) return;
  // 映射到 main 权威 fileId；纯扫描歌曲路径只作为现有可信索引的 lookup。
  const selected = songs.map(song => ({ ...song }));
  const filesByPath = new Map(downloadFiles.value.map(file => [file.filePath, file.fileId]));
  const fileIds = new Set<string>(), scanPaths = new Set<string>();
  for (const song of selected) {
    const path = song.filePath || song.urlParam;
    if (!path) { window.$message.warning("所选歌曲缺少可信本地索引"); return; }
    const fileId = filesByPath.get(path);
    if (fileId) fileIds.add(fileId);
    else if (activeTab.value === "download") { window.$message.warning("下载文件记录已变化，请刷新后重试"); return; }
    else scanPaths.add(path);
  }
  previewing.value = true;
  try {
    const preview = fileIds.size ? await previewDownloadDelete({ targets: [...fileIds].map(fileId => ({ fileId })) }) : null;
    if (disposed) return;
    deletePreview.value = preview; scanDeleteTargets.value = [...scanPaths]; deleteAll.value = false; deleteShown.value = true;
  } catch (error) { window.$message.error(errorText(error)); }
  finally { previewing.value = false; }
}
async function retryUnfinishedDelete() {
  if (busy.value) return;
  const targets = failedDeleteTargets.value.map(target => ({ ...target })), paths = [...failedScanPaths.value];
  previewing.value = true;
  try {
    const preview = targets.length ? await previewDownloadDelete({ targets }) : null;
    if (disposed) return;
    deletePreview.value = preview; scanDeleteTargets.value = paths; deleteAll.value = false; deleteShown.value = true;
  } catch (error) { window.$message.error(errorText(error)); }
  finally { previewing.value = false; }
}
async function confirmDelete(deleteFiles: boolean) {
  if (deleting.value) return;
  const previewId = deletePreview.value?.previewId, scanPaths = [...scanDeleteTargets.value];
  deleting.value = true;
  const combined: DownloadDeleteResult = { recordsRemoved: 0, filesDeleted: 0, sharedSkipped: 0, occupied: 0, failed: 0, notExecuted: 0, items: [] };
  try {
    if (previewId) Object.assign(combined, await deleteDownloads({ previewId, deleteFiles, confirmed: deleteFiles }));
    const retainedScanPaths: string[] = [];
    for (const path of scanPaths) {
      try {
        const result = await localLibrary.removeSongFromList(path, deleteFiles);
        combined.recordsRemoved += Number(result.removed); combined.filesDeleted += Number(result.deleted);
        const status = result.status === "shared" || result.status === "occupied" || result.status === "failed" || result.status === "not-executed" ? result.status : "removed";
        if (status === "shared") combined.sharedSkipped++;
        if (status === "occupied") combined.occupied++;
        if (status === "failed") combined.failed++;
        if (status === "not-executed") combined.notExecuted++;
        if (!result.removed) retainedScanPaths.push(path);
        combined.items.push({ status, recordsRemoved: Number(result.removed), filesDeleted: Number(result.deleted), message: `${path}：${result.reason}` });
      } catch (error) { retainedScanPaths.push(path); combined.failed++; combined.items.push({ status: "failed", recordsRemoved: 0, filesDeleted: 0, message: `${path}：${errorText(error)}` }); }
    }
    failedScanPaths.value = retainedScanPaths;
    deleteResult.value = combined; deleteShown.value = false; deletePreview.value = null; scanDeleteTargets.value = [];
    await localLibrary.loadSongs(); await pendingReload; await reloadDownloadData();
  } catch (error) { window.$message.error(`${errorText(error)}；如预览已失效，请关闭后重新预览`); }
  finally { deleting.value = false; }
}
async function poll() { await reloadDownloadData(); if (!disposed) pollingTimer = setTimeout(() => { void poll(); }, 1500); }
watch(searchKey, expandHeader);
onMounted(() => { void localLibrary.init().catch(error => { if (!disposed) window.$message.error(errorText(error)); }); void poll(); });
onBeforeUnmount(() => { disposed = true; if (pollingTimer) clearTimeout(pollingTimer); });
</script>
<style lang="scss" scoped>
.local-download-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
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
    color: var(--text-primary);
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
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  transition: color 0.2s ease;

  span {
    margin-left: 4px;
    font-size: 14px;
  }

  &.active {
    color: var(--text-accent);
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
  border-radius: var(--radius-pill);
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
  color: var(--text-secondary);
  font-size: 13px;
}

.page-content {
  flex: 1;
  min-height: 0;
}

.download-scroll { height: 100%; overflow: auto; }
.empty-state { height: 100%; display: flex; align-items: center; justify-content: center; }
.toolbar-left { flex-wrap: wrap; min-width: 0; }
.batch-toolbar-target:empty { display: none; }
.batch-toolbar-target { min-width: 0; }
.toolbar :deep(.n-button) { border-radius: var(--radius-pill); }
.feedback { margin-bottom: 12px; }
.result-items { max-height: 130px; overflow: auto; margin-top: 8px; font-size: 12px; }
@media (max-width: 1000px) { .toolbar { align-items: flex-start; } .page-tabs { gap: 20px; } }
</style>
