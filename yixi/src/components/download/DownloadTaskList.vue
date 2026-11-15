<template>
  <div class="download-list">
    <Teleport :to="batchToolbarTarget || 'body'" :disabled="!batchToolbarTarget">
      <div v-if="batchMode" class="list-toolbar">
        <BatchSegmentedActions :actions="batchActions" @action="performBatchAction" />
        <span>已选 {{ selected.size }} 项</span>
      </div>
    </Teleport>
    <div v-for="task in visibleTasks" :key="task.taskId" class="task-row">
      <n-checkbox v-if="batchMode" :checked="selected.has(task.taskId)" :disabled="busy" :aria-label="`选择${task.name}`" @update:checked="toggle(task.taskId)" />
      <div class="task-main">
        <div class="task-title">{{ task.name || task.songId }} <n-tag size="small" :type="task.source === 'wy' ? 'error' : task.source === 'kw' ? 'warning' : 'info'">{{ sourceLabel(task.source) }}</n-tag></div>
        <div v-if="task.singer || task.album" class="task-meta">{{ [task.singer, task.album].filter(Boolean).join(" · ") }}</div>
        <div class="task-meta">{{ statusLabel(task.status) }} · {{ qualityLabel(task.qualityKey) }} · {{ formatBytes(task.receivedBytes) }} / {{ task.totalBytes ? formatBytes(task.totalBytes) : '未知大小' }}<span v-if="task.speedBytesPerSecond > 0"> · {{ formatBytes(task.speedBytesPerSecond) }}/s</span></div>
        <n-progress type="line" :percentage="Math.min(100, Math.max(0, Math.round(task.progress || 0)))" :status="task.status === 'failed' ? 'error' : task.status === 'completed' ? 'success' : 'default'" />
        <n-text v-if="task.error" type="error" class="task-error">{{ task.error }}</n-text>
        <div v-if="task.pauseReason" class="task-meta">恢复提示：{{ task.pauseReason }}</div>
        <div v-if="task.status === 'processing'" class="task-meta">正在写入元数据与关联文件，此阶段不能中断。</div>
      </div>
      <div class="row-actions">
        <n-button v-if="['queued', 'preparing', 'running'].includes(task.status)" round size="small" :disabled="busy" @click="emit('action', 'pause', task.taskId)"><template #icon><n-icon :component="Pause" /></template>暂停</n-button>
        <n-button v-if="task.status === 'paused'" round size="small" :disabled="busy" @click="emit('action', 'resume', task.taskId)"><template #icon><n-icon :component="Play" /></template>继续</n-button>
        <n-button v-if="task.status === 'paused' && !task.fileId" round size="small" :disabled="busy" title="通过系统选择器更换保存目录；选定后从零开始，保留其他下载配置" @click="emit('changeDirectory', task.taskId)"><template #icon><n-icon :component="FolderOpen" /></template>更换目录（从零开始）</n-button>
        <n-button v-if="['failed', 'cancelled'].includes(task.status)" round size="small" :disabled="busy" @click="emit('action', 'retry', task.taskId)"><template #icon><n-icon :component="RotateCcw" /></template>重试</n-button>
        <n-button v-if="!['completed', 'cancelled'].includes(task.status)" round size="small" :disabled="busy || ['processing', 'pausing'].includes(task.status)" @click="emit('action', 'cancel', task.taskId)"><template #icon><n-icon :component="CircleX" /></template>取消任务</n-button>
        <n-button round size="small" :disabled="busy" @click="emit('detail', task.fileId ? { fileId: task.fileId } : { taskId: task.taskId })"><template #icon><n-icon :component="Info" /></template>详情</n-button>
        <n-button round size="small" :disabled="busy || task.status === 'processing'" @click="emit('remove', [task.fileId ? { fileId: task.fileId } : { taskId: task.taskId }])"><template #icon><n-icon :component="Trash2" /></template>清理</n-button>
      </div>
    </div>
    <n-empty v-if="!visibleTasks.length" class="empty-state" :description="tasks.length ? '没有匹配的任务' : '暂无下载任务'" />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NCheckbox, NEmpty, NIcon, NProgress, NTag, NText } from "naive-ui";
import { RefreshCw, ListChecks, ArrowLeftRight, Trash2, X, Pause, Play, FolderOpen, RotateCcw, CircleX, Info } from "lucide-vue-next";
import BatchSegmentedActions from "@/components/batch/BatchSegmentedActions.vue";
import type { DownloadTaskSnapshot, DownloadFileTarget } from "@/types/download";
import { formatBytes, qualityLabel, sourceLabel, statusLabel } from "./downloadPresentation";
const props = defineProps<{ tasks: DownloadTaskSnapshot[]; searchKey: string; searchTerms?: Record<string, string>; busy: boolean; refreshing?: boolean; batchToolbarTarget?: HTMLElement | null }>();
const emit = defineEmits<{
  (event: "batchModeChange", value: boolean): void;
  (event: "refresh"): void;
  (event: "action", action: "pause" | "resume" | "cancel" | "retry", id: string): void;
  (event: "changeDirectory", id: string): void;
  (event: "detail", target: DownloadFileTarget): void;
  (event: "remove", targets: DownloadFileTarget[]): void;
}>();
const selected = ref(new Set<string>()), batchMode = ref(false);
const batchActions = computed(() => [
  { key: "refresh", label: "刷新", icon: RefreshCw, disabled: props.busy || props.refreshing, loading: props.refreshing },
  { key: "selectAll", label: "全选", icon: ListChecks, disabled: props.busy || !visibleTasks.value.length },
  { key: "invert", label: "反选", icon: ArrowLeftRight, disabled: props.busy || !visibleTasks.value.length },
  { key: "remove", label: "移除", icon: Trash2, disabled: props.busy || !selected.value.size },
  { key: "exit", label: "退出", icon: X, disabled: props.busy },
]);
function enterBatch() {
  if (props.busy) return;
  selected.value = new Set(); batchMode.value = true; emit("batchModeChange", true);
}
function exitBatch() {
  if (props.busy) return;
  selected.value = new Set(); batchMode.value = false; emit("batchModeChange", false);
}
function performBatchAction(key: string) {
  if (props.busy) return;
  if (key === "refresh") emit("refresh");
  else if (key === "selectAll") selectVisible(false);
  else if (key === "invert") selectVisible(true);
  else if (key === "remove") removeSelected();
  else if (key === "exit") exitBatch();
}
const visibleTasks = computed(() => {
  const search = props.searchKey.trim().toLowerCase();
  return props.tasks.filter(task => !search || [task.name, task.singer || "", task.album || "", task.songId, task.source, task.qualityKey, task.error, props.searchTerms?.[task.taskId] || ""].some(value => value.toLowerCase().includes(search)));
});
watch(() => props.tasks, tasks => { const ids = new Set(tasks.map(task => task.taskId)); selected.value = new Set([...selected.value].filter(id => ids.has(id))); });
function toggle(id: string) { if (props.busy) return; const next = new Set(selected.value); if (next.has(id)) next.delete(id); else next.add(id); selected.value = next; }
function selectVisible(invert: boolean) { if (props.busy) return; const next = new Set(selected.value); for (const task of visibleTasks.value) { if (invert && next.has(task.taskId)) next.delete(task.taskId); else next.add(task.taskId); } selected.value = next; }
function removeSelected() { if (props.busy || !selected.value.size) return; emit("remove", props.tasks.filter(task => selected.value.has(task.taskId)).map(task => task.fileId ? { fileId: task.fileId } : { taskId: task.taskId })); }
defineExpose({ enterBatch, exitBatch });
</script>
<style scoped>
.download-list { display: flex; flex-direction: column; gap: 10px; }
.list-toolbar, .row-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.list-toolbar { min-width: 0; padding: 0; }
.list-toolbar span, .task-meta { color: var(--text-secondary); font-size: 12px; }
.task-row { display: flex; gap: 12px; padding: 14px; border: 1px solid var(--border-subtle); border-radius: 12px; background: var(--surface-card); align-items: center; }
.task-main { flex: 1; min-width: 180px; }
.task-title { color: var(--text-primary); font-weight: 600; overflow-wrap: anywhere; }
.task-meta, .task-error { display: block; margin: 5px 0; overflow-wrap: anywhere; }
.task-error { font-size: 12px; }
.source-tag { color: var(--text-accent); font-size: 11px; }
.row-actions { max-width: 260px; justify-content: flex-end; }
.empty-state { padding: 70px 0; }
@media (max-width: 1000px) { .task-row { flex-wrap: wrap; } .row-actions { max-width: none; margin-left: 26px; } }
</style>
