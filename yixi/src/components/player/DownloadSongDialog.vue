<template>
  <n-modal v-model:show="show" preset="card" class="download-dialog" title="下载歌曲">
    <div class="song-line">
      <img :src="coverUrl" :alt="song?.name || ''" />
      <div>
        <div class="song-name">{{ song?.name || "未知歌曲" }}</div>
        <div class="song-meta">{{ song?.singer || "未知歌手" }}</div>
      </div>
    </div>

    <div class="form-row">
      <div class="label">音质</div>
      <n-select
        v-model:value="qualityKey"
        :options="qualitySelectOptions"
        placeholder="选择音质" />
    </div>

    <div class="form-row">
      <div class="label">保存到</div>
      <div class="path-row">
        <n-input v-model:value="directory" readonly placeholder="请选择下载目录" />
        <n-button secondary @click="chooseDirectory">选择</n-button>
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <n-button quaternary @click="show = false">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="confirmDownload">确定下载</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NInput, NModal, NSelect } from "naive-ui";
import type { Song } from "@/types/song";
import { useAudioStore } from "@/store/audio";
import { useSettingStore } from "@/store/settingStore";
import { defaultSongCover, getSongCover } from "@/utils/common";
import { startSongDownload } from "@/utils/api/downloadAPI";
import { getDefaultQualityKey, getQualityOptionsForSong, isQualitySource } from "@/utils/musicQuality";
import electronAPI from "@/utils/electron";

const player = useAudioStore();
const settingStore = useSettingStore();
const show = ref(false);
const submitting = ref(false);
const song = ref<Song | null>(null);
const qualityKey = ref("");
const directory = ref("");

const qualityOptions = computed(() => getQualityOptionsForSong(song.value));
const qualitySelectOptions = computed(() =>
  qualityOptions.value.map((option) => ({
    label: option.label,
    value: option.key,
  }))
);
const coverUrl = computed(() => song.value ? getSongCover(song.value) : defaultSongCover);

async function open(target: Song | null | undefined) {
  if (!target) {
    window.$message.warning("当前没有可下载的歌曲");
    return;
  }
  if (!isQualitySource(target.source)) {
    window.$message.warning("当前歌曲来源暂不支持下载");
    return;
  }
  song.value = target;
  await settingStore.initLocalSetting();
  directory.value = settingStore.local.downloadDirectory;
  qualityKey.value =
    player.getPreferredQualityKey(target.source) ||
    qualityOptions.value[0]?.key ||
    getDefaultQualityKey(target.source);
  show.value = true;
}

async function chooseDirectory() {
  const selected = await electronAPI.selectDirectory("选择下载目录");
  if (!selected) return;
  directory.value = selected;
  await settingStore.updateDownloadDirectory(selected);
}

async function confirmDownload() {
  if (!song.value) return;
  if (!qualityKey.value) {
    window.$message.warning("请选择下载音质");
    return;
  }
  if (!directory.value) {
    await chooseDirectory();
    if (!directory.value) return;
  }

  submitting.value = true;
  try {
    await startSongDownload(song.value, qualityKey.value, directory.value);
    window.$message.success("已加入下载任务");
    show.value = false;
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : "创建下载任务失败");
  } finally {
    submitting.value = false;
  }
}

defineExpose({ open });
</script>

<style scoped lang="scss">
.download-dialog {
  width: min(480px, calc(100vw - 32px));
}

.song-line {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;

  img {
    width: 52px;
    height: 52px;
    object-fit: cover;
    border-radius: 8px;
  }
}

.song-name {
  color: var(--color-text-default);
  font-size: 15px;
  font-weight: 700;
}

.song-meta {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.form-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  margin-top: 14px;

  .label {
    color: var(--color-text-secondary);
    font-size: 13px;
  }
}

.path-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
