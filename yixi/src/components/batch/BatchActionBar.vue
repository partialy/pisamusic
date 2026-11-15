<template>
  <div class="batch-action-bar">
    <span>已选择 {{ songs.length }} 首</span>
    <n-button round size="small" :disabled="busy" @click="emit('selectAll')">全选筛选结果</n-button>
    <n-button round size="small" :disabled="busy" @click="emit('invert')">反选</n-button>
    <n-button round size="small" :disabled="!songs.length || busy" @click="run('favorite')">收藏</n-button>
    <n-button v-if="context === 'favorites'" round size="small" :disabled="!songs.length || busy" @click="run('unfavorite')">取消收藏</n-button>
    <n-button round size="small" :disabled="!songs.length || busy" @click="downloadDialog?.open(snapshot())">下载</n-button>
    <n-button round size="small" :disabled="!songs.length || busy" @click="playlistDialog?.openMany(snapshot())">添加到歌单</n-button>
    <n-button round size="small" :disabled="!songs.length || busy || listenTogether.enabled" @click="run('queue')">添加到队列</n-button>
    <n-button v-if="canRemove" round size="small" :disabled="!songs.length || busy" @click="emit('remove', snapshot())">移除</n-button>
    <n-button v-if="busy" round size="small" @click="controller?.abort()">停止后续操作</n-button>
    <n-button v-else round size="small" @click="emit('exit')">退出批量</n-button>
    <p v-if="result" role="status">完成 {{ result.succeeded }}，跳过 {{ result.skipped }}，失败 {{ result.failed }}，未执行 {{ result.unexecuted }} / 共 {{ result.total }}。</p>
    <details v-if="result?.errors.length"><summary>查看失败项</summary><p v-for="error in result.errors" :key="error.key">{{ error.name }}：{{ error.message }}</p></details>
    <AddToPlaylistDialog ref="playlistDialog" />
    <BatchDownloadDialog ref="downloadDialog" />
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { NButton } from "naive-ui";
import type { Song } from "@/types/song";
import { useCollectStore, useListenTogetherStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { runBatchAction, type BatchResult } from "@/batch/BatchActionCoordinator";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";
import AddToPlaylistDialog from "@/components/player/AddToPlaylistDialog.vue";
import BatchDownloadDialog from "./BatchDownloadDialog.vue";
const props = withDefaults(defineProps<{ songs: Song[]; context?: "songs" | "favorites" | "playlist" | "local" | "download"; canRemove?: boolean }>(), { context: "songs", canRemove: false });
const emit = defineEmits<{ selectAll: []; invert: []; exit: []; remove: [songs: Song[]]; busy: [value: boolean] }>();
const collector = useCollectStore(), listenTogether = useListenTogetherStore(), commands = usePlaybackCommands();
const playlistDialog = ref<InstanceType<typeof AddToPlaylistDialog>>();
const downloadDialog = ref<InstanceType<typeof BatchDownloadDialog>>();
const busy = ref(false), result = ref<BatchResult | null>(null);
let controller: AbortController | undefined, generation = 0;
function snapshot(): Song[] { return JSON.parse(JSON.stringify(props.songs)) as Song[]; }
const stopIdentity = onLibraryIdentityChanged(() => { generation++; controller?.abort(); result.value = null; busy.value = false; emit('busy', false); });
onBeforeUnmount(() => { generation++; controller?.abort(); stopIdentity(); });
async function run(action: "favorite" | "unfavorite" | "queue") {
  if (busy.value || !props.songs.length) return;
  const targets = snapshot(), current = ++generation;
  controller = new AbortController();
  busy.value = true;
  emit('busy', true);
  result.value = null;
  try {
    const revision = await captureLibraryRevision();
    if (current !== generation) return;
    const next = await runBatchAction(targets, async song => {
      if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，后续操作已停止");
      if (action === "queue") return await commands.appendToPlaylist([song]) ? "succeeded" : "skipped";
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
function perform(action: string) {
  if (busy.value) return;
  if (action === "download") void downloadDialog.value?.open(snapshot());
  else if (action === "playlist") void playlistDialog.value?.openMany(snapshot());
  else if (action === "remove" && props.canRemove) emit('remove', snapshot());
  else if (action === "favorite" || action === "unfavorite" || action === "queue") void run(action);
}
defineExpose({ perform });
</script>
<style scoped>
.batch-action-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 0; color: var(--text-primary); }
.batch-action-bar p, .batch-action-bar details { flex-basis: 100%; margin: 0; color: var(--text-secondary); font-size: 12px; }
</style>
