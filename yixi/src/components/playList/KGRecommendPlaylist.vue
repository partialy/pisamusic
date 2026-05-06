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

      <transition
        name="play-icon"
        enter-active-class="play-icon-enter-active"
        leave-active-class="play-icon-leave-active">
        <div class="collect-icon" v-if="showIcon">
          <div>
            {{ playCount }}
          </div>
          <div class="playlist-item-play-icon">
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
import { PlaylistPlayIcon } from "@/icons";
import { getKgImage } from "@/utils/common";
import { useRouter } from "vue-router";
import type { CommonPlaylist } from "@/types/song";
const router = useRouter();
const showIcon = ref(false);

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

const handleClick = () => {
  router.push({
    path: "/playlist/detail",
    query: { id: props.item.id, origin: props.item.source },
  });
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
    background-color: #fff;

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
