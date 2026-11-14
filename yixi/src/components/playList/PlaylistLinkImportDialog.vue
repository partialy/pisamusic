<template>
  <AppModal :show="show" title="链接导入歌单" :icon="LinkOutline" :close-disabled="loading" @update:show="emit('update:show', $event)">
    <div class="playlist-link-import">
      <p>粘贴网易云或酷狗的公开歌单链接，也可粘贴完整分享文案。</p>
      <n-input v-model:value="text" type="textarea" placeholder="歌单链接或分享文案" :maxlength="16000" :autosize="{ minRows: 4, maxRows: 8 }" :disabled="loading" />
      <p v-if="error" role="alert" class="import-error">{{ error }}</p>
      <span class="import-hint">将打开在线歌单详情；不支持短链接。</span>
    </div>
    <template #footer>
      <n-button round :disabled="loading" @click="paste">粘贴</n-button>
      <n-button round :disabled="loading" @click="emit('update:show', false)">关闭</n-button>
      <n-button round type="primary" :loading="loading" :disabled="!text.trim()" @click="openPlaylist">打开歌单</n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { NButton, NInput } from "naive-ui";
import { LinkOutline } from "@vicons/ionicons5";
import AppModal from "@/components/common/AppModal.vue";
import { parsePlaylistShareLink } from "@/utils/playlistShareLinkParser";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ (event: "update:show", value: boolean): void }>();
const router = useRouter();
const text = ref("");
const error = ref("");
const loading = ref(false);
watch(() => props.show, (show) => { if (show) { text.value = ""; error.value = ""; } });
watch(text, () => { error.value = ""; });

async function paste() {
  try { text.value = (await navigator.clipboard.readText()).slice(0, 16000); }
  catch { error.value = "无法读取剪贴板，请在输入框中手动粘贴。"; }
}

async function openPlaylist() {
  if (loading.value) return;
  const link = parsePlaylistShareLink(text.value);
  if (!link) { error.value = "未找到有效的网易云或酷狗公开歌单链接。"; return; }
  loading.value = true;
  error.value = "";
  try {
    const failure = await router.push({ path: "/playlist/detail", query: { id: link.id, origin: link.source } });
    if (failure && router.currentRoute.value.query.id !== link.id) throw new Error("导航失败，请重试。");
    emit("update:show", false);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "打开歌单失败，请重试。";
  } finally { loading.value = false; }
}
</script>

<style scoped>
.playlist-link-import { display: grid; gap: 14px; color: var(--text-primary); }
.playlist-link-import p { margin: 0; }
.import-hint { color: var(--text-secondary); font-size: 12px; }
.import-error { color: var(--n-error-color, #d03050); }
</style>
