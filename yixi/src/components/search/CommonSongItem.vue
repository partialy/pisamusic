<template>
  <div
    class="container"
    :class="{ active: active, disabled: isDisabled, selected: selected, selectable: selectable }"
    @mouseenter="isHover = true"
    @mouseleave="isHover = false"
    @click="handleClick"
    @dblclick="handleDblClick">
    <div class="index">
      <n-checkbox
        v-if="selectable"
        :checked="selected"
        @update:checked="handleCheckboxChange"
        @click.stop
      />
      <template v-else>
        <span v-if="!active || !playing">{{ index + 1 }}</span>
        <span v-else>
          <Playing />
        </span>
      </template>
    </div>
    <div class="img-con">
      <n-image
        preview-disabled
        :src="coverUrl"
        :fallback-src="defaultSongCover"
        lazy
        alt="image"
        class="img" />
    </div>
    <div class="info-con">
      <div class="info-title text-line-1" :title="song.name + '-' + sourceDisplayLabel">
        {{ song.name }}
        <n-tag
          style="border-radius: 4px; font-weight: 700;"
          :color="{
            textColor: handleTagColor(song.source),
            borderColor: handleTagColor(song.source),
            color: 'transparent'
          }"
          size="tiny">
          {{ sourceDisplayLabel }}
        </n-tag>
        <n-tag
          v-if="isDisabled"
          style="border-radius: 4px; margin-left: 4px;"
          type="error"
          size="tiny">
          不可播
        </n-tag>
      </div>
      <div class="info-singer text-line-1" :title="song.singer">
        {{ song.singer }}
      </div>
    </div>
    <div class="collect">
      <n-button text title="收藏" @click.stop="collect.collectSong(song)">
        <n-icon
          :component="CollectIcon"
          :color="collect.containsSong(song) ? '#ff5d6c' : 'var(--color-text-third)'"
          class="icon"></n-icon>
      </n-button>
    </div>
    <div class="album text-line-1" :title="song.album">
      {{ song.album }}
    </div>
    <div class="time" :title="formatDuration(song.duration)" v-if="!isHover">
      {{ formatDuration(song.duration) }}
    </div>
    <div class="op-con" :style="{ width: isHover ? '114px' : '50px' }">
      <n-button class="op-btn" text v-if="isHover" :disabled="isDisabled" @click.stop="play">
        <n-icon :component="PlayStatic" class="icon"></n-icon>
      </n-button>
      <n-button class="op-btn" text v-if="isHover" :disabled="isDisabled" @click.stop="nextPlay">
        <n-icon :component="NextPlayIcon" class="icon"></n-icon>
      </n-button>
      <n-button class="op-btn" text :disabled="isDisabled" @click.stop="add">
        <n-icon :component="AddToPlaylist" class="icon"></n-icon>
      </n-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import type { Song } from "@/types/song";
import { defaultSongCover, formatDuration, getSongCover } from "@/utils/common";
import { NImage, NButton, NIcon, NTag, NCheckbox } from "naive-ui";
import { Playing } from "../playList";
import { AddToPlaylist, CollectIcon, NextPlayIcon, PlayStatic } from "@/icons";
import { useCollectStore } from "@/store";

const props = defineProps<{
  active: boolean;
  song: Song;
  index: number;
  playing: boolean;
  selectable?: boolean;
  selected?: boolean;
}>();
const isHover = ref(false);
const metadataCover = ref("");
const collect = useCollectStore();

const isDisabled = computed(() => props.song.playable === false);
const sourceDisplayLabel = computed(() => {
  if (props.song.source === "cloud") return "C";
  return props.song.source.toUpperCase();
});

const coverUrl = computed(() => {
  if (props.song.source === "local") return metadataCover.value || defaultSongCover;
  return getSongCover(props.song);
});

const emit = defineEmits<{
  play: [song: Song];
  nextPlay: [song: Song];
  add: [song: Song];
  toggleSelect: [song: Song];
}>();

const handleClick = () => {
  if (props.selectable) {
    emit("toggleSelect", props.song);
  }
};

const handleCheckboxChange = () => {
  emit("toggleSelect", props.song);
};

const handleDblClick = () => {
  if (props.selectable) return;
  play();
};

const play = () => {
  if (isDisabled.value) {
    window.$message?.info?.("该歌曲已禁用，无法播放");
    return;
  }
  emit("play", props.song);
};

const nextPlay = () => {
  if (isDisabled.value) {
    window.$message?.info?.("该歌曲已禁用，无法播放");
    return;
  }
  emit("nextPlay", props.song);
};

const add = () => {
  if (isDisabled.value) {
    window.$message?.info?.("该歌曲已禁用，无法添加");
    return;
  }
  emit("add", props.song);
};

const handleTagColor = (source: string) => {
  switch (source) {
    case "cloud":
      return "var(--color-source-cloud)";
    case "kg":
      return "var(--color-primary)";
    case "wy":
      return "red";
    case "qq":
      return "green";
    case "kw":
      return "orange";
    default:
      return "gray";
  }
};

watch(
  () => props.song.filePath || props.song.urlParam,
  async (filePath) => {
    metadataCover.value = "";
    if (props.song.source !== "local" || !filePath) return;
    const cover = await window.electronAPI.getLocalSongCover(String(filePath));
    if ((props.song.filePath || props.song.urlParam) === filePath) {
      metadataCover.value = cover;
    }
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
.container {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 4rem;
  border: 1px solid transparent;
  border-radius: 12px;
  overflow: hidden;
  padding: 0 1rem;
  background: transparent;
  color: var(--text-primary);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;

  &.selectable {
    cursor: pointer;
  }

  &.selected {
    background: var(--surface-row-selected);
    border-color: var(--border-row-selected);
  }

  &:hover {
    background: var(--surface-row-hover);
    border-color: var(--border-subtle);
  }

  &.disabled {
    opacity: 0.58;

    .img-con {
      filter: grayscale(70%);
    }

    &:hover {
      background: var(--surface-row-disabled-hover);
      border-color: transparent;
    }
  }

  &.active {
    background: var(--surface-row-playing);
    border-color: var(--border-row-playing);

    .index,
    .info-title {
      color: var(--text-accent);
    }
  }

  .index {
    width: 48px;
    padding: 0.5rem;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .img-con {
    width: 64px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;

    .img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
      overflow: hidden;
    }
  }

  .info-con {
    flex: 1;
    height: 100%;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    .info-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .info-singer {
      font-size: 0.8rem;
      font-weight: 400;
      color: var(--text-secondary);
    }
  }

  .collect,
  .album,
  .time {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .collect {
    width: 64px;
    height: 100%;

    .icon {
      font-size: 24px;
      cursor: pointer;
      opacity: 0.8;

      &:hover {
        opacity: 1;
      }
    }
  }

  .album {
    width: 200px;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .time {
    width: 64px;
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--text-secondary);
  }

  .op-con {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0.5rem;
    gap: 0.8rem;

    .op-btn {
      .icon {
        font-size: 24px;
        cursor: pointer;
        color: var(--text-tertiary);

        &:hover {
          color: var(--text-accent);
        }
      }
    }
  }
}
</style>
