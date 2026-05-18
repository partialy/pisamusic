<template>
  <div class="container" :class="{ active: active }" @mouseenter="isHover = true" @mouseleave="isHover = false"
    @dblclick="play">
    <div class="index">
      <span v-if="!active || !playing">{{ index + 1 }}</span>
      <span v-else>
        <Playing />
      </span>
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
      <div class="info-title text-line-1" :title="song.name + '-' + song.source.toUpperCase()">
        {{ song.name }} <n-tag style="border-radius: 4px;" :color="{
          textColor: handleTagColor(song.source),
          borderColor: handleTagColor(song.source),
          color: 'transparent'
        }" size="tiny">{{ song.source.toUpperCase() }}</n-tag>
      </div>
      <div class="info-singer text-line-1" :title="song.singer">
        {{ song.singer }}
      </div>
    </div>
    <div class="collect">
      <n-button text title="收藏" @click="collect.collectSong(song)">
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
      <n-button class="op-btn" text v-if="isHover" @click="play">
        <n-icon :component="PlayStatic" class="icon"></n-icon>
      </n-button>
      <n-button class="op-btn" text v-if="isHover" @click="nextPlay">
        <n-icon :component="NextPlayIcon" class="icon"></n-icon>
      </n-button>
      <n-button class="op-btn" text @click="add">
        <n-icon :component="AddToPlaylist" class="icon"></n-icon>
      </n-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import type { Song } from "@/types/song";
import { defaultSongCover, formatDuration, getSongCover } from "@/utils/common";
import { NImage, NButton, NIcon, NTag } from "naive-ui";
import { Playing } from "../playList";
import { AddToPlaylist, CollectIcon, NextPlayIcon, PlayStatic } from "@/icons";
import { useCollectStore } from "@/store";

const props = defineProps<{
  active: boolean;
  song: Song;
  index: number;
  playing: boolean;
}>();
const isHover = ref(false);
const metadataCover = ref("");
const collect = useCollectStore();

const coverUrl = computed(() => {
  if (props.song.source === "local") return metadataCover.value || defaultSongCover;
  return getSongCover(props.song);
});

const emit = defineEmits<{
  play: [song: Song];
  nextPlay: [song: Song];
  add: [song: Song];
}>();

const play = () => {
  emit("play", props.song);
};

const nextPlay = () => {
  emit("nextPlay", props.song);
};
const add = () => {
  emit("add", props.song);
};

const handleTagColor = (source: string) => {
  switch (source) {
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
  color: var(--color-text-default);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;

  &:hover {
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-default));
    border-color: color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  &.active {
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-default));
    border-color: color-mix(in srgb, var(--color-primary) 38%, var(--color-border-default));
    box-shadow: 0 10px 24px color-mix(in srgb, var(--color-primary) 16%, transparent);

    .index,
    .info-title {
      color: var(--color-primary);
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
      color: var(--color-text-default);
    }

    .info-singer {
      font-size: 0.8rem;
      font-weight: 400;
      color: var(--color-text-secondary);
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
    color: var(--color-text-secondary);
  }

  .time {
    width: 64px;
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--color-text-secondary);
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
        color: var(--color-text-third);

        &:hover {
          color: var(--color-primary);
        }
      }
    }
  }
}
</style>
