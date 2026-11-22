import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { message } from "antd";
import {
  activateDesktopUpdate,
  publishUpdate,
  updatePublishedUpdate,
  uploadDesktopUpdateAsset,
  uploadReleasePackage,
} from "../api/client";
import type {
  DesktopUpdateAssetInfo,
  DesktopUpdateAssetType,
  ReleaseFileInfo,
  UpdateFormDraft,
} from "../types/config";
import {
  DESKTOP_REQUIRED_SLOTS,
  formatReleaseFileSize,
  type DesktopStagedFiles,
} from "../utils/releaseFormHelpers";
import { draftToPayload } from "../utils/updatePayload";
import { useAdminConfigWorkspace } from "./AdminConfigWorkspaceContext";

export type ReleasePublishTaskState = "queued" | "running" | "completed" | "failed";
export type ReleasePublishTaskPhase =
  | "waiting"
  | "uploading"
  | "activating"
  | "publishing"
  | "done"
  | "error";

export type ReleasePublishProgressSlots = Partial<
  Record<"package" | DesktopUpdateAssetType, number>
>;

export type ReleasePublishTaskItem = {
  id: string;
  mode: "create" | "edit";
  historyId?: string;
  isCurrent: boolean;
  draft: UpdateFormDraft;
  androidFile?: File | null;
  desktopFiles?: DesktopStagedFiles;
  existingDesktopAssets?: Partial<Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>>;
  uploadedAndroidFile?: ReleaseFileInfo;
  uploadedDesktopAssets?: Partial<Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>>;
  fileProgress: ReleasePublishProgressSlots;
  state: ReleasePublishTaskState;
  phase: ReleasePublishTaskPhase;
  overallPercent: number;
  errorMessage?: string;
  createdAt: number;
  finishedAt?: number;
};

export type EnqueueReleasePublishInput = {
  mode: "create" | "edit";
  historyId?: string;
  isCurrent: boolean;
  draft: UpdateFormDraft;
  androidFile?: File | null;
  desktopFiles?: DesktopStagedFiles;
  existingDesktopAssets?: Partial<Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>>;
};

type ReleasePublishQueueContextValue = {
  tasks: ReleasePublishTaskItem[];
  queueModalOpen: boolean;
  openQueueModal: () => void;
  closeQueueModal: () => void;
  enqueuePublish: (input: EnqueueReleasePublishInput) => string;
  retryTask: (taskId: string) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
  completedRevision: number;
  stats: {
    total: number;
    queued: number;
    running: number;
    active: number;
    completed: number;
    failed: number;
  };
};

const ReleasePublishQueueContext = createContext<ReleasePublishQueueContextValue | null>(null);

function computeWeightedUploadPercent(
  files: Array<{ key: "package" | DesktopUpdateAssetType; file: File }>,
  progressMap: ReleasePublishProgressSlots,
): number {
  if (files.length === 0) return 90;
  let totalBytes = 0;
  let uploadedBytes = 0;
  for (const item of files) {
    const size = Math.max(1, item.file.size);
    const pct = Math.min(100, Math.max(0, progressMap[item.key] ?? 0));
    totalBytes += size;
    uploadedBytes += (size * pct) / 100;
  }
  if (totalBytes <= 0) return 0;
  return Math.min(90, Math.round((uploadedBytes / totalBytes) * 90));
}

export function ReleasePublishQueueProvider({ children }: { children: ReactNode }) {
  const { refreshRemote } = useAdminConfigWorkspace();
  const [tasks, setTasks] = useState<ReleasePublishTaskItem[]>([]);
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [completedRevision, setCompletedRevision] = useState(0);

  const tasksRef = useRef<ReleasePublishTaskItem[]>([]);
  tasksRef.current = tasks;
  const runningTaskIdRef = useRef<string | null>(null);

  const patchTask = useCallback(
    (taskId: string, updater: (item: ReleasePublishTaskItem) => ReleasePublishTaskItem) => {
      setTasks((prev) => prev.map((item) => (item.id === taskId ? updater(item) : item)));
    },
    [],
  );

  const runTask = useCallback(
    async (task: ReleasePublishTaskItem) => {
      const { id: taskId } = task;
      const basePayload = draftToPayload(task.draft);
      let finalPayload = { ...basePayload };

      const pendingUploads: Array<{ key: "package" | DesktopUpdateAssetType; file: File }> = [];
      if (task.draft.platform === "android") {
        if (task.androidFile && !task.uploadedAndroidFile) {
          pendingUploads.push({ key: "package", file: task.androidFile });
        }
      } else {
        for (const slot of DESKTOP_REQUIRED_SLOTS) {
          const stagedFile = task.desktopFiles?.[slot.type];
          const alreadyUploaded = task.uploadedDesktopAssets?.[slot.type];
          if (stagedFile && !alreadyUploaded) {
            pendingUploads.push({ key: slot.type, file: stagedFile });
          }
        }
      }

      const localProgress: ReleasePublishProgressSlots = { ...task.fileProgress };
      let uploadedAndroid = task.uploadedAndroidFile;
      const uploadedDesktop: Partial<Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>> = {
        ...(task.uploadedDesktopAssets ?? {}),
      };

      const updateUploadProgress = (key: "package" | DesktopUpdateAssetType, pct: number) => {
        localProgress[key] = pct;
        const overallPercent = computeWeightedUploadPercent(pendingUploads, localProgress);
        patchTask(taskId, (cur) => ({
          ...cur,
          fileProgress: { ...cur.fileProgress, [key]: pct },
          overallPercent: Math.max(cur.overallPercent, overallPercent),
        }));
      };

      if (pendingUploads.length > 0) {
        patchTask(taskId, (cur) => ({
          ...cur,
          state: "running",
          phase: "uploading",
          errorMessage: undefined,
        }));

        if (task.draft.platform === "android") {
          const pkg = pendingUploads[0];
          const releaseFile = await uploadReleasePackage(
            pkg.file,
            "android",
            basePayload.latestVersion,
            (pct) => updateUploadProgress("package", pct),
          );
          uploadedAndroid = releaseFile;
          patchTask(taskId, (cur) => ({
            ...cur,
            uploadedAndroidFile: releaseFile,
            fileProgress: { ...cur.fileProgress, package: 100 },
          }));
        } else {
          await Promise.all(
            pendingUploads.map(async (item) => {
              const slotType = item.key as DesktopUpdateAssetType;
              const asset = await uploadDesktopUpdateAsset(
                item.file,
                basePayload.latestVersion,
                (pct) => updateUploadProgress(slotType, pct),
              );
              uploadedDesktop[slotType] = asset;
              patchTask(taskId, (cur) => ({
                ...cur,
                uploadedDesktopAssets: {
                  ...(cur.uploadedDesktopAssets ?? {}),
                  [slotType]: asset,
                },
                fileProgress: { ...cur.fileProgress, [slotType]: 100 },
              }));
            }),
          );
        }
      }

      if (task.draft.platform === "android") {
        if (uploadedAndroid) {
          finalPayload = {
            ...finalPayload,
            downloadUrl: uploadedAndroid.downloadUrl,
            fileSizeText:
              finalPayload.fileSizeText || formatReleaseFileSize(uploadedAndroid.fileSize),
            available: true,
            releaseFileId: uploadedAndroid.id,
          };
        }
      } else {
        const mergedDesktopAssets: Partial<
          Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>
        > = {
          ...(task.existingDesktopAssets ?? {}),
          ...uploadedDesktop,
        };
        const installerAsset = mergedDesktopAssets.installer;
        const latestYmlAsset = mergedDesktopAssets["latest-yml"];
        const blockmapAsset = mergedDesktopAssets.blockmap;

        if (installerAsset?.releaseFile) {
          finalPayload = {
            ...finalPayload,
            downloadUrl: installerAsset.releaseFile.downloadUrl,
            fileSizeText:
              finalPayload.fileSizeText || formatReleaseFileSize(installerAsset.fileSize),
            releaseFileId: installerAsset.releaseFile.id,
          };
        } else if (installerAsset) {
          finalPayload = {
            ...finalPayload,
            fileSizeText:
              finalPayload.fileSizeText || formatReleaseFileSize(installerAsset.fileSize),
            releaseFileId: finalPayload.releaseFileId || installerAsset.id,
          };
        }

        const shouldActivate =
          finalPayload.available && (task.mode === "create" || task.isCurrent);
        if (shouldActivate) {
          patchTask(taskId, (cur) => ({
            ...cur,
            phase: "activating",
            overallPercent: 93,
          }));
          const assetIds = [latestYmlAsset?.id, installerAsset?.id, blockmapAsset?.id].filter(
            (id): id is string => Boolean(id),
          );
          await activateDesktopUpdate(finalPayload.latestVersion, assetIds);
        }
      }

      patchTask(taskId, (cur) => ({
        ...cur,
        phase: "publishing",
        overallPercent: 97,
      }));

      if (task.mode === "create") {
        await publishUpdate(finalPayload);
      } else {
        await updatePublishedUpdate(task.historyId!, finalPayload);
      }

      await refreshRemote();
      setCompletedRevision((v) => v + 1);

      patchTask(taskId, (cur) => ({
        ...cur,
        state: "completed",
        phase: "done",
        overallPercent: 100,
        finishedAt: Date.now(),
      }));

      const platformLabel = task.draft.platform === "desktop" ? "PC 版" : "Android";
      void message.success(
        `${platformLabel} ${finalPayload.latestVersion} ${task.mode === "create" ? "发布成功" : "已保存更新"}`,
      );
    },
    [patchTask, refreshRemote],
  );

  const scheduleNext = useCallback(() => {
    if (runningTaskIdRef.current) return;
    const nextTask = tasksRef.current.find((t) => t.state === "queued");
    if (!nextTask) return;

    runningTaskIdRef.current = nextTask.id;
    patchTask(nextTask.id, (cur) => ({
      ...cur,
      state: "running",
      phase: "uploading",
      overallPercent: Math.max(cur.overallPercent, 2),
      errorMessage: undefined,
    }));

    void (async () => {
      try {
        await runTask(nextTask);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "发布任务执行失败";
        patchTask(nextTask.id, (cur) => ({
          ...cur,
          state: "failed",
          phase: "error",
          errorMessage: msg,
          finishedAt: Date.now(),
        }));
        void message.error(`版本 ${nextTask.draft.version} 发布失败：${msg}`);
      } finally {
        runningTaskIdRef.current = null;
        window.setTimeout(() => {
          scheduleNext();
        }, 0);
      }
    })();
  }, [patchTask, runTask]);

  useEffect(() => {
    if (!runningTaskIdRef.current && tasks.some((t) => t.state === "queued")) {
      scheduleNext();
    }
  }, [tasks, scheduleNext]);

  const stats = useMemo(() => {
    let queued = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;
    for (const t of tasks) {
      if (t.state === "queued") queued += 1;
      else if (t.state === "running") running += 1;
      else if (t.state === "completed") completed += 1;
      else if (t.state === "failed") failed += 1;
    }
    return {
      total: tasks.length,
      queued,
      running,
      active: queued + running,
      completed,
      failed,
    };
  }, [tasks]);

  useEffect(() => {
    if (stats.active <= 0) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "当前仍有版本发布任务正在上传，离开页面将中断上传";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [stats.active]);

  const openQueueModal = useCallback(() => setQueueModalOpen(true), []);
  const closeQueueModal = useCallback(() => setQueueModalOpen(false), []);

  const enqueuePublish = useCallback((input: EnqueueReleasePublishInput) => {
    const id = `release-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newTask: ReleasePublishTaskItem = {
      id,
      mode: input.mode,
      historyId: input.historyId,
      isCurrent: input.isCurrent,
      draft: input.draft,
      androidFile: input.androidFile,
      desktopFiles: input.desktopFiles,
      existingDesktopAssets: input.existingDesktopAssets,
      fileProgress: {},
      state: "queued",
      phase: "waiting",
      overallPercent: 0,
      createdAt: Date.now(),
    };
    setTasks((prev) => [newTask, ...prev]);
    return id;
  }, []);

  const retryTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((item) =>
        item.id === taskId && item.state === "failed"
          ? {
              ...item,
              state: "queued",
              phase: "waiting",
              errorMessage: undefined,
              finishedAt: undefined,
            }
          : item,
      ),
    );
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.filter((item) => item.id !== taskId || item.state === "running"),
    );
  }, []);

  const clearCompletedTasks = useCallback(() => {
    setTasks((prev) => prev.filter((item) => item.state !== "completed"));
  }, []);

  const value = useMemo<ReleasePublishQueueContextValue>(
    () => ({
      tasks,
      queueModalOpen,
      openQueueModal,
      closeQueueModal,
      enqueuePublish,
      retryTask,
      removeTask,
      clearCompletedTasks,
      completedRevision,
      stats,
    }),
    [
      tasks,
      queueModalOpen,
      openQueueModal,
      closeQueueModal,
      enqueuePublish,
      retryTask,
      removeTask,
      clearCompletedTasks,
      completedRevision,
      stats,
    ],
  );

  return (
    <ReleasePublishQueueContext.Provider value={value}>
      {children}
    </ReleasePublishQueueContext.Provider>
  );
}

export function useReleasePublishQueue(): ReleasePublishQueueContextValue {
  const ctx = useContext(ReleasePublishQueueContext);
  if (!ctx) {
    throw new Error("useReleasePublishQueue 必须在 ReleasePublishQueueProvider 内使用");
  }
  return ctx;
}
