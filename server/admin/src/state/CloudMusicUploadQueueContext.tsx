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
import { executeCloudMusicBatchTask } from "../api/cloudMusic";
import type {
  CloudMusicBatchDraftItem,
  CloudMusicTrack,
  CloudMusicUploadTaskItem,
} from "../types/cloudMusic";

const MAX_CONCURRENT_UPLOADS = 3;

export type CloudMusicModalView = "wizard" | "queue";

type CloudMusicUploadQueueContextValue = {
  tasks: CloudMusicUploadTaskItem[];
  modalOpen: boolean;
  modalView: CloudMusicModalView;
  openUploadWizard: () => void;
  openQueueView: () => void;
  closeModal: () => void;
  setModalView: (view: CloudMusicModalView) => void;
  enqueueBatch: (drafts: CloudMusicBatchDraftItem[]) => void;
  retryTask: (taskId: string) => void;
  retryAllFailed: () => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
  subscribeTrackCompleted: (listener: (track: CloudMusicTrack) => void) => () => void;
  stats: {
    total: number;
    queued: number;
    uploading: number;
    active: number;
    completed: number;
    failed: number;
  };
};

const CloudMusicUploadQueueContext = createContext<CloudMusicUploadQueueContextValue | null>(null);

export function CloudMusicUploadQueueProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<CloudMusicUploadTaskItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalView, setModalView] = useState<CloudMusicModalView>("wizard");

  const tasksRef = useRef<CloudMusicUploadTaskItem[]>([]);
  tasksRef.current = tasks;

  const runningIdsRef = useRef<Set<string>>(new Set());
  const listenersRef = useRef<Set<(track: CloudMusicTrack) => void>>(new Set());

  const notifyTrackCompleted = useCallback((track: CloudMusicTrack) => {
    for (const listener of listenersRef.current) {
      try {
        listener(track);
      } catch {
        // 忽略监听器异常
      }
    }
  }, []);

  const scheduleNext = useCallback(() => {
    const currentTasks = tasksRef.current;
    const runningCount = runningIdsRef.current.size;
    if (runningCount >= MAX_CONCURRENT_UPLOADS) return;

    const availableSlots = MAX_CONCURRENT_UPLOADS - runningCount;
    const nextQueued = currentTasks
      .filter((t) => t.state === "queued" && !runningIdsRef.current.has(t.id))
      .slice(0, availableSlots);

    if (nextQueued.length === 0) return;

    for (const task of nextQueued) {
      runningIdsRef.current.add(task.id);

      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? {
                ...item,
                state: "uploading",
                phase: "reserving",
                percent: 5,
                errorMessage: undefined,
              }
            : item,
        ),
      );

      void (async () => {
        try {
          const savedTrack = await executeCloudMusicBatchTask(task.draft, (progress) => {
            setTasks((prev) =>
              prev.map((item) =>
                item.id === task.id
                  ? {
                      ...item,
                      phase: progress.phase,
                      percent: progress.percent,
                    }
                  : item,
              ),
            );
          });

          setTasks((prev) =>
            prev.map((item) =>
              item.id === task.id
                ? {
                    ...item,
                    state: "completed",
                    phase: "done",
                    percent: 100,
                    resultTrack: savedTrack,
                    finishedAt: Date.now(),
                  }
                : item,
            ),
          );

          notifyTrackCompleted(savedTrack);
        } catch (err) {
          const message = err instanceof Error ? err.message : "上传失败";
          setTasks((prev) =>
            prev.map((item) =>
              item.id === task.id
                ? {
                    ...item,
                    state: "failed",
                    phase: "error",
                    errorMessage: message,
                    finishedAt: Date.now(),
                  }
                : item,
            ),
          );
        } finally {
          runningIdsRef.current.delete(task.id);
          window.setTimeout(() => {
            scheduleNext();
          }, 0);
        }
      })();
    }
  }, [notifyTrackCompleted]);

  useEffect(() => {
    const hasQueued = tasks.some((t) => t.state === "queued" && !runningIdsRef.current.has(t.id));
    if (hasQueued && runningIdsRef.current.size < MAX_CONCURRENT_UPLOADS) {
      scheduleNext();
    }
  }, [tasks, scheduleNext]);

  const stats = useMemo(() => {
    let queued = 0;
    let uploading = 0;
    let completed = 0;
    let failed = 0;
    for (const t of tasks) {
      if (t.state === "queued") queued += 1;
      else if (t.state === "uploading") uploading += 1;
      else if (t.state === "completed") completed += 1;
      else if (t.state === "failed") failed += 1;
    }
    return {
      total: tasks.length,
      queued,
      uploading,
      active: queued + uploading,
      completed,
      failed,
    };
  }, [tasks]);

  useEffect(() => {
    if (stats.active <= 0) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "当前仍有网盘音乐正在上传，离开页面将中断上传任务";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [stats.active]);

  const openUploadWizard = useCallback(() => {
    setModalView("wizard");
    setModalOpen(true);
  }, []);

  const openQueueView = useCallback(() => {
    setModalView("queue");
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const enqueueBatch = useCallback((drafts: CloudMusicBatchDraftItem[]) => {
    if (drafts.length === 0) return;
    const now = Date.now();
    const newTasks: CloudMusicUploadTaskItem[] = drafts.map((draft, idx) => ({
      id: `task-${now}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      draft,
      state: "queued",
      phase: "waiting",
      percent: 0,
      createdAt: now + idx,
    }));
    setTasks((prev) => [...newTasks, ...prev]);
    setModalView("queue");
    setModalOpen(true);
  }, []);

  const retryTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((item) =>
        item.id === taskId && item.state === "failed"
          ? {
              ...item,
              state: "queued",
              phase: "waiting",
              percent: 0,
              errorMessage: undefined,
              finishedAt: undefined,
            }
          : item,
      ),
    );
  }, []);

  const retryAllFailed = useCallback(() => {
    setTasks((prev) =>
      prev.map((item) =>
        item.state === "failed"
          ? {
              ...item,
              state: "queued",
              phase: "waiting",
              percent: 0,
              errorMessage: undefined,
              finishedAt: undefined,
            }
          : item,
      ),
    );
  }, []);

  const removeTask = useCallback((taskId: string) => {
    if (runningIdsRef.current.has(taskId)) return;
    setTasks((prev) => {
      const target = prev.find((t) => t.id === taskId);
      if (target?.draft.coverPreviewUrl) {
        URL.revokeObjectURL(target.draft.coverPreviewUrl);
      }
      return prev.filter((item) => item.id !== taskId);
    });
  }, []);

  const clearCompletedTasks = useCallback(() => {
    setTasks((prev) => {
      for (const item of prev) {
        if (item.state === "completed" && item.draft.coverPreviewUrl) {
          URL.revokeObjectURL(item.draft.coverPreviewUrl);
        }
      }
      return prev.filter((item) => item.state !== "completed");
    });
  }, []);

  const subscribeTrackCompleted = useCallback((listener: (track: CloudMusicTrack) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo<CloudMusicUploadQueueContextValue>(
    () => ({
      tasks,
      modalOpen,
      modalView,
      openUploadWizard,
      openQueueView,
      closeModal,
      setModalView,
      enqueueBatch,
      retryTask,
      retryAllFailed,
      removeTask,
      clearCompletedTasks,
      subscribeTrackCompleted,
      stats,
    }),
    [
      tasks,
      modalOpen,
      modalView,
      openUploadWizard,
      openQueueView,
      closeModal,
      enqueueBatch,
      retryTask,
      retryAllFailed,
      removeTask,
      clearCompletedTasks,
      subscribeTrackCompleted,
      stats,
    ],
  );

  return (
    <CloudMusicUploadQueueContext.Provider value={value}>
      {children}
    </CloudMusicUploadQueueContext.Provider>
  );
}

export function useCloudMusicUploadQueue(): CloudMusicUploadQueueContextValue {
  const ctx = useContext(CloudMusicUploadQueueContext);
  if (!ctx) {
    throw new Error("useCloudMusicUploadQueue 必须在 CloudMusicUploadQueueProvider 内使用");
  }
  return ctx;
}
