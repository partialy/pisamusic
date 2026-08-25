<template>
  <div class="control-panel">
    <div class="panel-left">
      <n-button text @click="commonStore.hidePlayer">
        <n-icon :component="ArrowDownIcon" class="icon"></n-icon>
      </n-button>
      <n-button text title="收藏" @click="collect.collectSong(currentSong || undefined)">
        <n-icon
          :component="CollectIcon"
          :color="collect.containsSong(currentSong || undefined) ? '#ff5d6c' : 'var(--color-text-third)'"
          class="icon"></n-icon>
      </n-button>
      <MusicQualityPicker
        :model-value="currentQualityKey"
        :options="qualityOptions"
        :disabled="!qualityOptions.length"
        placement="top"
        @update:model-value="handleSwitchQuality"
        @login-required="openAccountLogin">
        <n-button text class="quality-pill" :disabled="!qualityOptions.length">
          {{ currentQualityOption?.shortLabel || "AUTO" }}
        </n-button>
      </MusicQualityPicker>
      <n-button
        text
        circle
        title="下载"
        :disabled="!qualityOptions.length"
        @click="songDownload.openDownloadDialog(currentSong || undefined)">
        <n-icon :component="DownloadIcon" class="icon"></n-icon>
      </n-button>
    </div>
    <div class="panel-center">
      <PlayControlBtn color="#ffffffcc" />
    </div>
    <div class="panel-right">
      <ListenTogetherEntry variant="overlay" />
      <!-- 播放模式 -->
      <PlayModePicker
        v-model="repeatMode"
        placement="top"
        @select="handleToggleMode">
        <n-button quaternary circle>
          <template #icon>
            <n-icon :size="26" :component="playModeIcon" class="icon"></n-icon>
          </template>
        </n-button>
      </PlayModePicker>
      <n-button quaternary title="桌面歌词" circle @click="handleDesktopLyric">
        <template #icon>
          <n-icon :component="LyricIcon" size="24px" :color="desktop ? '#fff':''" class="icon"></n-icon>
        </template>
      </n-button>
      <n-popover trigger="hover" style="padding: 0; border-radius: 10px" @wheel="handleWheel">
        <template #trigger>
          <n-button text circle @click="toggleMuted" @wheel="handleWheel">
            <n-icon :component="volumeIcon" class="icon"></n-icon>
          </n-button>
        </template>
        <div style="width: 60px; height: 200px">
          <VolumePanel />
        </div>
      </n-popover>
      <!-- 播放列表 -->
      <n-button quaternary circle @click="showSequence = true">
        <template #icon>
          <n-icon :component="PlayListIcon" size="24px" class="icon"></n-icon>
        </template>
      </n-button>
      <n-drawer :style="{
        'backdrop-filter': 'blur(16px)',
        'background': '#efefef30 !important'
      }"
      v-model:show="showSequence" placement="right" width="400px" to="body">
        <PlaySequence />
      </n-drawer>
    </div>
    <DownloadSongDialog :ref="songDownload.downloadDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { NPopover, NIcon, NButton } from "naive-ui";
import { useCommonStore, useAudioStore, useLyricStore, useCollectStore, useUserStore } from "@/store";
import { PlayControlBtn, VolumePanel } from ".";
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";
import { Download as DownloadIcon } from "lucide-vue-next";
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
  CollectIcon
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
import ListenTogetherEntry from "@/components/listenTogether/ListenTogetherEntry.vue";

const collect = useCollectStore();
const player = useAudioStore();
const userStore = useUserStore();
const { openAccountLogin } = useAccountLoginDialog();
const lyric = useLyricStore();
const commonStore = useCommonStore();
const songDownload = useSongDownload();

const { volume, repeatMode, currentSong } = storeToRefs(player);
const { desktop } = storeToRefs(lyric);
const muted = ref(false);
const showSequence = ref(false);
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

const handleDesktopLyric = async () => {
  const snapshot = (await electronAPI.toggleLyricWindow()) as { visible?: boolean } | undefined;
  lyric.setDesktop(Boolean(snapshot?.visible));
  if (snapshot?.visible) {
    await lyric.sendToLyricWindow();
  }
}

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
@keyframes scaleBack {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(0.8);
  }

  100% {
    transform: scale(1);
  }
}

.icon {
  color: #ffffff50;
  font-size: 24px;

  &:hover {
    animation: scaleBack 0.3s ease-in-out;
    color: #fff;
  }
}

.control-panel {
  width: 100%;
  height: 80px;
  display: flex;
  align-items: center;
  flex-direction: row;
  background: transparent;
  /* 半透明背景 */
  backdrop-filter: blur(10px);
  /* 高斯模糊效果 */
  -webkit-backdrop-filter: blur(10px);
  /* Safari浏览器兼容 */

  .panel-left,
  .panel-right {
    flex: 1;
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 100%;
    width: 100%;
    gap: 16px;
  }

  .panel-left {
    justify-content: flex-start;
    padding-left: 1rem;

    .quality-pill {
      min-width: 54px;
      height: 30px;
      padding: 0 12px;
      border-radius: 999px;
      color: #ffffffcc;
      background: #ffffff18;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0;
    }
  }

  .panel-center {
    flex: 2;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .panel-right {
    justify-content: flex-end;
    padding-right: 1rem;
  }
}
</style>
