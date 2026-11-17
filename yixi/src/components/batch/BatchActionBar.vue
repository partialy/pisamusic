<template>
  <div class="batch-action-bar">
    <BatchSegmentedActions :actions="actions" @action="perform" />
    <span v-if="preparing" class="selection-count is-status">
      <n-icon :component="LoadingIcon" :size="14" class="status-spin" />
      <span>正在加载...</span>
    </span>
    <span v-else-if="prepareDone" class="selection-count is-status is-done">
      <n-icon :component="CircleCheck" :size="14" class="done-icon" />
      <span>加载完成</span>
    </span>
    <span v-else class="selection-count">已选择 {{ songs.length }} 首</span>
    <p v-if="result" role="status">完成 {{ result.succeeded }}，跳过 {{ result.skipped }}，失败 {{ result.failed }}，未执行 {{ result.unexecuted }} / 共 {{ result.total }}。</p>
    <details v-if="result?.errors.length"><summary>查看失败项</summary><p v-for="error in result.errors" :key="error.key">{{ error.name }}：{{ error.message }}</p></details>
    <AddToPlaylistDialog ref="playlistDialog" />
    <BatchDownloadDialog ref="downloadDialog" />
  </div>
</template>
<script setup lang="ts">
import { NIcon, type DialogReactive } from "naive-ui";
import { computed, onBeforeUnmount, ref, type Component } from "vue";
import { CheckCheck, CircleCheck, FlipHorizontal2, Heart, Download, ListPlus, Trash2, X, RefreshCw, Square } from "lucide-vue-next";
import { LoadingIcon } from "@/icons";
import BatchSegmentedActions from "./BatchSegmentedActions.vue";
import type { Song } from "@/types/song";
import { useCollectStore, useListenTogetherStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { runBatchAction, type BatchResult } from "@/batch/BatchActionCoordinator";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";
import AddToPlaylistDialog from "@/components/player/AddToPlaylistDialog.vue";
import BatchDownloadDialog from "./BatchDownloadDialog.vue";
const props = withDefaults(defineProps<{ songs: Song[]; context?: "songs" | "favorites" | "playlist" | "local" | "download"; canRemove?: boolean; refreshLoading?: boolean; disabled?: boolean; preparing?: boolean; prepareDone?: boolean }>(), { context: "songs", canRemove: false, preparing: false, prepareDone: false });
const emit = defineEmits<{ selectAll: []; invert: []; exit: []; remove: [songs: Song[]]; refresh: []; busy: [value: boolean] }>();
const collector = useCollectStore(), listenTogether = useListenTogetherStore(), commands = usePlaybackCommands();
const playlistDialog = ref<InstanceType<typeof AddToPlaylistDialog>>();
const downloadDialog = ref<InstanceType<typeof BatchDownloadDialog>>();
const busy = ref(false), result = ref<BatchResult | null>(null);
let controller: AbortController | undefined, generation = 0;
let unfavoriteDialog: DialogReactive | undefined;
const actions = computed(() => {
  const disabled = busy.value || props.disabled || props.preparing;
  const selectedDisabled = disabled || !props.songs.length;
  const local = props.context === "local" || props.context === "download";
  const items: { key: string; label: string; icon: Component; disabled?: boolean; loading?: boolean }[] = [];
  if (local) items.push({ key: "refresh", label: "刷新", icon: RefreshCw, disabled, loading: props.refreshLoading });
  items.push({ key: "selectAll", label: "全选", icon: CheckCheck, disabled }, { key: "invert", label: "反选", icon: FlipHorizontal2, disabled });
  if (local || props.context === "favorites") items.push({ key: "remove", label: "移除", icon: Trash2, disabled: selectedDisabled });
  else items.push({ key: "favorite", label: "收藏", icon: Heart, disabled: selectedDisabled });
  if (!local) items.push({ key: "download", label: "下载", icon: Download, disabled: selectedDisabled });
  items.push({ key: "add", label: "添加到", icon: ListPlus, disabled: selectedDisabled });
  if (props.canRemove && !local && props.context !== "favorites") items.push({ key: "remove", label: "移除", icon: Trash2, disabled: selectedDisabled });
  items.push({ key: busy.value ? "stop" : "exit", label: busy.value ? "停止后续操作" : "退出", icon: busy.value ? Square : X, disabled: props.disabled });
  return items;
});

function snapshot(): Song[] { return JSON.parse(JSON.stringify(props.songs)) as Song[]; }
const stopIdentity = onLibraryIdentityChanged(() => { generation++; controller?.abort(); unfavoriteDialog?.destroy(); result.value = null; busy.value = false; emit('busy', false); });
onBeforeUnmount(() => { generation++; controller?.abort(); unfavoriteDialog?.destroy(); stopIdentity(); });
async function run(action: "favorite" | "unfavorite" | "queue", frozenTargets?: Song[], expectedRevision?: number) {
  if (busy.value || props.disabled || !props.songs.length || (action === "queue" && listenTogether.enabled)) return;
  const targets = frozenTargets || snapshot(), current = ++generation;
  controller = new AbortController();
  busy.value = true;
  emit('busy', true);
  result.value = null;
  try {
    const revision = expectedRevision ?? await captureLibraryRevision();
    if (current !== generation) return;
    const next = await runBatchAction(targets, async song => {
      if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，后续操作已停止");
      if (action === "queue") {
        const appended = await commands.appendUniqueToPlaylist([song], () => current === generation && isCurrentLibraryRevision(revision));
        return appended.added.length ? "succeeded" : "skipped";
      }
      if (action === "favorite") {
        const payload = { ...song, identityRevision: revision };
        const result = await window.electronAPI.ensureFavoriteSong(payload);
        return result.added ? "succeeded" : "skipped";
      } else {
        const payload = { source: song.source, id: song.id, identityRevision: revision };
        return await window.electronAPI.removeFavoriteSong(payload) ? "succeeded" : "skipped";
      }
    }, { signal: controller.signal, onProgress: progress => { if (current === generation) result.value = progress as BatchResult; } });
    if (current !== generation) return;
    result.value = next;
    if (action !== "queue") await collector.reload();
  } catch (error) {
    if (current === generation) window.$message.error(error instanceof Error ? error.message : "批量操作失败");
  } finally { if (current === generation) { busy.value = false; emit('busy', false); } }
}
async function confirmUnfavorite() {
  if (unfavoriteDialog) return;
  const targets = snapshot(), current = generation;
  if (!targets.length) return;
  const revision = await captureLibraryRevision();
  if (current !== generation || !isCurrentLibraryRevision(revision)) return;
  unfavoriteDialog = window.$dialog.warning({
    title: "移除收藏", content: `确定取消收藏选中的 ${targets.length} 首歌曲？`, positiveText: "移除", negativeText: "取消",
    onPositiveClick: async () => {
      if (current !== generation || !isCurrentLibraryRevision(revision)) { window.$message.warning("账号已变化，请重新选择"); return; }
      await run("unfavorite", targets, revision);
    },
    onAfterLeave: () => { unfavoriteDialog = undefined; },
  });
}
function perform(action: string) {
  if (action === "stop") { controller?.abort(); return; }
  if (action === "exit") { if (!props.disabled) emit("exit"); return; }
  if (busy.value || props.disabled || props.preparing) return;
  if (action === "selectAll") emit("selectAll");
  else if (action === "invert") emit("invert");
  else if (action === "refresh") emit("refresh");
  else if (!props.songs.length) return;
  else if (action === "download") void downloadDialog.value?.open(snapshot());
  else if (action === "add" || action === "playlist") void playlistDialog.value?.openMany(snapshot(), { includeQueue: true });
  else if ((action === "remove" && props.context === "favorites") || action === "unfavorite") void confirmUnfavorite();
  else if (action === "remove" && props.canRemove) emit('remove', snapshot());
  else if (action === "favorite" || action === "queue") void run(action);
}

defineExpose({ perform });
</script>
<style scoped>
.batch-action-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 0; color: var(--text-primary); }
.selection-count { color: var(--text-secondary); font-size: 12px; white-space: nowrap; }
.selection-count.is-status { display: inline-flex; align-items: center; gap: 4px; }
.selection-count.is-done .done-icon { color: #10b981; }
.status-spin { animation: batch-status-spin 1s linear infinite; }
@keyframes batch-status-spin { to { transform: rotate(360deg); } }
.batch-action-bar p, .batch-action-bar details { flex-basis: 100%; margin: 0; color: var(--text-secondary); font-size: 12px; }
</style>
