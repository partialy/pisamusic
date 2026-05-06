<template>
  <div class="song-item" @dblclick="handleDbclick" :class="{ active: active }">
    <div class="index">
      <span v-if="!active || !player.isPlaying">{{ index + 1 }}</span>
      <span v-else style="
          width: 24px;
          height: 24px;
          display: flex;
          justify-content: center;
          align-items: center;
        ">
        <Playing />
      </span>
    </div>
    <div class="song-img">
      <n-image lazy preview-disabled :src="(origin == 'kg' ? getKgImage(song.cover, 120) : song.cover) || songImg
        " class="image" />
    </div>
    <div class="song-info">
      <div class="song-name" :style="{
        color: active ? 'var(--color-primary)' : 'var(--color-text-default)',
      }">
        <span>{{ song?.name }}</span>
      </div>
      <div class="song-artist" :style="{
        color: active ? 'var(--color-primary)' : 'var(--color-text-default)',
        opacity: active ? '1' : '0.6',
      }">
        <span>{{ song?.singer }}</span>
      </div>
    </div>
    <div class="album-name">
      <span>{{ song?.album }}</span>
    </div>
    <div class="duration">
      <span>{{ formatDuration(song?.duration) }}</span>
    </div>
    <div class="operation">
      <n-button text circle @click="handleLove">
        <n-icon :component="CollectIcon" size="24" :color="isLove ? 'red' : 'var(--color-secondary)'"></n-icon>
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Playing } from ".";
import { formatDuration, getKgImage } from "@/utils/common";
import { useAudioStore } from "@/store";
import songImg from "@/assets/images/song.jpg";
import type { Song } from "@/types/song";
import { CollectIcon } from "@/icons";
const player = useAudioStore();

const props = defineProps<{
  song: Song;
  index: number;
  origin: "kg" | "wy" | "qq" | "kw";
  isLove: boolean;
  active: boolean;
}>();
const emits = defineEmits<{
  (e: "play", song: Song): void;
  (e: "add", song: Song): void;
  (e: "love", song: Song): void;
  (e: "next-play", song: Song): void;
}>();

const handleDbclick = () => {
  emits("play", props.song);
};

const handleLove = () => {
  emits("love", props.song);
};
</script>

<style scoped lang="scss">
.song-item {
  display: flex;
  align-items: center;
  flex-direction: row;
  width: 100%;
  height: 60px;
  padding: 5px;
  border-radius: 10px;
  overflow: hidden;
  background: transparent;

  &:hover {
    background: #fff;
  }

  .index {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 4%;
    height: 100%;
    color: var(--color-text-secondary);
    opacity: 0.6;
  }

  .song-img {
    margin: 0 10px;
    display: flex;
    align-items: center;

    .image {
      width: 50px;
      height: 50px;
      border-radius: 8px;
      overflow: hidden;
    }
  }

  .song-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 30%;
    margin-right: 10px;

    .song-name {
      font-size: 16px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .song-artist {
      font-size: 12px;
      overflow: auto;
      white-space: nowrap;
    }
  }

  .album-name {
    font-size: 14px;
    color: var(--color-text-secondary);
    opacity: 0.6;
    width: 30%;
    margin-right: 10px;
  }

  .duration {
    font-size: 14px;
    color: var(--color-text-secondary);
    opacity: 0.6;
    width: 10%;
    text-align: center;
    margin-right: 10px;
  }

  .operation {
    width: 20%;
    opacity: 0.6;
    display: flex;
    justify-content: center;
    align-items: center;

    span {
      cursor: pointer;

      &:hover {
        opacity: 1;
        color: var(--primary-color);
      }
    }
  }
}
</style>
