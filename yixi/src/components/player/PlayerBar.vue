<template>
  <div class="bar-container">
    <n-slider class="slider" :tooltip="false" :value="currentTime" :max="duration" :step="0.01"
      @update:value="handleSeek">
      <template #thumb>
        <n-image class="rail-img" preview-disabled :src="logo" style="width: 16px; height: 16px; border-radius: 50%" />
      </template>
    </n-slider>
    <div class="left">
      <div class="cover" @click="commonStore.openPlayer">
        <n-image
          preview-disabled
          :src="imgSrc"
          :fallback-src="defaultSongCover"
          alt="cover"
          class="cover-image" />
      </div>
      <div class="info">
        <div class="title">
          {{ currentSong?.name || "未知歌名" }}
        </div>
        <div class="singer-lyric">
          <span v-if="!isPlaying" class="singer">{{
            currentSong?.singer || "未知歌手"
          }}</span>
          <transition v-else name="fade" mode="out-in">
            <PlayerBarKaraokeLyric
              v-if="showKaraokeLyric"
              :key="currentLyricLine?.startTime"
              class="lyric text-line-1"
              :line="currentLyricLine"
              :current-time="currentTime"
              :is-playing="isPlaying" />
            <span v-else :key="currentLyricText" class="lyric text-line-1">{{
              currentLyricText
            }}</span>
          </transition>
          <!-- <span v-else class="lyric">{{ currentLyric }}</span> -->
        </div>
      </div>
    </div>
    <div class="middle">
      <n-button
        quaternary
        circle
        class="middle-action"
        title="收藏"
        :disabled="!currentSong"
        @click="collect.collectSong(currentSong || undefined)">
        <template #icon>
          <n-icon
            :component="CollectIcon"
            :color="collect.containsSong(currentSong || undefined) ? '#ff5d6c' : 'var(--color-text-secondary)'"
            size="24px" />
        </template>
      </n-button>
      <PlayControlBtn></PlayControlBtn>
      <n-button
        quaternary
        circle
        class="middle-action"
        title="下载"
        :disabled="!qualityDropdownOptions.length"
        @click="songDownload.openDownloadDialog(currentSong || undefined)">
        <template #icon>
          <n-icon :component="DownloadIcon" size="22px" />
        </template>
      </n-button>
    </div>
    <div class="right">
      <ListenTogetherEntry />
      <n-dropdown
        :options="qualityDropdownOptions"
        trigger="click"
        placement="top"
        :disabled="!qualityDropdownOptions.length"
        @select="handleSwitchQuality"
        show-arrow
        show-on-focus>
        <n-button
          quaternary
          class="quality-pill"
          :disabled="!qualityDropdownOptions.length"
          :title="currentQualityOption?.label || '音质'">
          {{ currentQualityOption?.shortLabel || "AUTO" }}
        </n-button>
      </n-dropdown>
      <div class="time">
        {{ formatDuration(currentTime) }}/{{ formatDuration(duration) }}
      </div>
      <!-- 播放模式 -->
      <n-dropdown :options="playModeOptions" trigger="click" placement="top" @select="handleToggleMode" show-arrow
        show-on-focus>
        <n-button quaternary circle>
          <template #icon>
            <n-icon :size="26" :component="playModeIcon"></n-icon>
          </template>
        </n-button>
      </n-dropdown>
      <n-button quaternary title="桌面歌词" circle @click="handleDesktopLyric">
        <template #icon>
          <n-icon
            :component="LyricIcon"
            :color="desktop ? 'var(--color-primary)' : 'var(--color-text-secondary)'"
            size="24px"></n-icon>
        </template>
      </n-button>
      <!-- 音量 -->
      <n-popover trigger="hover" style="padding: 0; border-radius: 10px" arrow-point-to-center @wheel="handleWheel">
        <template #trigger>
          <n-button quaternary circle @click="toggleMuted" @wheel="handleWheel">
            <n-icon size="26" :component="volumeIcon" class="icon"></n-icon>
          </n-button>
        </template>
        <div style="width: 60px; height: 200px">
          <VolumePanel />
        </div>
      </n-popover>
      <!-- 播放列表 -->
      <n-button quaternary circle @click="showSequence = true">
        <template #icon>
          <n-icon :component="PlayListIcon" size="24px"></n-icon>
        </template>
      </n-button>
      <n-drawer :style="{
        'backdrop-filter': 'blur(16px)',
        'background': 'color-mix(in srgb, var(--color-primary) 6%, #ffffff20) !important'
      }"
      v-model:show="showSequence" placement="right" width="400px" to="body">
        <PlaySequence class="light" />
      </n-drawer>
    </div>
    <DownloadSongDialog :ref="songDownload.downloadDialogRef" />
  </div>
</template>

<script setup lang="ts">
import logo from "@/assets/pisamusic_icon_1024.png"
import {
  NSlider,
  NImage,
  NButton,
  NIcon,
  NDrawer,
  NPopover,
  NDropdown,
} from "naive-ui";
import { storeToRefs } from "pinia";
import { useAudioStore, useLyricStore } from "@/store";
import { PlayControlBtn, PlaySequence, VolumePanel } from ".";
import { debounce, defaultSongCover, formatDuration, renderIcon } from '@/utils/common';
import { EMPTY_LYRIC_TEXT, getLyricLineText } from "@/utils/lyricLine";
import { computed, ref, watch } from "vue";
import { Download as DownloadIcon } from "lucide-vue-next";
import {
  PlayListIcon,
  VolumeMutedIcon,
  VolumeMaxIcon,
  VolumeMediumIcon,
  ListRandomIcon,
  ListRepeatOffIcon,
  ListRepeatOneIcon,
  ListScrollIcon,
  LyricIcon,
  CollectIcon,
} from "@/icons";
import { useCommonStore } from "@/store/commonStore";
import type { RepeatMode } from "@/store/audio";
import electronAPI from "@/utils/electron";
import { useCollectStore } from "@/store/collect";
import { getQualityOption, getQualityOptionsForSong } from "@/utils/musicQuality";
import DownloadSongDialog from "./DownloadSongDialog.vue";
import { useSongDownload } from "@/composables/useSongDownload";
import { useSongCoverUrl } from "@/composables/useSongCoverUrl";
import PlayerBarKaraokeLyric from "./PlayerBarKaraokeLyric.vue";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import ListenTogetherEntry from "@/components/listenTogether/ListenTogetherEntry.vue";
const player = useAudioStore();
const playbackCommands = usePlaybackCommands();
const lyric = useLyricStore();
const collect = useCollectStore();
const songDownload = useSongDownload();

const commonStore = useCommonStore();
const { currentTime, duration, currentSong, isPlaying, volume, repeatMode } =
  storeToRefs(player);
const { desktop } = storeToRefs(lyric);
const qualityOptions = computed(() => getQualityOptionsForSong(currentSong.value));
const qualityDropdownOptions = computed(() =>
  qualityOptions.value.map((option) => ({
    label: option.label,
    key: option.key,
  }))
);
const currentQualityOption = computed(() => {
  const key = player.getPreferredQualityKey(currentSong.value?.source);
  return getQualityOption(key) || qualityOptions.value[0] || null;
});
const imgSrc = useSongCoverUrl(currentSong);

const currentLyricText = computed(() => {
  const text = getLyricLineText(lyric.currentLine);
  return text || EMPTY_LYRIC_TEXT;
});
const currentLyricLine = computed(() => lyric.currentLine);
const showKaraokeLyric = computed(() => lyric.isKaraokeLyricEnabled && Boolean(currentLyricLine.value));

// 播放模式
const playModeIcon = computed(() => {
  switch (repeatMode.value) {
    case "none":
      return ListRepeatOffIcon;
    case "random":
      return ListRandomIcon;
    case "single":
      return ListRepeatOneIcon;
    default:
      // all
      return ListScrollIcon;
  }
});

const playModeOptions = [
  { label: "列表循环", key: "all", icon: renderIcon(ListScrollIcon) },
  { label: "随机播放", key: "random", icon: renderIcon(ListRandomIcon) },
  { label: "单曲循环", key: "single", icon: renderIcon(ListRepeatOneIcon) },
  { label: "顺序播放", key: "none", icon: renderIcon(ListRepeatOffIcon) },
];

const handleToggleMode = (key: RepeatMode) => {
  repeatMode.value = key;
};

const handleSwitchQuality = (key: string) => {
  const option = getQualityOption(key);
  if (!option) return;
  void player.switchCurrentQuality(option);
};

const handleDesktopLyric = async () => {
  const snapshot = (await electronAPI.toggleLyricWindow()) as { visible?: boolean } | undefined;
  lyric.setDesktop(Boolean(snapshot?.visible));
  if (snapshot?.visible) {
    lyric.sendToLyricWindow();
  }
}

// 音量控制
const muted = ref(false);
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

// 播放列表控制
const showSequence = ref(false);

const handleSeek = debounce((val: number) => {
  playbackCommands.seekSeconds(val);
}, 50);

watch(
  () => currentTime.value,
  (val) => {
    lyric.currentTime = val;
  },
  { immediate: true }
);

const getLyric = debounce(() => {
  lyric.currentSong = currentSong.value;
  lyric.initLyric();
}, 300)

watch(
  () => currentSong.value,
  () => getLyric(),
  {
    immediate: true,
    deep: true,
  }
);
</script>

<style lang="scss" scoped>
@keyframes fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes fade-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active {
  animation: fade-in 0.3s;
}

.fade-leave-active {
  animation: fade-out 0.3s;
}

.slider {
  width: 100%;
  position: absolute;
  top: -8px;
  left: 0;

  .rail-img {
    will-change: auto;
    animation: rotate 12s linear infinite;
  }
}

.bar-container {
  width: 100%;
  height: 80px;
  display: flex;
  align-items: center;
  color: var(--color-text-default);
  background: var(--color-bg-track);
  border-top: 1px solid var(--color-player-bar-border);
  box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(16px);

  .left,
  .right {
    width: 35%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }

  .middle {
    width: 30%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;

    .middle-action {
      flex-shrink: 0;
    }
  }

  .left .cover {
    width: 80px;
    padding: 10px;
    cursor: pointer;
    flex-shrink: 0;

    .cover-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
      overflow: hidden;
    }
  }

  .info {
    width: calc(100% - 80px);

    .title {
      height: 28px;
      line-height: 28px;
      color: var(--color-text-default);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      .name {
        font-size: 16px;
        white-space: nowrap;
      }
    }

    .singer,
    .lyric {
      height: 28px;
      line-height: 28px;
      font-size: 16px;
      color: var(--color-text-secondary);
    }
  }

  .right {
    display: flex;
    justify-content: flex-end;
    padding-right: 20px;

    .quality-pill {
      min-width: 54px;
      height: 30px;
      padding: 0 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0;
      color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    }

    .time {
      font-size: 14px;
      color: var(--color-text-secondary);
    }
  }

  :deep(.n-button) {
    color: var(--color-text-secondary);

    &:hover {
      color: var(--color-primary);
    }
  }
}

:deep(.slider.n-slider .n-slider-rail) {
  background: var(--color-slider-rail);
  height: 5px;
  transition: all 0.2s ease-in-out;
}

:deep(.n-slider .n-slider-rail .n-slider-rail__fill) {
  background: var(--color-primary);
}
</style>
