<template>
  <AppModal :show="show" title="批量下载" :icon="Download" :close-disabled="submitting" @update:show="close">
    <div class="batch-download-form">
      <p>共选择 {{ plan.total }} 首，可入队 {{ plan.count }} 首；不支持、不可播放及重复项跳过 {{ plan.skipped }} 首。</p>
      <label v-for="[source, songs] in plan.groups" :key="source">
        <span>{{ source.toUpperCase() }} · {{ songs.length }} 首</span>
        <n-select v-model:value="qualities[source]" :options="qualityOptions(source)" :disabled="submitting" />
      </label>
      <div class="batch-directory"><n-input :value="directory" readonly placeholder="选择下载目录" /><n-button round :disabled="submitting" @click="chooseDirectory"><template #icon><n-icon :component="FolderOpen" /></template>选择</n-button></div>
      <n-checkbox v-model:checked="redownload" :disabled="submitting">已完成的歌曲也重新下载，保留原文件</n-checkbox>
      <n-checkbox v-if="plan.count > 100" v-model:checked="largeConfirmed" :disabled="submitting">确认将超过 100 首歌曲加入下载队列</n-checkbox>
      <p v-if="message" role="status">{{ message }}</p>
    </div>
    <template #footer>
      <n-button round :disabled="submitting" @click="close(false)"><template #icon><n-icon :component="X" /></template>关闭</n-button>
      <n-button v-if="submitting" round @click="cancelEnqueue = true"><template #icon><n-icon :component="Square" /></template>停止后续入队</n-button>
      <n-button round type="primary" :loading="submitting" :disabled="!plan.count || (plan.count > 100 && !largeConfirmed)" @click="enqueue"><template #icon><n-icon :component="ListPlus" /></template>加入下载队列</n-button>
    </template>
  </AppModal>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { NButton, NCheckbox, NIcon, NInput, NSelect } from "naive-ui";
import { Download, FolderOpen, ListPlus, Square, X } from "lucide-vue-next";
import AppModal from "@/components/common/AppModal.vue";
import type { Song } from "@/types/song";
import { planBatchDownloads } from "@/batch/BatchDownloadPlanner";
import { enqueueDownloads } from "@/utils/api/downloadAPI";
import { getQualityOptionsForSong, type QualitySource } from "@/utils/musicQuality";
import { getQualityAccessLevel, normalizeQualityKeyForAccess } from "@/musicQuality/musicQualityPolicy";
import { useAudioStore, useUserStore } from "@/store";
import { useSettingStore } from "@/store/settingStore";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";
const show = ref(false), submitting = ref(false), directory = ref(""), message = ref(""), largeConfirmed = ref(false);
const targets = ref<Song[]>([]);
const redownload = ref(false), cancelEnqueue = ref(false);
const qualities = reactive<Record<string, string>>({});
const plan = computed(() => planBatchDownloads(targets.value));
const user = useUserStore(), audio = useAudioStore(), settings = useSettingStore();
let revision = -1, generation = 0;
const stopIdentity = onLibraryIdentityChanged(() => { generation++; show.value = false; targets.value = []; });
onBeforeUnmount(() => { generation++; stopIdentity(); });
function qualityOptions(source: QualitySource) {
  return getQualityOptionsForSong({ source }, getQualityAccessLevel(user)).map(option => ({ value: option.key, label: `${option.label}${option.enabled ? '' : `（${option.badge || '需登录'}）`}`, disabled: !option.enabled }));
}
async function open(songs: Song[]) {
  if (submitting.value) return;
  const request = ++generation;
  const currentRevision = await captureLibraryRevision();
  await settings.initLocalSetting();
  if (request !== generation || !isCurrentLibraryRevision(currentRevision)) return;
  revision = currentRevision;
  targets.value = JSON.parse(JSON.stringify(songs)) as Song[];
  directory.value = settings.local.downloadDirectory;
  for (const source of plan.value.groups.keys()) qualities[source] = normalizeQualityKeyForAccess(source, audio.getPreferredQualityKey(source), getQualityAccessLevel(user));
  message.value = "";
  largeConfirmed.value = false;
  redownload.value = false;
  show.value = true;
}
function close(next: boolean) { if (!next && !submitting.value) { generation++; show.value = false; } }
async function chooseDirectory() {
  const selected = await window.electronAPI.selectDirectory("选择批量下载目录");
  if (selected && show.value && isCurrentLibraryRevision(revision)) { directory.value = selected; await settings.updateDownloadDirectory(selected); }
}
async function enqueue() {
  if (submitting.value || !plan.value.count || (plan.value.count > 100 && !largeConfirmed.value)) return;
  if (!isCurrentLibraryRevision(revision)) return;
  if (!directory.value) { await chooseDirectory(); if (!directory.value) return; }
  if (!isCurrentLibraryRevision(revision) || !show.value || !plan.value.count) return;
  for (const source of plan.value.groups.keys()) {
    if (!qualityOptions(source).some(option => option.value === qualities[source] && !option.disabled)) { message.value = "请选择当前账号可用的音质。"; return; }
  }
  const request = generation;
  submitting.value = true;
  cancelEnqueue.value = false;
  try {
    const items = [...plan.value.groups].flatMap(([source, songs]) => songs.map(song => ({ song, qualityKey: qualities[source], directory: directory.value, redownload: redownload.value })));
    const result = { added: 0, existing: 0, rejected: [] as { index: number; message: string }[], unexecuted: items.length };
    for (let offset = 0; offset < items.length; offset += 5000) {
      if (cancelEnqueue.value || request !== generation || !isCurrentLibraryRevision(revision)) break;
      const batch = items.slice(offset, offset + 5000);
      const response = await enqueueDownloads(batch, { identityRevision: revision });
      result.added += response.added; result.existing += response.existing;
      result.rejected.push(...response.rejected.map(item => ({ ...item, index: item.index + offset })));
      result.unexecuted -= batch.length;
    }
    if (request !== generation || !isCurrentLibraryRevision(revision)) return;
    message.value = `已入队 ${result.added} 首，已存在 ${result.existing} 首，跳过 ${plan.value.skipped} 首，失败 ${result.rejected.length} 首，未执行 ${result.unexecuted} 首。`;
    if (result.rejected.length) message.value += ` ${result.rejected.slice(0, 3).map(item => item.message).join('；')}`;
    else if (!result.unexecuted) { window.$message.success(message.value); show.value = false; }
  } catch (error) { if (request === generation) message.value = error instanceof Error ? error.message : "批量入队失败"; }
  finally { submitting.value = false; }
}
defineExpose({ open });
</script>
<style scoped>
.batch-download-form { display: grid; gap: 16px; color: var(--text-primary); }
.batch-download-form p { margin: 0; }
.batch-download-form label { display: grid; grid-template-columns: 110px minmax(0,1fr); gap: 12px; align-items: center; }
.batch-directory { display: flex; gap: 10px; }
</style>
