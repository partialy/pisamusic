<template>
  <div class="download-list">
    <Teleport :to="batchToolbarTarget || 'body'" :disabled="!batchToolbarTarget">
      <div v-if="batchMode" class="list-toolbar">
        <BatchSegmentedActions :actions="batchActions" @action="performBatchAction" />
        <span>已选 {{ selected.size }} 项</span>
      </div>
    </Teleport>

    <div
      v-for="task in visibleTasks"
      :key="task.taskId"
      class="task-row"
      :class="{
        'is-playing': isPlayingTask(task),
        'is-selected': batchMode && selected.has(task.taskId),
      }"
      @click="handleRowClick(task)"
      @dblclick="handleRowDblClick(task)"
      @contextmenu.prevent="openTaskMenu(task, $event)"
    >
      <div
        v-if="!isTerminalStatus(task.status)"
        class="task-progress-bg"
        :class="{ 'is-running': task.status === 'running' }"
        :style="{ width: `${clampedProgress(task.progress)}%` }"
        aria-hidden="true"
      />

      <n-checkbox
        v-if="batchMode"
        class="row-checkbox"
        :checked="selected.has(task.taskId)"
        :disabled="busy"
        :aria-label="`选择${task.name}`"
        @click.stop
        @update:checked="toggle(task.taskId)"
      />

      <div class="task-cover">
        <img
          :src="taskCoverUrl(task)"
          :alt="task.name || '歌曲封面'"
          loading="lazy"
          @error="handleCoverError"
        />
      </div>

      <div class="task-main">
        <div class="task-line-primary">
          <span class="task-title" :class="{ 'is-playing': isPlayingTask(task) }">
            {{ task.name || task.songId }}
          </span>
          <n-tag
            v-if="terminalStatusBadge(task)"
            size="tiny"
            :bordered="false"
            :type="terminalStatusBadge(task)!.type"
            class="task-status-tag"
          >
            {{ terminalStatusBadge(task)!.label }}
          </n-tag>
        </div>

        <div class="task-line-secondary">
          <div class="task-meta-left">
            <span class="task-singer">{{ taskSinger(task) }}</span>
            <span class="task-pill-tag">{{ sourceShortLabel(task.source) }}</span>
            <span class="task-pill-tag is-quality">{{ qualityLabel(task.qualityKey) }}</span>
          </div>

          <span
            class="task-status-text"
            :class="{ 'is-error': task.status === 'failed' }"
            :title="secondaryTooltip(task)"
          >
            {{ secondaryStatusText(task) }}
          </span>
        </div>
      </div>

      <div v-if="!batchMode" class="row-actions" @click.stop>
        <template v-if="!isTerminalStatus(task.status)">
          <n-button
            v-if="['queued', 'preparing', 'running'].includes(task.status)"
            quaternary
            circle
            size="small"
            title="暂停"
            aria-label="暂停"
            :disabled="busy"
            @click="emit('action', 'pause', task.taskId)"
          >
            <template #icon><n-icon :component="Pause" /></template>
          </n-button>
          <n-button
            v-else-if="task.status === 'paused'"
            quaternary
            circle
            size="small"
            title="继续"
            aria-label="继续"
            :disabled="busy"
            @click="emit('action', 'resume', task.taskId)"
          >
            <template #icon><n-icon :component="Play" /></template>
          </n-button>
          <n-button
            quaternary
            circle
            size="small"
            title="取消任务"
            aria-label="取消任务"
            :disabled="busy || ['processing', 'pausing'].includes(task.status)"
            @click="emit('action', 'cancel', task.taskId)"
          >
            <template #icon><n-icon :component="X" /></template>
          </n-button>
        </template>

        <template v-else>
          <n-button
            v-if="canPlayTask(task)"
            quaternary
            circle
            size="small"
            title="播放"
            aria-label="播放"
            :disabled="busy"
            @click="emit('play', task)"
          >
            <template #icon><n-icon :component="Play" /></template>
          </n-button>
          <n-button
            quaternary
            circle
            size="small"
            title="更多操作"
            aria-label="更多操作"
            :disabled="busy"
            @click="openTaskMenu(task, $event, true)"
          >
            <template #icon><n-icon :component="EllipsisVertical" /></template>
          </n-button>
        </template>
      </div>
    </div>

    <n-empty
      v-if="!visibleTasks.length"
      class="empty-state"
      :description="tasks.length ? '没有匹配的任务' : '暂无下载任务'"
    />

    <n-dropdown
      :placement="contextMenu.placement"
      trigger="manual"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :options="contextMenuOptions"
      :show="contextMenu.show"
      @clickoutside="contextMenu.show = false"
      @select="handleContextMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { NButton, NCheckbox, NDropdown, NEmpty, NIcon, NTag, type DropdownOption } from "naive-ui";
import {
  ArrowLeftRight,
  CircleX,
  EllipsisVertical,
  FolderOpen,
  Info,
  ListChecks,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wrench,
  X,
} from "lucide-vue-next";
import defaultCover from "@/assets/images/default-cover.png";
import BatchSegmentedActions from "@/components/batch/BatchSegmentedActions.vue";
import { useAudioStore } from "@/store";
import type {
  DownloadFileSnapshot,
  DownloadFileTarget,
  DownloadTaskSnapshot,
  DownloadTaskState,
} from "@/types/download";
import { getSongCover, renderIcon } from "@/utils/common";
import { formatBytes, qualityLabel, statusLabel } from "./downloadPresentation";

const props = defineProps<{
  tasks: DownloadTaskSnapshot[];
  files?: DownloadFileSnapshot[];
  searchKey: string;
  searchTerms?: Record<string, string>;
  busy: boolean;
  refreshing?: boolean;
  batchToolbarTarget?: HTMLElement | null;
}>();

const emit = defineEmits<{
  (event: "batchModeChange", value: boolean): void;
  (event: "refresh"): void;
  (event: "action", action: "pause" | "resume" | "cancel" | "retry", id: string): void;
  (event: "changeDirectory", id: string): void;
  (event: "detail", target: DownloadFileTarget): void;
  (event: "locate", target: DownloadFileTarget, hasFile: boolean): void;
  (event: "play", task: DownloadTaskSnapshot): void;
  (event: "repair", target: DownloadFileTarget): void;
  (event: "batchRepair", targets: DownloadFileTarget[]): void;
  (event: "remove", targets: DownloadFileTarget[]): void;
}>();

const audioStore = useAudioStore();
const { currentSong } = storeToRefs(audioStore);

const selected = ref(new Set<string>());
const batchMode = ref(false);
const contextMenu = ref<{
  show: boolean;
  x: number;
  y: number;
  placement: "bottom-start" | "bottom-end";
  taskId: string;
}>({
  show: false,
  x: 0,
  y: 0,
  placement: "bottom-start",
  taskId: "",
});

const filesByTaskId = computed(() => {
  const map = new Map<string, DownloadFileSnapshot>();
  for (const file of props.files || []) {
    map.set(file.taskId, file);
  }
  return map;
});

const visibleTasks = computed(() => {
  const search = props.searchKey.trim().toLowerCase();
  return props.tasks.filter(
    (task) =>
      !search ||
      [
        task.name,
        task.singer || "",
        task.album || "",
        task.songId,
        task.source,
        task.qualityKey,
        task.error,
        props.searchTerms?.[task.taskId] || "",
      ].some((value) => value.toLowerCase().includes(search))
  );
});

const repairableSelectedTargets = computed<DownloadFileTarget[]>(() =>
  props.tasks
    .filter(
      (task) =>
        selected.value.has(task.taskId) &&
        Boolean(task.fileId) &&
        ["completed", "failed"].includes(task.status)
    )
    .map((task) => ({ fileId: task.fileId, taskId: task.taskId }))
);

const batchActions = computed(() => [
  {
    key: "refresh",
    label: "刷新",
    icon: RefreshCw,
    disabled: props.busy || props.refreshing,
    loading: props.refreshing,
  },
  {
    key: "selectAll",
    label: "全选",
    icon: ListChecks,
    disabled: props.busy || !visibleTasks.value.length,
  },
  {
    key: "invert",
    label: "反选",
    icon: ArrowLeftRight,
    disabled: props.busy || !visibleTasks.value.length,
  },
  {
    key: "repair",
    label: "修复信息",
    icon: Wrench,
    disabled: props.busy || !repairableSelectedTargets.value.length,
  },
  {
    key: "remove",
    label: "移除",
    icon: Trash2,
    disabled: props.busy || !selected.value.size,
  },
  {
    key: "exit",
    label: "退出",
    icon: X,
    disabled: props.busy,
  },
]);

const activeMenuTask = computed(
  () => props.tasks.find((task) => task.taskId === contextMenu.value.taskId) || null
);

const contextMenuOptions = computed<DropdownOption[]>(() => {
  const task = activeMenuTask.value;
  if (!task) return [];
  const options: DropdownOption[] = [];

  if (canPlayTask(task)) {
    options.push({ key: "play", label: "播放", icon: renderIcon(Play) });
  }
  if (["queued", "preparing", "running"].includes(task.status)) {
    options.push({ key: "pause", label: "暂停", icon: renderIcon(Pause) });
  }
  if (task.status === "paused") {
    options.push({ key: "resume", label: "继续", icon: renderIcon(Play) });
    if (!task.fileId) {
      options.push({
        key: "changeDirectory",
        label: "更换目录（从零开始）",
        icon: renderIcon(FolderOpen),
      });
    }
  }
  if (["failed", "cancelled"].includes(task.status)) {
    options.push({ key: "retry", label: "重试", icon: renderIcon(RotateCcw) });
  }
  if (task.fileId && ["completed", "failed"].includes(task.status)) {
    options.push({ key: "repair", label: "修复信息", icon: renderIcon(Wrench) });
  }
  options.push({ key: "detail", label: "详情", icon: renderIcon(Info) });
  if (task.fileId || task.directory) {
    options.push({
      key: "locate",
      label: task.fileId ? "定位文件" : "打开下载目录",
      icon: renderIcon(FolderOpen),
    });
  }
  if (!["completed", "cancelled"].includes(task.status)) {
    options.push({
      key: "cancel",
      label: "取消任务",
      icon: renderIcon(CircleX),
      disabled: ["processing", "pausing"].includes(task.status),
    });
  }
  options.push({ type: "divider", key: "divider-remove" });
  options.push({
    key: "remove",
    label: "清理删除",
    icon: renderIcon(Trash2),
    disabled: task.status === "processing",
  });
  return options;
});

watch(
  () => props.tasks,
  (tasks) => {
    const ids = new Set(tasks.map((task) => task.taskId));
    selected.value = new Set([...selected.value].filter((id) => ids.has(id)));
    if (contextMenu.value.show && !ids.has(contextMenu.value.taskId)) {
      contextMenu.value.show = false;
    }
  }
);

function isTerminalStatus(status: DownloadTaskState) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function canPlayTask(task: DownloadTaskSnapshot) {
  return task.status === "completed" && Boolean(task.fileId || task.filePath);
}

function clampedProgress(progress?: number) {
  return Math.min(100, Math.max(0, Math.round(progress || 0)));
}

function taskFile(task: DownloadTaskSnapshot) {
  return filesByTaskId.value.get(task.taskId);
}

function isPlayingTask(task: DownloadTaskSnapshot) {
  const song = currentSong.value;
  if (!song || song.source !== "local") return false;
  const activePath = (song.filePath || song.urlParam || "").trim().toLowerCase();
  const taskPath = (taskFile(task)?.filePath || task.filePath || "").trim().toLowerCase();
  return Boolean(activePath && taskPath && activePath === taskPath);
}

function taskCoverUrl(task: DownloadTaskSnapshot) {
  const file = taskFile(task);
  const cover = file?.payload?.cover || task.cover;
  if (!cover) return defaultCover;
  return getSongCover({ source: task.source, cover } as any, 120) || defaultCover;
}

function handleCoverError(event: Event) {
  const target = event.target as HTMLImageElement | null;
  if (target && target.src !== defaultCover) {
    target.src = defaultCover;
  }
}

function taskSinger(task: DownloadTaskSnapshot) {
  return taskFile(task)?.payload?.singer || task.singer || "未知歌手";
}

function sourceShortLabel(source: string) {
  return ({ kg: "KG", wy: "WY", kw: "KW", cloud: "云" } as Record<string, string>)[source] || source.toUpperCase();
}

function terminalStatusBadge(
  task: DownloadTaskSnapshot
): { label: string; type: "success" | "warning" | "error" | "default" } | null {
  if (!isTerminalStatus(task.status)) return null;
  const file = taskFile(task);
  if (task.status === "failed" && task.error.includes("缺失")) {
    return { label: "文件丢失", type: "error" };
  }
  if (task.status === "completed") {
    if (!task.fileId) return { label: "文件丢失", type: "error" };
    if (file?.metadataStatus === "sidecar" || file?.metadataStatus === "failed") {
      return { label: "待修复", type: "warning" };
    }
    return { label: "已完成", type: "success" };
  }
  if (task.status === "failed") return { label: "失败", type: "error" };
  return { label: "已取消", type: "default" };
}

function secondaryStatusText(task: DownloadTaskSnapshot) {
  if (isTerminalStatus(task.status)) {
    if (task.status === "failed") {
      return task.error || "下载失败";
    }
    if (task.status === "cancelled") {
      return "已取消";
    }
    const size = taskFile(task)?.size || task.totalBytes || task.receivedBytes;
    return size > 0 ? formatBytes(size) : statusLabel(task.status);
  }
  if (task.status === "running") {
    const pct = `${clampedProgress(task.progress)}%`;
    return task.speedBytesPerSecond > 0
      ? `${pct} · ${formatBytes(task.speedBytesPerSecond)}/s`
      : pct;
  }
  if (task.status === "paused" && task.progress > 0) {
    return `${statusLabel(task.status)} · ${clampedProgress(task.progress)}%`;
  }
  return statusLabel(task.status);
}

function secondaryTooltip(task: DownloadTaskSnapshot) {
  const file = taskFile(task);
  return task.error || task.pauseReason || file?.message || undefined;
}

function taskTarget(task: DownloadTaskSnapshot): DownloadFileTarget {
  return task.fileId ? { fileId: task.fileId, taskId: task.taskId } : { taskId: task.taskId };
}

function openTaskMenu(task: DownloadTaskSnapshot, event: MouseEvent, fromButton = false) {
  if (batchMode.value || props.busy) return;
  if (fromButton && event.currentTarget instanceof HTMLElement) {
    const rect = event.currentTarget.getBoundingClientRect();
    contextMenu.value = {
      show: true,
      x: rect.right,
      y: rect.bottom + 4,
      placement: "bottom-end",
      taskId: task.taskId,
    };
    return;
  }
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    placement: "bottom-start",
    taskId: task.taskId,
  };
}

function handleContextMenuSelect(key: string) {
  const task = activeMenuTask.value;
  contextMenu.value.show = false;
  if (!task || props.busy) return;
  const target = taskTarget(task);
  if (key === "play") emit("play", task);
  else if (key === "pause" || key === "resume" || key === "cancel" || key === "retry") {
    emit("action", key, task.taskId);
  } else if (key === "changeDirectory") emit("changeDirectory", task.taskId);
  else if (key === "repair") emit("repair", target);
  else if (key === "detail") emit("detail", target);
  else if (key === "locate") emit("locate", target, Boolean(task.fileId));
  else if (key === "remove") emit("remove", [target]);
}

function handleRowClick(task: DownloadTaskSnapshot) {
  if (!batchMode.value) return;
  toggle(task.taskId);
}

function handleRowDblClick(task: DownloadTaskSnapshot) {
  if (batchMode.value || props.busy) return;
  if (canPlayTask(task)) emit("play", task);
}

function enterBatch() {
  if (props.busy) return;
  contextMenu.value.show = false;
  selected.value = new Set();
  batchMode.value = true;
  emit("batchModeChange", true);
}

function exitBatch() {
  if (props.busy) return;
  selected.value = new Set();
  batchMode.value = false;
  emit("batchModeChange", false);
}

function performBatchAction(key: string) {
  if (props.busy) return;
  if (key === "refresh") emit("refresh");
  else if (key === "selectAll") selectVisible(false);
  else if (key === "invert") selectVisible(true);
  else if (key === "repair") {
    if (repairableSelectedTargets.value.length) {
      emit("batchRepair", repairableSelectedTargets.value);
    }
  } else if (key === "remove") removeSelected();
  else if (key === "exit") exitBatch();
}

function toggle(id: string) {
  if (props.busy) return;
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selected.value = next;
}

function selectVisible(invert: boolean) {
  if (props.busy) return;
  const next = new Set(selected.value);
  for (const task of visibleTasks.value) {
    if (invert && next.has(task.taskId)) next.delete(task.taskId);
    else next.add(task.taskId);
  }
  selected.value = next;
}

function removeSelected() {
  if (props.busy || !selected.value.size) return;
  emit(
    "remove",
    props.tasks
      .filter((task) => selected.value.has(task.taskId))
      .map((task) => taskTarget(task))
  );
}

defineExpose({ enterBatch, exitBatch });
</script>

<style scoped>
.download-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
  padding: 0;
}

.list-toolbar span {
  color: var(--text-secondary);
  font-size: 12px;
}

.task-row {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 8px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-control);
  background: var(--surface-card);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.task-row:hover {
  background: var(--surface-row-hover);
}

.task-row.is-playing,
.task-row.is-selected {
  background: var(--surface-row-playing);
  border-color: var(--border-row-selected);
}

.task-progress-bg {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 0;
  background: var(--surface-control-active);
  opacity: 0.72;
  pointer-events: none;
  transition: width 0.25s ease;
}

.task-progress-bg.is-running::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.16) 50%,
    transparent 100%
  );
  animation: task-shimmer 1.8s ease-in-out infinite;
}

@keyframes task-shimmer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}

.row-checkbox,
.task-cover,
.task-main,
.row-actions {
  position: relative;
  z-index: 1;
}

.task-cover {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-control-hover);
}

.task-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.task-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.task-line-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.task-title {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-title.is-playing {
  color: var(--text-accent);
}

.task-status-tag {
  flex-shrink: 0;
}

.task-line-secondary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.task-meta-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.task-singer {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-pill-tag {
  flex-shrink: 0;
  padding: 0 5px;
  border-radius: 4px;
  border: 1px solid var(--border-subtle);
  font-size: 10px;
  line-height: 15px;
  color: var(--text-secondary);
}

.task-pill-tag.is-quality {
  color: var(--text-accent);
  border-color: var(--border-row-selected);
}

.task-status-text {
  flex-shrink: 0;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.task-status-text.is-error {
  color: var(--color-error, #d03050);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.empty-state {
  padding: 70px 0;
}

@media (prefers-reduced-motion: reduce) {
  .task-progress-bg {
    transition: none;
  }
  .task-progress-bg.is-running::after {
    animation: none;
  }
}
</style>
