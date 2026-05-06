<template>
  <div class="kg-recommend-song" @dblclick="handlePlay">
    <div class="image">
      <n-image preview-disabled :src="cover" lazy />
    </div>
    <div class="info">
      <div class="name">{{ props.song.name }}</div>
      <div class="singer">{{props.song.singer}}</div>
    </div>
    <div class="operate">
      <n-button text>
        <n-icon size="24" color="var(--color-primary)" class="icon" title="播放" :component="PlaylistPlayIcon"
          @click="handlePlay" />
      </n-button>

      <n-button text>
        <n-icon size="24" :color="collected ? 'red' : '#b4b2b2'" class="icon" title="收藏"
          :component="CollectIcon" @click="handleCollect" />
      </n-button>
      <n-button text>
        <n-icon size="24" color="#b4b2b2" class="icon" title="更多" :component="MoreIcon" @click="handleMore" />
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PlaylistPlayIcon, CollectIcon, MoreIcon } from "@/icons";
import type { Song } from "@/types/song";
import { getKgImage } from "@/utils/common";
import { computed } from "vue";
const props = defineProps<{
  song: Song;
  collected: boolean;
}>();

const emit = defineEmits<{
  (e: "play", song: Song): void;
  (e: "collect", song: Song): void;
  (e: "more", song: Song): void;
}>();

const cover = computed(() => {
  if(props.song.source == "kg") {
    return getKgImage(props.song.cover, 120);
  } else {
    return props.song.coverSize?.s || props.song.cover;
  }
});

const handleCollect = () => {
  emit("collect", props.song);
}

const handlePlay = () => {
  emit("play", props.song);
};

const handleMore = () => {
  console.log("handleMore");
}
</script>

<style lang="scss" scoped>
.icon {
  cursor: pointer;
}

.kg-recommend-song {
  width: 100%;
  height: 100%;
  padding: 0.5rem 0.8rem;
  display: flex;
  flex-direction: row;
  border-radius: 8px;
  align-items: center;
  cursor: pointer;

  .image {
    width: 60px;
    height: 60px;
    margin-right: 1rem;
    border-radius: 5px;
    overflow: hidden;
  }

  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;

    .name {
      font-size: 1.1rem;
      font-weight: 500;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }

    .singer {
      font-size: 1rem;
      text-overflow: ellipsis;
      overflow: hidden;
      color: var(--color-text-secondary);
      white-space: nowrap;
    }
  }

  .operate {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-direction: row;
    gap: 6px;
    display: none;
    margin-left: 10px;
  }

  &:hover {
    background-color: #fff;

    .operate {
      display: flex;
    }
  }
}
</style>
