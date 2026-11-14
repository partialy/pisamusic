<template>
  <AppModal :show="show" title="转为本地歌单" :close-disabled="phase === 'saving'" @update:show="close">
    <div class="conversion-content">
      <p>将完整读取「{{ playlist?.name }}」并创建新的自建歌单，保留原在线歌单。</p>
      <p class="conversion-hint">仅保存曲目信息，不下载音频。</p>
      <p v-if="phase === 'loading'" role="status">正在读取 {{ loaded }} / {{ total }} 首</p>
      <p v-if="phase === 'saving'" role="status">正在保存歌单…</p>
      <p v-if="error" role="alert">{{ error }}</p>
    </div>
    <template #footer>
      <n-button round :disabled="phase === 'saving'" @click="close(false)">{{ phase === 'loading' ? '取消加载' : '关闭' }}</n-button>
      <n-button round type="primary" :loading="phase !== 'idle'" @click="convert">确认转换</n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { NButton } from "naive-ui";
import { useRouter } from "vue-router";
import AppModal from "@/components/common/AppModal.vue";
import type { CommonPlaylist } from "@/types/song";
import { loadOnlinePlaylist } from "@/playlist/onlinePlaylistBatchLoader";
import { saveConvertedPlaylist } from "@/playlist/onlinePlaylistConversion";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";

const props = defineProps<{ show: boolean; playlist?: CommonPlaylist }>();
const emit = defineEmits<{ (event: "update:show", value: boolean): void }>();
const router = useRouter();
const phase = ref<"idle" | "loading" | "saving">("idle");
const loaded = ref(0);
const total = ref(0);
const error = ref("");
let controller: AbortController | undefined;
let generation = 0;
watch(() => props.show, show => {
  if (show) { error.value = ""; loaded.value = total.value = 0; }
  else { controller?.abort(); generation++; }
});
function close(show: boolean) {
  if (show || phase.value === "saving") return;
  controller?.abort();
  generation++;
  phase.value = "idle";
  emit("update:show", false);
}
const stopIdentity = onLibraryIdentityChanged(() => { controller?.abort(); });
onBeforeUnmount(() => { generation++; controller?.abort(); stopIdentity(); });

async function convert() {
  const playlist = props.playlist;
  if (phase.value !== "idle" || !playlist || (playlist.source !== "kg" && playlist.source !== "wy")) return;
  const current = ++generation;
  controller = new AbortController();
  phase.value = "loading";
  error.value = "";
  try {
    const revision = await captureLibraryRevision();
    if (current !== generation || controller.signal.aborted) return;
    const result = await loadOnlinePlaylist(playlist.source, playlist.id, {
      signal: controller.signal,
      onProgress: (done, count) => { if (current === generation) { loaded.value = done; total.value = count; } },
    });
    if (current !== generation || controller.signal.aborted) return;
    if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，请重新确认转换。");
    phase.value = "saving";
    const created = await saveConvertedPlaylist(result.playlist, result.songs, revision);
    if (current !== generation) return;
    phase.value = "idle";
    emit("update:show", false);
    window.$message.success(`已创建「${created.name}」`);
    void router.push({ path: "/playlist/detail", query: { id: created.id, origin: "local" } })
      .catch(() => window.$message.warning("歌单已保存，可从我的音乐中打开。"));
  } catch (cause) {
    if (current !== generation) return;
    error.value = cause instanceof Error ? cause.message : "转换失败，请重试。";
  } finally {
    if (current === generation) phase.value = "idle";
  }
}
</script>

<style scoped>
.conversion-content { display: grid; gap: 12px; color: var(--text-primary); }
.conversion-content p { margin: 0; }
.conversion-hint { color: var(--text-secondary); font-size: 12px; }
</style>
