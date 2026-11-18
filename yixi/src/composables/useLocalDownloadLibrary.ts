import { computed, onMounted, onUnmounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useLocalLibraryStore } from "@/store";
import type { Song } from "@/types/song";
import type {
  DownloadDeletePreview,
  DownloadDeleteResult,
  DownloadFileSnapshot,
  DownloadFileTarget,
  DownloadTaskSnapshot,
} from "@/types/download";
import { normalizeSong } from "@/utils/song";
import {
  cancelDownload,
  deleteDownloads,
  listDownloadFiles,
  listDownloadTasks,
  listDownloadedSongs,
  pauseDownload,
  previewDownloadDelete,
  resumeDownload,
  retryDownload,
  selectDownloadTaskDirectory,
} from "@/utils/api/downloadAPI";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error || "操作失败");
}

const downloadedSongs = ref<Song[]>([]);
const downloadTasks = ref<DownloadTaskSnapshot[]>([]);
const downloadFiles = ref<DownloadFileSnapshot[]>([]);
const refreshing = ref(false);
const loadError = ref("");
const actionBusy = ref("");
const actionMessage = ref("");
const detailShown = ref(false);
const detailTarget = ref<DownloadFileTarget | null>(null);
const failedScanPaths = ref<string[]>([]);
const deleteShown = ref(false);
const deleting = ref(false);
const previewing = ref(false);
const deleteAll = ref(false);
const deletePreview = ref<DownloadDeletePreview | null>(null);
const scanDeleteTargets = ref<string[]>([]);
const deleteResult = ref<DownloadDeleteResult | null>(null);

let activeConsumers = 0;
let pollingTimer: ReturnType<typeof setTimeout> | undefined;
let pendingReload: Promise<void> | undefined;
let libraryInitialized = false;

export function useLocalDownloadLibrary(options: { poll?: boolean } = {}) {
  const localLibrary = useLocalLibraryStore();
  const { songs: localSongs } = storeToRefs(localLibrary);

  const mergedLocalSongs = computed(() => {
    const map = new Map<string, Song>();
    for (const song of [...localSongs.value, ...downloadedSongs.value]) {
      const key = song.filePath || `${song.source}:${song.id}`;
      if (!map.has(key)) map.set(key, song);
    }
    return [...map.values()];
  });

  const ongoingTasks = computed(() =>
    downloadTasks.value.filter(
      (task) => !["completed", "failed", "cancelled"].includes(task.status)
    )
  );

  const busy = computed(
    () =>
      Boolean(actionBusy.value) ||
      deleting.value ||
      previewing.value ||
      deleteShown.value
  );

  const taskSearchTerms = computed(() =>
    Object.fromEntries(
      downloadFiles.value.map((file) => [
        file.taskId,
        [file.payload.name, file.payload.singer, file.payload.album]
          .filter(Boolean)
          .join(" "),
      ])
    )
  );

  const deleteCount = computed(
    () => (deletePreview.value?.count || 0) + scanDeleteTargets.value.length
  );

  const failedDeleteTargets = computed(
    () =>
      deleteResult.value?.items
        .filter(
          (item) =>
            ["failed", "occupied", "shared", "not-executed"].includes(
              item.status
            ) && Boolean(item.fileId || item.taskId)
        )
        .map((item) =>
          item.fileId ? { fileId: item.fileId } : { taskId: item.taskId }
        ) || []
  );

  const localStatusText = computed(() => {
    const status = localLibrary.status;
    if (status.scanning) return "正在扫描本地音乐…";
    if (status.lastError) return `扫描失败：${status.lastError}`;
    return `共 ${mergedLocalSongs.value.length} 首`;
  });

  function reloadDownloadData(): Promise<void> {
    if (pendingReload) return pendingReload;
    pendingReload = (async () => {
      try {
        const [songs, tasks, files] = await Promise.all([
          listDownloadedSongs(),
          listDownloadTasks(),
          listDownloadFiles(),
        ]);
        if (activeConsumers <= 0 && !options.poll) {
          // 允许一次性预加载写回缓存
        }
        downloadedSongs.value = songs.map((song) => normalizeSong(song));
        downloadTasks.value = tasks;
        downloadFiles.value = files;
        loadError.value = "";
      } catch (error) {
        loadError.value = errorText(error);
      } finally {
        pendingReload = undefined;
      }
    })();
    return pendingReload;
  }

  async function refreshData(includeLocalScan: boolean) {
    if (refreshing.value || busy.value) return;
    refreshing.value = true;
    try {
      if (includeLocalScan) {
        await localLibrary.refresh();
      }
      await pendingReload;
      await reloadDownloadData();
    } catch (error) {
      window.$message.error(errorText(error));
    } finally {
      refreshing.value = false;
    }
  }

  async function runTaskAction(
    action: "pause" | "resume" | "cancel" | "retry",
    id: string
  ) {
    if (busy.value) return;
    actionBusy.value = id;
    try {
      const result = await {
        pause: pauseDownload,
        resume: resumeDownload,
        cancel: cancelDownload,
        retry: retryDownload,
      }[action](id);
      actionMessage.value = `${result.name || result.songId}：${
        { pause: "暂停", resume: "继续", cancel: "取消", retry: "重试" }[action]
      }请求已处理，当前状态以列表为准。`;
      await pendingReload;
      await reloadDownloadData();
    } catch (error) {
      window.$message.error(errorText(error));
    } finally {
      actionBusy.value = "";
    }
  }

  async function changeTaskDirectory(id: string) {
    if (busy.value) return;
    actionBusy.value = id;
    try {
      const result = await selectDownloadTaskDirectory(id);
      if (!result) return;
      actionMessage.value = `${result.name || result.songId}：下载目录已更新，进度从零开始，其他入队配置保留。任务保持暂停，点击“继续”重新下载。`;
      await pendingReload;
      await reloadDownloadData();
    } catch (error) {
      window.$message.error(errorText(error));
    } finally {
      actionBusy.value = "";
    }
  }

  function openDetail(target: DownloadFileTarget) {
    detailTarget.value = { ...target };
    detailShown.value = true;
  }

  async function prepareDelete(targets?: DownloadFileTarget[], all = false) {
    if (busy.value) return;
    previewing.value = true;
    try {
      const result = await previewDownloadDelete(
        all
          ? { all: true }
          : { targets: targets?.map((target) => ({ ...target })) }
      );
      if (!result.count) {
        window.$message.info("没有可清理的下载记录");
        return;
      }
      deletePreview.value = result;
      scanDeleteTargets.value = [];
      deleteAll.value = all;
      deleteShown.value = true;
    } catch (error) {
      window.$message.error(errorText(error));
    } finally {
      previewing.value = false;
    }
  }

  async function prepareSongDelete(
    songs: Song[],
    sourceType: "local" | "download"
  ) {
    if (busy.value || !songs.length) return;
    // 映射到 main 权威 fileId；纯扫描歌曲路径只作为现有可信索引的 lookup。
    const selected = songs.map((song) => ({ ...song }));
    const filesByPath = new Map(
      downloadFiles.value.map((file) => [file.filePath, file.fileId])
    );
    const fileIds = new Set<string>();
    const scanPaths = new Set<string>();
    for (const song of selected) {
      const path = song.filePath || song.urlParam;
      if (!path) {
        window.$message.warning("所选歌曲缺少可信本地索引");
        return;
      }
      const fileId = filesByPath.get(path);
      if (fileId) fileIds.add(fileId);
      else if (sourceType === "download") {
        window.$message.warning("下载文件记录已变化，请刷新后重试");
        return;
      } else {
        scanPaths.add(path);
      }
    }
    previewing.value = true;
    try {
      const preview = fileIds.size
        ? await previewDownloadDelete({
            targets: [...fileIds].map((fileId) => ({ fileId })),
          })
        : null;
      deletePreview.value = preview;
      scanDeleteTargets.value = [...scanPaths];
      deleteAll.value = false;
      deleteShown.value = true;
    } catch (error) {
      window.$message.error(errorText(error));
    } finally {
      previewing.value = false;
    }
  }

  async function retryUnfinishedDelete() {
    if (busy.value) return;
    const targets = failedDeleteTargets.value.map((target) => ({ ...target }));
    const paths = [...failedScanPaths.value];
    previewing.value = true;
    try {
      const preview = targets.length
        ? await previewDownloadDelete({ targets })
        : null;
      deletePreview.value = preview;
      scanDeleteTargets.value = paths;
      deleteAll.value = false;
      deleteShown.value = true;
    } catch (error) {
      window.$message.error(errorText(error));
    } finally {
      previewing.value = false;
    }
  }

  async function confirmDelete(deleteFiles: boolean) {
    if (deleting.value) return;
    const previewId = deletePreview.value?.previewId;
    const scanPaths = [...scanDeleteTargets.value];
    deleting.value = true;
    const combined: DownloadDeleteResult = {
      recordsRemoved: 0,
      filesDeleted: 0,
      sharedSkipped: 0,
      occupied: 0,
      failed: 0,
      notExecuted: 0,
      items: [],
    };
    try {
      if (previewId) {
        Object.assign(
          combined,
          await deleteDownloads({
            previewId,
            deleteFiles,
            confirmed: deleteFiles,
          })
        );
      }
      const retainedScanPaths: string[] = [];
      for (const path of scanPaths) {
        try {
          const result = await localLibrary.removeSongFromList(
            path,
            deleteFiles
          );
          combined.recordsRemoved += Number(result.removed);
          combined.filesDeleted += Number(result.deleted);
          const status =
            result.status === "shared" ||
            result.status === "occupied" ||
            result.status === "failed" ||
            result.status === "not-executed"
              ? result.status
              : "removed";
          if (status === "shared") combined.sharedSkipped++;
          if (status === "occupied") combined.occupied++;
          if (status === "failed") combined.failed++;
          if (status === "not-executed") combined.notExecuted++;
          if (!result.removed) retainedScanPaths.push(path);
          combined.items.push({
            status,
            recordsRemoved: Number(result.removed),
            filesDeleted: Number(result.deleted),
            message: `${path}：${result.reason}`,
          });
        } catch (error) {
          retainedScanPaths.push(path);
          combined.failed++;
          combined.items.push({
            status: "failed",
            recordsRemoved: 0,
            filesDeleted: 0,
            message: `${path}：${errorText(error)}`,
          });
        }
      }
      failedScanPaths.value = retainedScanPaths;
      deleteResult.value = combined;
      deleteShown.value = false;
      deletePreview.value = null;
      scanDeleteTargets.value = [];
      await localLibrary.loadSongs();
      await pendingReload;
      await reloadDownloadData();
    } catch (error) {
      window.$message.error(
        `${errorText(error)}；如预览已失效，请关闭后重新预览`
      );
    } finally {
      deleting.value = false;
    }
  }

  async function runPollLoop() {
    await reloadDownloadData();
    if (activeConsumers > 0) {
      pollingTimer = setTimeout(() => {
        void runPollLoop();
      }, 1500);
    }
  }

  function ensureLocalLibraryInit() {
    if (libraryInitialized) return;
    libraryInitialized = true;
    void localLibrary.init().catch((error) => {
      libraryInitialized = false;
      window.$message.error(errorText(error));
    });
  }

  onMounted(() => {
    ensureLocalLibraryInit();
    if (options.poll) {
      activeConsumers++;
      if (activeConsumers === 1) {
        void runPollLoop();
      }
    } else {
      void reloadDownloadData();
    }
  });

  onUnmounted(() => {
    if (options.poll) {
      activeConsumers = Math.max(0, activeConsumers - 1);
      if (activeConsumers === 0 && pollingTimer) {
        clearTimeout(pollingTimer);
        pollingTimer = undefined;
      }
    }
  });

  return {
    downloadedSongs,
    downloadTasks,
    downloadFiles,
    mergedLocalSongs,
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
    localStatusText,
    refreshData,
    reloadDownloadData,
    runTaskAction,
    changeTaskDirectory,
    openDetail,
    prepareDelete,
    prepareSongDelete,
    retryUnfinishedDelete,
    confirmDelete,
  };
}
