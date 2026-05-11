<template>
  <div class="bar-container">
    <n-slider class="slider" :tooltip="false" v-model:value="currentTime" :max="duration" :step="0.01"
      v-on:update-value="handleSeek">
      <template #thumb>
        <n-image class="rail-img" preview-disabled :src="logo" style="width: 16px; height: 16px; border-radius: 50%" />
      </template>
    </n-slider>
    <div class="left">
      <div class="cover" @click="commonStore.openPlayer">
        <n-image preview-disabled :src="imgSrc" alt="cover" class="cover-image" />
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
            <span :key="currentLyric?.text" class="lyric text-line-1">{{
              currentLyric?.text
            }}</span>
          </transition>
          <!-- <span v-else class="lyric">{{ currentLyric }}</span> -->
        </div>
      </div>
    </div>
    <div class="middle">
      <PlayControlBtn></PlayControlBtn>
    </div>
    <div class="right">
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
import { debounce, formatDuration, getKgImage, renderIcon } from '@/utils/common';
import { computed, ref, watch } from "vue";
import songImg from "@/assets/images/song.jpg";
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
} from "@/icons";
import { useCommonStore } from "@/store/commonStore";
import type { RepeatMode } from "@/store/audio";
import electronAPI from "@/utils/electron";
const player = useAudioStore();
const lyric = useLyricStore();

const commonStore = useCommonStore();
const { currentTime, duration, currentSong, isPlaying, volume, repeatMode } =
  storeToRefs(player);
const { parsedLrc, desktop } = storeToRefs(lyric);
const currentIndex = ref(0);
const imgSrc = computed(() => {
  if (currentSong.value)
    return currentSong.value.source == "kg"
      ? getKgImage(currentSong.value.cover)
      : currentSong.value.cover;
  return songImg;
});

const currentLyric = computed(() => {
  if (currentIndex.value > parsedLrc.value.length || currentIndex.value < 0) {
    return parsedLrc.value[parsedLrc.value.length - 1];
  }
  return parsedLrc.value[currentIndex.value];
});

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
  player.seek(val);
}, 50);

let v = 0;
watch(
  () => currentTime.value,
  (val) => {
    if (val != v && Math.abs(val - v) > 1) {
      v = val;
      lyric.currentTime = val;
      currentIndex.value = parsedLrc.value.findIndex(
        (item) => item.endTime && item.endTime >= val
      );
      // console.log("currentTime", currentTime.value, currentIndex.value, parsedLrc.value[currentIndex.value], lyric.currentTime);
    }
  }
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
