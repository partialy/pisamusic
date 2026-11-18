<template>
  <AppModal :show="show" title="下载歌曲" :icon="DownloadIcon" :close-disabled="submitting" @update:show="closeDialog">
    <div class="dialog-body">
      <div class="song-line">
        <img :src="coverUrl" :alt="song?.name || ''" />
        <div class="song-info">
          <div class="song-name" :title="song?.name || ''">{{ song?.name || "未知歌曲" }}</div>
          <div class="song-meta" :title="song?.singer || ''">{{ song?.singer || "未知歌手" }}</div>
        </div>
      </div>

      <div class="form-row">
        <div class="label">音质</div>
        <MusicQualityPicker
          v-model="qualityKey"
          :options="qualityOptions"
          placement="bottom"
          :z-index="3500"
          @login-required="openAccountLogin"
          @unlock-required="openUnlockFeedback">
          <div class="quality-selector-box">
            <span class="selected-quality-label">{{ selectedQualityOption?.label || "选择音质" }}</span>
            <n-icon :component="ChevronDown" class="chevron-icon" />
          </div>
        </MusicQualityPicker>
      </div>

      <div class="form-row">
        <div class="label">保存到</div>
        <div class="path-row">
          <n-input
            v-model:value="directory"
            class="field-control path-input"
            readonly
            placeholder="请选择下载目录" />
          <n-button secondary class="path-btn" @click="chooseDirectory">选择</n-button>
        </div>
      </div>
    </div>

    <template #footer-options>
      <n-checkbox v-model:checked="redownload" :disabled="submitting">已下载则重新下载</n-checkbox>
    </template>
    <template #footer>
      <n-button quaternary class="cancel-btn" @click="closeDialog">取消</n-button>
      <n-button class="confirm-btn" :loading="submitting" @click="confirmDownload">确定下载</n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import AppModal from "@/components/common/AppModal.vue";
import { computed, onBeforeUnmount, ref } from "vue";
import { NButton, NCheckbox, NIcon, NInput } from "naive-ui";
import { Download as DownloadIcon, ChevronDown } from "lucide-vue-next";
import type { Song } from "@/types/song";
import { useAudioStore } from "@/store/audio";
import { useUserStore } from "@/store";
import { useSettingStore } from "@/store/settingStore";
import { defaultSongCover, getSongCover } from "@/utils/common";
import { enqueueDownloads } from "@/utils/api/downloadAPI";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";
import { getQualityOption, getQualityOptionsForSong, isQualitySource } from "@/utils/musicQuality";
import {
  getQualityAccessLevel,
  isQualityKeyAllowed,
  normalizeQualityKeyForAccess,
} from "@/musicQuality/musicQualityPolicy";
import electronAPI from "@/utils/electron";
import { useAccountLoginDialog } from "@/composables/useAccountLoginDialog";
import { useQualityUnlockFeedback } from "@/composables/useQualityUnlockFeedback";
import MusicQualityPicker from "./MusicQualityPicker.vue";

const player = useAudioStore();
const userStore = useUserStore();
const settingStore = useSettingStore();
const { openAccountLogin } = useAccountLoginDialog();
const { openQualityUnlockFeedback } = useQualityUnlockFeedback();
const show = ref(false);
const submitting = ref(false);
const song = ref<Song | null>(null);
const qualityKey = ref("");
const directory = ref("");
const redownload = ref(false);
let revision = -1, generation = 0;
const stopIdentity = onLibraryIdentityChanged(() => { generation++; show.value = false; song.value = null; });
onBeforeUnmount(() => { generation++; stopIdentity(); });

const qualityOptions = computed(() =>
  getQualityOptionsForSong(song.value, getQualityAccessLevel(userStore))
);
const selectedQualityOption = computed(() => {
  return qualityOptions.value.find((opt) => opt.key === qualityKey.value) ||
    getQualityOption(qualityKey.value) ||
    null;
});
const coverUrl = computed(() => song.value ? getSongCover(song.value, 480) : defaultSongCover);

async function open(target: Song | null | undefined) {
  if (!target) {
    window.$message.warning("当前没有可下载的歌曲");
    return;
  }
  if (target.playable === false) {
    window.$message.warning("该歌曲已禁用，无法下载");
    return;
  }
  if (!isQualitySource(target.source)) {
    window.$message.warning("当前歌曲来源暂不支持下载");
    return;
  }
  const request = ++generation;
  const currentRevision = await captureLibraryRevision();
  await settingStore.initLocalSetting();
  if (request !== generation || !isCurrentLibraryRevision(currentRevision)) return;
  revision = currentRevision;
  song.value = target;
  redownload.value = false;
  directory.value = settingStore.local.downloadDirectory;
  const access = getQualityAccessLevel(userStore);
  qualityKey.value = normalizeQualityKeyForAccess(
    target.source,
    player.getPreferredQualityKey(target.source),
    access,
  );
  show.value = true;
}

function closeDialog() {
  if (submitting.value) return;
  show.value = false;
}

function openUnlockFeedback() {
  closeDialog();
  void openQualityUnlockFeedback();
}

async function chooseDirectory() {
  const selected = await electronAPI.selectDirectory("选择下载目录");
  if (!selected) return;
  directory.value = selected;
  await settingStore.updateDownloadDirectory(selected);
}

async function confirmDownload() {
  if (!song.value || submitting.value || !isCurrentLibraryRevision(revision)) return;
  if (!isQualitySource(song.value.source)) {
    window.$message.warning("当前歌曲来源暂不支持下载");
    return;
  }
  if (!qualityKey.value) {
    window.$message.warning("请选择下载音质");
    return;
  }
  const access = getQualityAccessLevel(userStore);
  if (!isQualityKeyAllowed(song.value.source, qualityKey.value, access)) {
    window.$message.warning("当前音质需要登录账号后下载");
    openAccountLogin();
    return;
  }
  if (!directory.value) {
    await chooseDirectory();
    if (!directory.value) return;
  }

  submitting.value = true;
  try {
    if (!song.value || !isCurrentLibraryRevision(revision) || !show.value) return;
    const items = JSON.parse(JSON.stringify([{ song: song.value, qualityKey: qualityKey.value, directory: directory.value, redownload: redownload.value }]));
    const result = await enqueueDownloads(items, { identityRevision: revision });
    if (!isCurrentLibraryRevision(revision)) return;
    if (result.rejected.length) throw new Error(result.rejected[0].message);
    if (result.existing) { window.$message.info("已有相同任务或已完成文件；需要新副本时请勾选重新下载。"); return; }
    window.$message.success(`已加入 ${result.added} 个下载任务`);
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
.dialog-body { min-width: 0; }

.song-line {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  margin-bottom: 18px;
  border-radius: var(--radius-control);
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);

  img {
    width: 52px;
    height: 52px;
    object-fit: cover;
    border-radius: var(--radius-control);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  }
}

.song-info {
  min-width: 0;
}

.song-name {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-meta {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-row {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  margin-top: 14px;

  .label {
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
  }
}

.field-control {
  min-width: 0;
  max-width: 100%;
}

.quality-selector-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 12px;
  border-radius: var(--radius-control);
  border: 1px solid var(--border-subtle);
  background: var(--surface-input);
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-default);
    background: var(--surface-input-hover);
  }

  .selected-quality-label {
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron-icon {
    color: var(--text-secondary);
    font-size: 16px;
    flex-shrink: 0;
  }
}

.path-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;

  :deep(.n-input) {
    background: var(--surface-input) !important;
    border: 1px solid var(--border-subtle) !important;
    border-radius: var(--radius-control) !important;
    color: var(--text-primary) !important;

    .n-input__input-el {
      color: var(--text-primary) !important;
      font-size: 13px;
    }

    .n-input__placeholder {
      color: var(--text-muted) !important;
    }

    &:hover,
    &.n-input--focus {
      border-color: var(--border-default) !important;
    }
  }
}

.path-btn {
  flex: 0 0 auto;
  height: 38px;
  border-radius: var(--radius-pill);
  background: var(--surface-card) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border-subtle) !important;
  transition: all 0.2s ease;

  &:hover {
    background: var(--surface-card-hover) !important;
    border-color: var(--border-default) !important;
  }
}

.cancel-btn,
.confirm-btn {
  min-width: 84px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 600;
}

.cancel-btn {
  color: var(--text-secondary) !important;
  background: var(--surface-card) !important;
  border: 1px solid var(--border-subtle) !important;
  transition: all 0.2s ease;

  &:hover {
    color: var(--text-primary) !important;
    background: var(--surface-card-hover) !important;
  }
}

.confirm-btn {
  color: #ffffff !important;
  background: var(--color-primary) !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-primary-hover) !important;
  }
}

</style>
