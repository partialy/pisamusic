<template>
  <Teleport to="body">
    <Transition name="download-dialog">
      <div
        v-if="show"
        class="download-dialog-overlay"
        @click.self="closeDialog">
        <section
          class="download-dialog-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-dialog-title"
          @click.stop>
          <header class="dialog-header">
            <div class="dialog-title">
              <div class="title-icon">
                <n-icon :component="DownloadIcon" />
              </div>
              <span id="download-dialog-title">下载歌曲</span>
            </div>
            <button
              class="close-btn"
              type="button"
              aria-label="关闭"
              @click="closeDialog">
              <n-icon :component="X" />
            </button>
          </header>

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

          <footer class="dialog-actions">
            <n-button quaternary class="cancel-btn" @click="closeDialog">取消</n-button>
            <n-button class="confirm-btn" :loading="submitting" @click="confirmDownload">确定下载</n-button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NIcon, NInput } from "naive-ui";
import { Download as DownloadIcon, X, ChevronDown } from "lucide-vue-next";
import type { Song } from "@/types/song";
import { useAudioStore } from "@/store/audio";
import { useUserStore } from "@/store";
import { useSettingStore } from "@/store/settingStore";
import { defaultSongCover, getSongCover } from "@/utils/common";
import { startSongDownload } from "@/utils/api/downloadAPI";
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

const qualityOptions = computed(() =>
  getQualityOptionsForSong(song.value, getQualityAccessLevel(userStore))
);
const selectedQualityOption = computed(() => {
  return qualityOptions.value.find((opt) => opt.key === qualityKey.value) ||
    getQualityOption(qualityKey.value) ||
    null;
});
const coverUrl = computed(() => song.value ? getSongCover(song.value) : defaultSongCover);

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
  song.value = target;
  await settingStore.initLocalSetting();
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
  if (!song.value) return;
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
.download-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--overlay-bg);
  backdrop-filter: var(--glass-blur, blur(14px));
  -webkit-backdrop-filter: var(--glass-blur, blur(14px));
}

.download-dialog-panel {
  width: min(440px, calc(100vw - 32px));
  max-width: 440px;
  max-height: calc(100vh - 48px);
  overflow: visible;
  border-radius: 20px;
  background: var(--surface-modal);
  backdrop-filter: var(--glass-blur, blur(28px));
  -webkit-backdrop-filter: var(--glass-blur, blur(28px));
  border: 1px solid var(--border-modal);
  box-shadow: var(--shadow-modal);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 12px;
}

.dialog-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0;
}

.title-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-accent);
  font-size: 22px;
}

.close-btn {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  color: var(--text-secondary);
  background: var(--surface-card);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: var(--text-primary);
    background: var(--surface-card-hover);
  }
}

.dialog-body {
  padding: 12px 24px 8px;
}

.song-line {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  margin-bottom: 18px;
  border-radius: 14px;
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);

  img {
    width: 52px;
    height: 52px;
    object-fit: cover;
    border-radius: 10px;
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
  border-radius: 10px;
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
    border-radius: 10px !important;
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
  border-radius: 10px;
  background: var(--surface-card) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border-subtle) !important;
  transition: all 0.2s ease;

  &:hover {
    background: var(--surface-card-hover) !important;
    border-color: var(--border-default) !important;
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 22px;
  border-top: 1px solid var(--border-subtle);
  margin-top: 14px;
}

.cancel-btn,
.confirm-btn {
  min-width: 84px;
  height: 38px;
  border-radius: 10px;
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

.download-dialog-enter-active,
.download-dialog-leave-active {
  transition: opacity 0.18s ease;

  .download-dialog-panel {
    transition:
      transform 0.18s ease,
      opacity 0.18s ease;
  }
}

.download-dialog-enter-from,
.download-dialog-leave-to {
  opacity: 0;

  .download-dialog-panel {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}
</style>
