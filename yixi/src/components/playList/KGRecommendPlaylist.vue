<template>
  <div
    class="playlist-item"
    @mouseenter="showIcon = true"
    @mouseleave="showIcon = false"
    @click="handleClick">
    <div class="playlist-item-image">
      <div style="overflow: hidden">
        <n-image
          preview-disabled
          class="playlist-item-image-img"
          lazy
          :src="cover" />
      </div>
      <div class="playlist-source-badge" v-if="showIcon">
        {{ props.item.source.toUpperCase() }}
      </div>
      <n-button
        v-if="showIcon"
        class="playlist-favorite-btn"
        quaternary
        circle
        :title="isCollected ? '取消收藏' : '收藏'"
        @click.stop="toggleCollect">
        <template #icon>
          <n-icon size="24"
            :component="CollectIcon"
            :color="isCollected ? '#ff5c67' : '#fefefe'" />
        </template>
      </n-button>

      <transition
        name="play-icon"
        enter-active-class="play-icon-enter-active"
        leave-active-class="play-icon-leave-active">
        <div class="collect-icon" v-if="showIcon">
          <div>
            {{ playCount }}
          </div>
          <div class="playlist-item-play-icon" title="播放全部" @click.stop="$emit('playAll')">
            <n-icon size="40" :component="PlaylistPlayIcon" />
          </div>
        </div>
      </transition>
    </div>
    <div class="playlist-item-info">
      <n-tooltip trigger="hover" placement="top" style="max-width: 300px">
        <template #trigger>
          <n-text class="truncate-text">{{ props.item.name }}</n-text>
        </template>
        <template #default>
          <span>{{ props.item.name }}</span>
        </template>
      </n-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { CollectIcon, PlaylistPlayIcon } from "@/icons";
import { getKgImage } from "@/utils/common";
import { useRouter } from "vue-router";
import type { CommonPlaylist } from "@/types/song";
import { useCollectStore } from "@/store/collect";
const router = useRouter();
const showIcon = ref(false);
const collector = useCollectStore();

const emit = defineEmits<{
  playAll: [];
}>();

const cover = computed(() => {
  if(props.item.source == "kg") {
    return getKgImage(props.item.cover, 240);
  } else {
    return props.item.coverSize?.m || props.item.cover;
  }
});

const props = defineProps<{
  item: CommonPlaylist;
}>();

const playCount = computed(() => {
  // @ts-ignore
  const w = (props.item.play_count || 0) / 10000;
  if (w >= 10000) {
    return (w / 10000).toFixed(2) + "亿";
  }
  return w.toFixed(2) + "万";
});

const isCollected = computed(() => collector.containsPlaylist(props.item));

const handleClick = () => {
  router.push({
    path: "/playlist/detail",
    query: { id: props.item.id, origin: props.item.source },
  });
};

const toggleCollect = (event: MouseEvent) => {
  event.stopPropagation();
  void collector.collectList(props.item);
};
</script>

<style scoped lang="scss">
@keyframes icon-slide-in {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes icon-slide-out {
  0% {
    opacity: 1;
    transform: translateY(0);
  }

  100% {
    opacity: 0;
    transform: translateY(5px);
  }
}

.play-icon-enter-active {
  animation: icon-slide-in 0.3s ease-out;
}

.play-icon-leave-active {
  animation: icon-slide-out 0.2s ease-in;
}

.playlist-item {
  aspect-ratio: 7/10;
  width: 100%;
  height: 100%;
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  background-color: var(--color-bg);
  cursor: pointer;

  .playlist-item-image {
    height: 72%;
    border-radius: 20px;
    overflow: hidden;
    position: relative;

    &::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0);
      transition: all 0.3s ease;
    }
  }

  .playlist-item-image-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: all 0.3s ease;
  }

  .playlist-item-info {
    width: 100%;
    height: 28%;
    padding: 10px;
    box-sizing: border-box;
    background-color: var(--color-bg);

    &:hover {
      background-color: var(--color-bg-hover);
    }
  }

  .collect-icon {
    position: absolute;
    display: flex;
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    bottom: 10px;
    padding: 0 1rem;
    color: white;
    font-weight: 600;
    z-index: 10;
    font-size: 14px;
  }

  .playlist-source-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 20;
    min-width: 42px;
    height: 28px;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
    background: rgba(15, 23, 42, 0.48);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);
    backdrop-filter: blur(12px);
  }

  .playlist-favorite-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 20;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    color: #6d7684;
    background: rgba(255, 255, 255, 0.5);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14);
    backdrop-filter: blur(12px);
    opacity: 0.92;
    transition:
      transform 0.2s ease,
      opacity 0.2s ease,
      background-color 0.2s ease;

    &:hover {
      transform: translateY(-1px) scale(1.04);
      opacity: 1;
      background: #fff;
    }
  }

  .playlist-item-play-icon {
    height: 40px;
    width: 40px;
    color: white;
    z-index: 10;
    opacity: 1;
    background: #ffffff4f;
    backdrop-filter: blur(10px);
    border-radius: 50%;
  }

  &:hover {
    background-color: var(--color-bg-hover);

    .playlist-item-image {
      border-radius: 20px 20px 0 0;
    }

    .playlist-item-image-img {
      transform: scale(1.05);
    }

    .playlist-item-image::after {
      background-color: rgba(0, 0, 0, 0.3);
    }
  }
}

.truncate-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
}
</style>
