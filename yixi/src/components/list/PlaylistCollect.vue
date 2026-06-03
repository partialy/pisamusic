<template>
  <div ref="containerRef" class="recommend-playlist">
    <template v-if="loading">
      <div v-for="i in visibleSkeletonCount" :key="i" class="playlist-skeleton-item">
        <n-skeleton class="playlist-skeleton-cover" />
        <div class="playlist-skeleton-info">
          <n-skeleton text width="92%" />
          <n-skeleton text width="68%" />
        </div>
      </div>
    </template>
    <template v-else>
      <KGRecommendPlaylist
        v-for="i in visiblePlaylist"
        :key="`${i.source}:${i.id}`"
        :item="i"
        @play-all="contextMenu?.handlePlayPlaylist(i)"
        @contextmenu.stop="
          contextMenu?.openContextMenu($event, {
            type: 'playlist',
            data: i,
          })
        " />
    </template>
    <ContextMenu ref="contextMenu" />
  </div>
</template>

<script setup lang="ts">
import type { CommonPlaylist } from "@/types/song";
import { KGRecommendPlaylist } from "../playList";
import ContextMenu from "@/components/common/ContextMenu.vue";
import { NSkeleton } from "naive-ui";
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";

const props = withDefaults(defineProps<{
  playlist: CommonPlaylist[];
  loading?: boolean;
  skeletonCount?: number;
  maxRows?: number;
}>(), {
  loading: false,
  skeletonCount: 12,
});
const contextMenu = useTemplateRef("contextMenu");
const containerRef = useTemplateRef<HTMLElement>("containerRef");
const columnCount = ref(1);
let observer: ResizeObserver | null = null;

const visibleLimit = computed(() => {
  if (!props.maxRows) return props.playlist.length;
  return Math.max(props.maxRows * columnCount.value, 1);
});

const visiblePlaylist = computed(() => props.playlist.slice(0, visibleLimit.value));

const visibleSkeletonCount = computed(() => {
  if (!props.maxRows) return props.skeletonCount;
  return Math.min(props.skeletonCount, Math.max(props.maxRows * columnCount.value, 1));
});

function updateColumnCount(width: number) {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize || "16");
  const minColumnWidth = 10.2 * rootFontSize;
  const gap = rootFontSize;
  columnCount.value = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)));
}

onMounted(() => {
  const container = containerRef.value;
  if (!container) return;
  updateColumnCount(container.clientWidth);
  observer = new ResizeObserver(([entry]) => {
    if (entry) updateColumnCount(entry.contentRect.width);
  });
  observer.observe(container);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

</script>

<style lang="scss" scoped>
.recommend-playlist {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.2rem, 1fr));
  gap: 1rem;
  width: 100%;
  padding-right: 8px;

  .playlist-skeleton-item {
    aspect-ratio: 7/10;
    width: 100%;
    height: 100%;
    border-radius: 20px;
    overflow: hidden;
    // background: color-mix(in srgb, var(--color-bg-default) 82%, #ffffff 18%);
    // border: 1px solid var(--color-border-default);
  }

  .playlist-skeleton-cover {
    width: 100%;
    height: 72%;
    border-radius: 20px;
  }

  .playlist-skeleton-info {
    height: 28%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    padding: 10px;
    box-sizing: border-box;
  }
}
</style>
