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
                <n-icon :color="mode == 'dark' ? '#fff' : '#000'" :component="DownloadIcon" />
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
              <n-select
                v-model:value="qualityKey"
                class="field-control"
                :to="false"
                :options="qualitySelectOptions"
                placeholder="选择音质" />
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
import { NButton, NIcon, NInput, NSelect } from "naive-ui";
import { Download as DownloadIcon, X } from "lucide-vue-next";
import type { Song } from "@/types/song";
import { useAudioStore } from "@/store/audio";
import { useSettingStore } from "@/store/settingStore";
import { defaultSongCover, getSongCover } from "@/utils/common";
import { startSongDownload } from "@/utils/api/downloadAPI";
import { getDefaultQualityKey, getQualityOptionsForSong, isQualitySource } from "@/utils/musicQuality";
import electronAPI from "@/utils/electron";
import { useThemeStore } from "@/store";
import { storeToRefs } from "pinia";

const player = useAudioStore();
const settingStore = useSettingStore();
const theme = useThemeStore();
const { mode } = storeToRefs(theme);
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

function closeDialog() {
  if (submitting.value) return;
  show.value = false;
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
.download-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(14px) saturate(118%);
}

.download-dialog-panel {
  width: min(440px, calc(100vw - 32px));
  max-width: 440px;
  max-height: calc(100vh - 48px);
  overflow: visible;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--color-bg-default) 74%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-bg-default) 94%, #fff 6%), color-mix(in srgb, var(--color-bg-secondary) 88%, #fff 12%));
  box-shadow:
    0 30px 86px rgba(10, 18, 32, 0.25),
    0 12px 34px rgba(10, 18, 32, 0.16);
  backdrop-filter: blur(28px) saturate(138%);
}

:global(:root[data-theme="dark"]) .download-dialog-panel {
  border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-bg-default) 90%, #2a3548 10%), color-mix(in srgb, var(--color-bg-secondary) 92%, #23304a 8%));
  box-shadow:
    0 34px 96px rgba(0, 0, 0, 0.46),
    0 14px 38px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 10px;
}

.dialog-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--color-text-default);
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0;
}

.title-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  box-shadow: none;
  font-size: 30px;
}

.close-btn {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background-color 0.18s ease;

  &:hover {
    color: var(--color-text-default);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }
}

.dialog-body {
  padding: 14px 24px 8px;
}

.song-line {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 12px;
  margin-bottom: 18px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-primary) 7%, transparent);

  img {
    width: 58px;
    height: 58px;
    object-fit: cover;
    border-radius: 14px;
    box-shadow: 0 10px 24px rgba(10, 18, 32, 0.16);
  }
}

.song-info {
  min-width: 0;
}

.song-name {
  color: var(--color-text-default);
  font-size: 15px;
  font-weight: 750;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-meta {
  margin-top: 5px;
  color: var(--color-text-secondary);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
    font-weight: 650;
  }
}

.field-control {
  min-width: 0;
  max-width: 100%;
}

.path-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-input {
  min-width: 0;
  flex: 1 1 auto;
}

.path-btn {
  flex: 0 0 auto;
  border-radius: 12px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 24px;
}

.cancel-btn,
.confirm-btn {
  min-width: 84px;
  height: 40px;
  border-radius: 14px;
}

.confirm-btn {
  color: #fff;
  background: var(--color-primary);
  box-shadow: 0 12px 26px color-mix(in srgb, var(--color-primary) 34%, transparent);

  &:hover {
    color: #fff;
    background: var(--color-primary-hover);
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
