<template>
  <div class="control-panel">
    <!-- 左侧操作区 -->
    <div class="panel-left">
      <!-- 收起大屏播放器按钮 (圆角卡片胶囊风格) -->
      <button
        type="button"
        class="ctrl-btn collapse-btn"
        title="收起播放器"
        @click="commonStore.hidePlayer"
      >
        <n-icon :component="ArrowDownIcon" :size="20" />
      </button>

      <!-- 收藏/取消收藏 -->
      <button
        type="button"
        class="ctrl-btn"
        :class="{ collected: isCollected }"
        :title="isCollected ? '已收藏' : '收藏'"
        @click="collect.collectSong(currentSong || undefined)"
      >
        <n-icon
          :component="CollectIcon"
          :size="20"
          :color="isCollected ? '#ff5d6c' : ''"
        />
      </button>

      <!-- 添加到歌单 -->
      <button
        type="button"
        class="ctrl-btn"
        title="添加到歌单"
        :disabled="!currentSong"
        @click="addToPlaylistDialogRef?.open(currentSong || undefined)"
      >
        <n-icon :component="FolderPlus" :size="20" />
      </button>

      <!-- 下载歌曲 -->
      <button
        type="button"
        class="ctrl-btn"
        title="下载歌曲"
        :disabled="!qualityOptions.length"
        @click="songDownload.openDownloadDialog(currentSong || undefined)"
      >
        <n-icon :component="DownloadIcon" :size="20" />
      </button>
    </div>

    <!-- 中间播放主控区 + 进度条 -->
    <div class="panel-center">
      <!-- 上半部：播放模式 / 上一首 / 播放暂停 / 下一首 / 循环快捷 -->
      <div class="controls-row">
        <!-- 播放模式切换 (左侧) -->
        <PlayModePicker
          v-model="repeatMode"
          placement="top"
          @select="handleToggleMode"
        >
          <button type="button" class="ctrl-btn mode-btn" :title="playModeTitle">
            <n-icon :size="19" :component="playModeIcon" />
          </button>
        </PlayModePicker>

        <!-- 上一首 -->
        <button
          type="button"
          class="ctrl-btn round-btn prev-btn"
          title="上一首"
          :disabled="loading || switching"
          @click="playbackCommands.prev"
        >
          <n-icon :component="PrevIcon" :size="22" />
        </button>

        <!-- 主播放 / 暂停按钮 -->
        <button
          type="button"
          class="ctrl-btn main-play-btn"
          :title="isPlaying ? '暂停' : '播放'"
          @click="playbackCommands.togglePlayPause"
        >
          <n-icon v-if="!isPlaying" :component="PlayAnim" :size="30" />
          <n-icon v-else :component="PauseAnim" :size="30" />
        </button>

        <!-- 下一首 -->
        <button
          type="button"
          class="ctrl-btn round-btn next-btn"
          title="下一首"
          :disabled="loading || switching"
          @click="playbackCommands.next"
        >
          <n-icon :component="NextIcon" :size="22" />
        </button>

        <!-- 一起听入口 (替换播放键右侧循环图标) -->
        <div class="listen-ctrl-entry">
          <ListenTogetherEntry />
        </div>
      </div>

      <!-- 下半部：当前时间 - 进度条 - 总时长 -->
      <div class="progress-row">
        <span class="time-label current-time">{{ formatDuration(currentTime) }}</span>
        <div class="slider-wrapper">
          <n-slider
            class="control-slider"
            :value="currentTime"
            :max="duration || 100"
            :step="0.1"
            :tooltip="false"
            @update:value="handleSeek"
          />
        </div>
        <span class="time-label total-time">{{ formatDuration(duration) }}</span>
      </div>
    </div>

    <!-- 右侧功能区 -->
    <div class="panel-right">
      <!-- 1. 音质选择胶囊 -->
      <MusicQualityPicker
        :model-value="currentQualityKey"
        :options="qualityOptions"
        :disabled="!qualityOptions.length"
        placement="top"
        @update:model-value="handleSwitchQuality"
        @login-required="openAccountLogin"
        @unlock-required="openQualityUnlockFeedback"
      >
        <button
          type="button"
          class="quality-pill"
          :disabled="!qualityOptions.length"
          :title="currentQualityOption?.label || '选择音质'"
        >
          {{ currentQualityOption?.shortLabel || "AUTO" }}
        </button>
      </MusicQualityPicker>

      <!-- 2. 均衡器入口 -->
      <button
        type="button"
        class="ctrl-btn eq-btn"
        :class="{ active: equalizerStore.enabled }"
        :title="equalizerStore.enabled ? '均衡器已开启' : '均衡器'"
        @click="equalizerStore.openModal"
      >
        <n-icon
          :component="EqualizerIcon"
          :size="19"
          :color="equalizerStore.enabled ? 'var(--color-primary, #18a058)' : ''"
        />
      </button>

      <!-- 3. 桌面歌词开关 -->
      <button
        type="button"
        class="ctrl-btn lyric-btn"
        :class="{ active: desktop }"
        :title="desktop ? '桌面歌词已开启' : '开启桌面歌词'"
        @click="handleDesktopLyric"
      >
        <n-icon
          :component="LyricIcon"
          :size="20"
          :color="desktop ? '#fff' : ''"
        />
      </button>


      <!-- 音量调节 (Popover) -->
      <n-popover
        trigger="hover"
        style="padding: 0; border-radius: 12px"
        arrow-point-to-center
        @wheel="handleWheel"
      >
        <template #trigger>
          <button
            type="button"
            class="ctrl-btn volume-btn"
            title="音量调节"
            @click="toggleMuted"
            @wheel="handleWheel"
          >
            <n-icon :component="volumeIcon" :size="20" />
          </button>
        </template>
        <div style="width: 60px; height: 200px">
          <VolumePanel />
        </div>
      </n-popover>

      <!-- 播放列表抽屉 + 歌曲计数 Badge -->
      <div class="playlist-badge-wrapper">
        <button
          type="button"
          class="ctrl-btn playlist-btn"
          title="播放列表"
          @click="showSequence = true"
        >
          <n-icon :component="PlayListIcon" :size="20" />
          <span v-if="playlist.length > 0" class="count-badge">
            {{ playlist.length > 999 ? "999+" : playlist.length }}
          </span>
        </button>
      </div>
    </div>

    <!-- 抽屉与弹窗 -->
    <n-drawer
      v-model:show="showSequence"
      :style="{
        'backdrop-filter': 'blur(16px)',
        'background': '#1f1f23dd !important',
      }"
      placement="right"
      width="400px"
      to="body"
    >
      <PlaySequence />
    </n-drawer>

    <AddToPlaylistDialog ref="addToPlaylistDialogRef" />
    <DownloadSongDialog :ref="songDownload.downloadDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { NPopover, NIcon, NDrawer, NSlider } from "naive-ui";
import { FolderPlus, Download as DownloadIcon, Sliders as EqualizerIcon } from "lucide-vue-next";
import {
  useCommonStore,
  useAudioStore,
  useLyricStore,
  useCollectStore,
  useUserStore,
  useListenTogetherStore,
  useEqualizerStore,
} from "@/store";
import { VolumePanel, AddToPlaylistDialog } from ".";
import {
  ArrowDownIcon,
  PlayListIcon,
  VolumeMaxIcon,
  VolumeMediumIcon,
  VolumeMutedIcon,
  ListRandomIcon,
  ListRepeatOffIcon,
  ListRepeatOneIcon,
  ListScrollIcon,
  LyricIcon,
  CollectIcon,
  PrevIcon,
  NextIcon,
  PlayAnim,
  PauseAnim,
} from "@/icons";
import type { RepeatMode } from "@/store/audio";
import electronAPI from "@/utils/electron";
import PlaySequence from "./PlaySequence.vue";
import DownloadSongDialog from "./DownloadSongDialog.vue";
import { getQualityOption, getQualityOptionsForSong } from "@/utils/musicQuality";
import { getQualityAccessLevel } from "@/musicQuality/musicQualityPolicy";
import MusicQualityPicker from "./MusicQualityPicker.vue";
import PlayModePicker from "./PlayModePicker.vue";
import { useSongDownload } from "@/composables/useSongDownload";
import { useAccountLoginDialog } from "@/composables/useAccountLoginDialog";
import { useQualityUnlockFeedback } from "@/composables/useQualityUnlockFeedback";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import ListenTogetherEntry from "@/components/listenTogether/ListenTogetherEntry.vue";
import { formatDuration } from "@/utils/common";

const collect = useCollectStore();
const player = useAudioStore();
const userStore = useUserStore();
const listenTogether = useListenTogetherStore();
const equalizerStore = useEqualizerStore();
const playbackCommands = usePlaybackCommands();

const { openAccountLogin } = useAccountLoginDialog();
const { openQualityUnlockFeedback } = useQualityUnlockFeedback();
const lyric = useLyricStore();
const commonStore = useCommonStore();
const songDownload = useSongDownload();

const { volume, repeatMode, currentSong, isPlaying, loading, currentTime, duration, playlist } =
  storeToRefs(player);
const { desktop } = storeToRefs(lyric);

const switching = computed(() => listenTogether.pendingTransition);
const isCollected = computed(() => collect.containsSong(currentSong.value || undefined));

const muted = ref(false);
const showSequence = ref(false);
const addToPlaylistDialogRef = ref<InstanceType<typeof AddToPlaylistDialog> | null>(null);

const qualityOptions = computed(() =>
  getQualityOptionsForSong(currentSong.value, getQualityAccessLevel(userStore))
);
const currentQualityKey = computed(() => player.getPreferredQualityKey(currentSong.value?.source) || "");
const currentQualityOption = computed(() => {
  return getQualityOption(currentQualityKey.value) || qualityOptions.value[0] || null;
});

const handleToggleMode = (key: RepeatMode) => {
  repeatMode.value = key;
};

const handleSwitchQuality = (key: string) => {
  const option = getQualityOption(key);
  if (!option) return;
  void player.switchCurrentQuality(option);
};

const handleSeek = (time: number) => {
  playbackCommands.seekSeconds(time);
};

// 播放模式图标
const playModeIcon = computed(() => {
  switch (repeatMode.value) {
    case "none":
      return ListRepeatOffIcon;
    case "random":
      return ListRandomIcon;
    case "single":
      return ListRepeatOneIcon;
    default:
      return ListScrollIcon;
  }
});

const playModeTitle = computed(() => {
  switch (repeatMode.value) {
    case "none":
      return "顺序播放";
    case "random":
      return "随机播放";
    case "single":
      return "单曲循环";
    default:
      return "列表循环";
  }
});

const handleDesktopLyric = async () => {
  const snapshot = (await electronAPI.toggleLyricWindow()) as { visible?: boolean } | undefined;
  lyric.setDesktop(Boolean(snapshot?.visible));
  if (snapshot?.visible) {
    await lyric.sendToLyricWindow();
  }
};

const volumeIcon = computed(() => {
  if (muted.value || volume.value === 0) {
    return VolumeMutedIcon;
  } else if (volume.value >= 0.5) {
    return VolumeMaxIcon;
  } else {
    return VolumeMediumIcon;
  }
});

const handleWheel = (event: WheelEvent) => {
  const delta = event.deltaY > 0 ? -0.05 : 0.05;
  const v = volume.value;
  if (v + delta < 0) {
    volume.value = 0;
  } else if (v + delta > 1) {
    volume.value = 1;
  } else {
    volume.value = v + delta;
  }
};

let originalVolume = volume.value;
const toggleMuted = () => {
  muted.value = !muted.value;
  if (muted.value) {
    originalVolume = volume.value;
    volume.value = 0;
  } else {
    volume.value = originalVolume > 0 ? originalVolume : 0.5;
  }
};
</script>

<style scoped lang="scss">
.control-panel {
  width: 100%;
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 44px;
  box-sizing: border-box;
  background: transparent;
  user-select: none;

  .panel-left,
  .panel-right {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .panel-left {
    justify-content: flex-start;
  }

  .panel-right {
    justify-content: flex-end;
  }

  .panel-center {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin: 0 20px;
  }

  /* 通用控制按钮与 Hover 背景 */
  .ctrl-btn {
    position: relative;
    border: none;
    outline: none;
    background: transparent;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.72);
    cursor: pointer;
    transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      background: rgba(255, 255, 255, 0.18);
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    &.active {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.12);
    }

    &.eq-btn.active {
      color: var(--color-primary, #18a058);
      background: color-mix(in srgb, var(--color-primary, #18a058) 18%, transparent);
    }
  }

  /* 中间播放控制行 */

  .controls-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;

    .mode-btn {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.65);

      &:hover {
        color: #ffffff;
      }
    }

    .round-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      color: rgba(255, 255, 255, 0.85);
    }

    .main-play-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.28);
        transform: scale(1.06);
      }

      &:active:not(:disabled) {
        transform: scale(0.96);
      }
    }

    .listen-ctrl-entry {
      display: inline-flex;
      align-items: center;
      justify-content: center;

      :deep(.listen-entry) {
        width: 32px;
        min-width: 32px;
        height: 32px;
        padding: 0;
        border-radius: 6px;
        background: transparent !important;
        border: none !important;
        color: rgba(255, 255, 255, 0.65);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

        &:hover {
          background: rgba(255, 255, 255, 0.12) !important;
          color: #ffffff !important;
          transform: translateY(-1px);
        }

        &.active {
          color: var(--color-primary, #2897ff) !important;
          background: rgba(255, 255, 255, 0.12) !important;
        }

        .avatar-stack :deep(.n-avatar) {
          border-color: rgba(255, 255, 255, 0.2);
        }
      }
    }
  }

  /* 中间进度条与时间 */
  .progress-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 380px;
    max-width: 42vw;

    .time-label {
      font-size: 11px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.65);
      font-variant-numeric: tabular-nums;
      min-width: 34px;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);

      &.current-time {
        text-align: right;
      }

      &.total-time {
        text-align: left;
      }
    }

    .slider-wrapper {
      flex: 1;
      display: flex;
      align-items: center;

      :deep(.n-slider) {
        .n-slider-rail {
          height: 3px;
          border-radius: 2px;
          background-color: rgba(255, 255, 255, 0.2);

          .n-slider-rail__fill {
            background-color: rgba(255, 255, 255, 0.88);
            border-radius: 2px;
          }
        }

        .n-slider-handle {
          width: 9px;
          height: 9px;
          background-color: #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(0, 0, 0, 0.4);
          opacity: 0;
          transform: scale(0.6);
          transition: opacity 0.2s ease, transform 0.2s ease;
        }

        &:hover .n-slider-handle {
          opacity: 1;
          transform: scale(1);
        }
      }
    }
  }

  /* 右侧音质胶囊按钮 */
  .quality-pill {
    height: 24px;
    padding: 0 9px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: rgba(255, 255, 255, 0.88);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.22);
      border-color: rgba(255, 255, 255, 0.32);
      color: #ffffff;
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
  }

  /* 播放列表角标徽章 */
  .playlist-badge-wrapper {
    position: relative;
    display: inline-flex;

    .playlist-btn {
      position: relative;
    }

    .count-badge {
      position: absolute;
      top: -3px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.28);
      color: #ffffff;
      font-size: 10px;
      line-height: 16px;
      text-align: center;
      font-weight: 600;
      pointer-events: none;
      backdrop-filter: blur(4px);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }
  }
}
</style>
