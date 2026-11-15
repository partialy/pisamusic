<template>
  <AppModal :show="show" :title="playlistId ? '编辑歌单' : '新建歌单'" :icon="ListMusic" :width="500" :close-disabled="submitting" @update:show="requestClose">
    <div class="cover-row">
      <img :src="coverPreview" alt="歌单封面" @error="playlistCoverFallback($event, currentPlaylist)" />
      <div class="cover-actions">
        <n-button secondary :loading="selecting" :disabled="submitting" @click="chooseCover">选择本机图片</n-button>
        <n-button quaternary :disabled="submitting" @click="coverChoice = { kind: 'default' }">恢复默认</n-button>
        <span class="cover-tip">JPG / PNG / WebP，最大 5MiB；先保存在本机</span>
      </div>
    </div>
    <div class="presets">
      <button v-for="preset in playlistCoverPresets" :key="preset.id" type="button" :title="preset.name" :disabled="submitting" :aria-pressed="coverChoice.kind === 'preset' && coverChoice.preset === preset.id" @click="coverChoice = { kind: 'preset', preset: preset.id }">
        <img :src="preset.image" :alt="preset.name" />
      </button>
    </div>
    <div v-if="currentPlaylist?.coverUploadStatus && coverChoice.kind === 'keep'" class="upload-status" role="status">
      {{ currentPlaylist.coverUploadStatus.message }}
      <n-button v-if="currentPlaylist.coverUploadStatus.canRetry" quaternary size="small" :loading="retrying" :disabled="submitting" @click="retryCover">
        {{ currentPlaylist.coverUploadStatus.state === 'synced' ? '重新上传本机副本' : '重试上传' }}
      </n-button>
    </div>
    <label class="form-row"><span>标题</span><n-input v-model:value="form.name" :disabled="submitting" maxlength="40" show-count placeholder="输入歌单标题" /></label>
    <label class="form-row"><span>描述</span><n-input v-model:value="form.desc" :disabled="submitting" type="textarea" maxlength="160" show-count placeholder="可选，写点这个歌单的心情" /></label>
    <div class="form-row">
      <span>标签</span>
      <div class="tag-box">
        <div v-if="form.tags.length" class="tag-list"><n-tag v-for="tag in form.tags" :key="tag.id" :closable="!submitting" round @close="form.tags = form.tags.filter(item => item.id !== tag.id)">{{ tag.name }}</n-tag></div>
        <div class="tag-input-row"><n-input v-model:value="tagInput" :disabled="submitting || form.tags.length >= 3" maxlength="12" placeholder="最多 3 个标签" @keyup.enter="addTag" /><n-button secondary :disabled="submitting || form.tags.length >= 3" @click="addTag">添加</n-button></div>
      </div>
    </div>
    <template #footer>
      <n-button quaternary :disabled="submitting" @click="requestClose">取消</n-button>
      <n-button type="primary" :loading="submitting" :disabled="selecting || retrying" @click="submit">保存</n-button>
    </template>
  </AppModal>
</template>
<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from "vue";
import { NButton, NInput, NTag } from "naive-ui";
import { ListMusic } from "lucide-vue-next";
import AppModal from "@/components/common/AppModal.vue";
import type { CommonPlaylist } from "@/types/song";
import type { PlaylistCoverChoice } from "@/types/playlistCover";
import { useMineLibraryStore } from "@/store";
import { selectPlaylistCover } from "@/utils/api/mineLibraryAPI";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";
import { getPlaylistCover, playlistCoverFallback, playlistCoverPresets } from "@/playlist/playlistCover";
const emit = defineEmits<{ saved: [playlist: CommonPlaylist] }>();
const store = useMineLibraryStore();
const show = ref(false);
const playlistId = ref<string>();
const original = ref<CommonPlaylist>();
const submitting = ref(false);
const selecting = ref(false);
const retrying = ref(false);
const tagInput = ref("");
const selectedPreview = ref("");
const coverChoice = ref<PlaylistCoverChoice>({ kind: "keep" });
const form = reactive({ name: "", desc: "", tags: [] as CommonPlaylist["tags"] });
let generation = 0;
let revision = -1;
let baseline = "";
let confirmationOpen = false;
const currentPlaylist = computed(() => store.localPlaylists.find(item => item.id === playlistId.value) || original.value);
const coverPreview = computed(() => {
  if (coverChoice.value.kind === "local") return selectedPreview.value;
  if (coverChoice.value.kind === "default") return getPlaylistCover();
  if (coverChoice.value.kind === "preset") return playlistCoverPresets.find(item => item.id === (coverChoice.value as { preset: string }).preset)?.image || getPlaylistCover();
  return getPlaylistCover(currentPlaylist.value, 240);
});
function snapshot() { return JSON.stringify([form.name, form.desc, form.tags, coverChoice.value, tagInput.value]); }
async function open(playlist?: CommonPlaylist) {
  const request = ++generation;
  const capturedRevision = await captureLibraryRevision();
  if (request !== generation) return;
  revision = capturedRevision;
  playlistId.value = playlist?.id;
  original.value = playlist ? JSON.parse(JSON.stringify(playlist)) : undefined;
  form.name = playlist?.name || ""; form.desc = playlist?.desc || ""; form.tags = playlist?.tags.map(tag => ({ ...tag })) || [];
  coverChoice.value = { kind: "keep" }; selectedPreview.value = ""; tagInput.value = "";
  submitting.value = false; selecting.value = false; retrying.value = false; baseline = snapshot(); show.value = true;
}
function close() { generation++; show.value = false; }
function requestClose() {
  if (submitting.value) return;
  if (snapshot() === baseline) { close(); return; }
  if (confirmationOpen) return;
  confirmationOpen = true;
  const request = generation;
  window.$dialog.warning({ title: "放弃修改？", content: "未保存的标题、描述、标签和封面选择将丢失。", positiveText: "放弃修改", negativeText: "继续编辑", onPositiveClick: () => { if (request === generation) close(); }, onAfterLeave: () => { confirmationOpen = false; } });
}
async function chooseCover() {
  const request = generation; selecting.value = true;
  try {
    const selected = await selectPlaylistCover();
    if (request !== generation || !show.value || !isCurrentLibraryRevision(revision)) return;
    if (selected) { selectedPreview.value = selected.preview; coverChoice.value = { kind: "local", assetId: selected.assetId }; }
  } catch (error) { if (request === generation) window.$message.error(error instanceof Error ? error.message : "封面选择失败"); }
  finally { if (request === generation) selecting.value = false; }
}
function addTag() {
  const name = tagInput.value.trim();
  if (!name || form.tags.length >= 3 || submitting.value) return;
  if (!form.tags.some(tag => tag.name === name)) form.tags.push({ name, id: name });
  tagInput.value = "";
}
async function retryCover() {
  if (!playlistId.value) return;
  const request = generation; retrying.value = true;
  try { await store.retryPlaylistCover(playlistId.value, revision); }
  catch (error) { if (request === generation && isCurrentLibraryRevision(revision)) window.$message.error(error instanceof Error ? error.message : "封面重试失败"); }
  finally { if (request === generation) retrying.value = false; }
}
async function submit() {
  if (submitting.value || selecting.value || retrying.value) return;
  if (!form.name.trim()) { window.$message.warning("请填写歌单标题"); return; }
  const request = generation; submitting.value = true;
  try {
    const playlist = await store.savePlaylistEdit({ playlistId: playlistId.value, identityRevision: revision, name: form.name, desc: form.desc, tags: form.tags.map(tag => ({ ...tag })), coverChoice: { ...coverChoice.value } });
    if (request !== generation || !isCurrentLibraryRevision(revision)) return;
    emit("saved", playlist); window.$message.success(playlistId.value ? "歌单已保存" : "歌单创建成功"); close();
  } catch (error) { if (request === generation && isCurrentLibraryRevision(revision)) window.$message.error(error instanceof Error ? error.message : "歌单保存失败"); }
  finally { if (request === generation) submitting.value = false; }
}
const stopIdentity = onLibraryIdentityChanged(close);
onUnmounted(() => { generation++; stopIdentity(); });
defineExpose({ open });
</script>
<style scoped lang="scss">
.cover-row { display: grid; grid-template-columns: 90px minmax(0,1fr); gap: 16px; align-items: center; > img { width: 90px; height: 90px; border-radius: var(--radius-control); object-fit: cover; } }
.cover-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.cover-tip, .upload-status { color: var(--text-secondary); font-size: 12px; }
.cover-tip { flex-basis: 100%; }
.upload-status { margin-top: 12px; }
.presets { display: flex; gap: 8px; margin-top: 14px; button { padding: 2px; background: transparent; border: 2px solid transparent; border-radius: var(--radius-control); cursor: pointer; &[aria-pressed="true"] { border-color: var(--text-accent); } img { display: block; width: 48px; height: 48px; border-radius: 8px; } } }
.form-row { display: grid; grid-template-columns: 48px minmax(0,1fr); gap: 12px; margin-top: 16px; > span { padding-top: 8px; color: var(--text-secondary); font-size: 13px; } }
.tag-box { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.tag-list, .tag-input-row { display: flex; gap: 8px; flex-wrap: wrap; }
.tag-input-row { flex-wrap: nowrap; }
:deep(.n-button) { border-radius: var(--radius-pill); }
</style>
