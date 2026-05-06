<template>
  <div class="container" :class="{ active: active }" @mouseenter="isHover = true" @mouseleave="isHover = false"
    @dblclick="play">
    <div class="index">
      <span v-if="!active || !playing">{{ index + 1 }}</span>
      <span v-else>
        <Playing />
      </span>
    </div>
    <div class="img-con" v-if="song?.coverSize?.s || song?.cover">
      <n-image preview-disabled :src="getKgImage(song?.cover)" lazy alt="image" class="img" />
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
        <n-icon :component="CollectIcon" :color="songMap.has(song.id) ? 'red' : '#999'" class="icon"></n-icon>
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
import { ref } from "vue";
import type { Song } from "@/types/song";
import { formatDuration, getKgImage } from "@/utils/common";
import { NImage, NButton, NIcon, NTag } from "naive-ui";
import { Playing } from "../playList";
import { AddToPlaylist, CollectIcon, NextPlayIcon, PlayStatic } from "@/icons";
import { useCollectStore } from "@/store";
import { storeToRefs } from "pinia";

const props = defineProps<{
  active: boolean;
  song: Song;
  index: number;
  playing: boolean;
}>();
const isHover = ref(false);
const collect = useCollectStore();
const { songMap } = storeToRefs(collect);

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
</script>

<style lang="scss" scoped>
.container {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 4rem;
  border-radius: 10px;
  overflow: hidden;
  padding: 0 1rem;
  background: transparent;

  &:hover {
    background: #eee;
  }

  &.active {
    background: #fff;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.1);
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
    }

    .info-singer {
      font-size: 0.8rem;
      font-weight: 400;
      color: #666;
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
  }

  .time {
    width: 64px;
    font-size: 0.8rem;
    font-weight: 400;
    color: #666;
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
        color: #999;

        &:hover {
          color: var(--color-primary);
        }
      }
    }
  }
}
</style>
