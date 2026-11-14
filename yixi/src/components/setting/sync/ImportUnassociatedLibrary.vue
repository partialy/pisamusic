<template>
  <div :class="showEntry ? 'setting-item' : undefined">
    <div v-if="showEntry" class="setting-info">
      <div class="setting-title">导入本机未关联数据</div>
      <div class="setting-desc">确认后复制到当前账号，保留本机原数据。取消不会导入或上传。</div>
    </div>
    <n-button v-if="showEntry" secondary round :disabled="!loggedIn" :loading="previewLoading" @click="openPreview(false)">查看并导入</n-button>
    <AppModal v-model:show="show" title="导入本机未关联数据" :width="460" :close-disabled="importing">
      <template v-if="preview">
        <p>将以下数据复制到账号「{{ preview.accountName }}」：</p>
        <p>收藏歌曲 {{ preview.songs }} 首，收藏歌单 {{ preview.favorites }} 个，自建歌单 {{ preview.playlists }} 个。</p>
        <p>原数据保留，自建歌单会创建新副本。已导入的歌单再次导入会产生新副本。</p>
      </template>
      <template #footer>
        <n-button round :disabled="importing" @click="show = false">取消</n-button>
        <n-button round type="primary" :disabled="!hasData" :loading="importing" @click="confirmImport">确认导入</n-button>
      </template>
    </AppModal>
  </div>
</template>
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { NButton } from "naive-ui";
import AppModal from "@/components/common/AppModal.vue";
import type { UnassociatedPreview } from "@/types/accountLibrary";
import { reportError } from "@/utils/errorReporter";
const props = withDefaults(defineProps<{ loggedIn: boolean; autoPrompt?: boolean; showEntry?: boolean }>(), { autoPrompt: false, showEntry: true });
const show = ref(false);
const importing = ref(false);
const previewLoading = ref(false);
const preview = ref<UnassociatedPreview | null>(null);
const hasData = computed(() => Boolean(preview.value && preview.value.songs + preview.value.favorites + preview.value.playlists));
let generation = 0;
const stopIdentity = window.electronAPI.onAccountIdentityChanged(() => {
  generation++;
  show.value = false;
  preview.value = null;
  previewLoading.value = false;
  if (props.autoPrompt && props.loggedIn) void openPreview(true);
});
watch(() => props.loggedIn, loggedIn => { if (loggedIn && props.autoPrompt) void openPreview(true); }, { immediate: true });
onUnmounted(stopIdentity);
async function openPreview(automatic = false) {
  if (previewLoading.value || importing.value) return;
  previewLoading.value = true;
  const requestGeneration = ++generation;
  try {
    const next = automatic ? await window.electronAPI.getUnassociatedImportPrompt() : await window.electronAPI.previewUnassociatedLibrary();
    if (!next || requestGeneration !== generation) return;
    const identity = await window.electronAPI.getLibraryIdentity();
    if (next.identityRevision !== identity.identityRevision || requestGeneration !== generation) return;
    preview.value = next;
    show.value = true;
  } catch (error) {
    void reportError(error, { scope: "account-library", action: "preview-import" });
    if (!automatic) window.$message.error("读取未关联数据失败");
  } finally { if (requestGeneration === generation) previewLoading.value = false; }
}
async function confirmImport() {
  if (importing.value || !preview.value || !hasData.value) return;
  const confirmed = preview.value;
  importing.value = true;
  try {
    await window.electronAPI.importUnassociatedLibrary(confirmed.confirmationId);
    show.value = false;
    preview.value = null;
    window.$message.success("已导入当前账号");
  } catch (error) {
    void reportError(error, { scope: "account-library", action: "import" });
    window.$message.error(error instanceof Error ? error.message : "导入失败");
  } finally { importing.value = false; }
}
</script>
<style lang="scss" scoped>
@use "../settingLayout.scss";
p { color: var(--text-secondary); line-height: 1.7; }
</style>
