<template>
  <div class="home-song-grid">
    <template v-if="loading">
      <div v-for="i in skeletonCount" :key="i" class="music-skeleton-item">
        <n-skeleton circle height="58px" width="58px" />
        <div class="music-skeleton-info">
          <n-skeleton text :width="`${70 + (i % 3) * 8}%`" />
          <n-skeleton text :width="`${42 + (i % 4) * 8}%`" />
        </div>
        <div class="music-skeleton-actions">
          <n-skeleton circle height="24px" width="24px" />
          <n-skeleton circle height="24px" width="24px" />
        </div>
      </div>
    </template>
    <template v-else>
      <KGRecommendSong
        v-for="song in songs"
        :key="song.id"
        :song="song"
        :collected="isCollected(song)"
        @play="emit('play', $event)"
        @collect="emit('collect', $event)" />
      <div v-if="songs.length === 0" class="empty-state">暂无歌曲</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NSkeleton } from "naive-ui";
import KGRecommendSong from "@/components/playList/KGRecommendSong.vue";
import type { Song } from "@/types/song";

defineOptions({ name: "HomeSongGrid" });

const props = withDefaults(defineProps<{
  songs: Song[];
  loading?: boolean;
  skeletonCount?: number;
  isCollected?: (song: Song) => boolean;
}>(), {
  loading: false,
  skeletonCount: 9,
  isCollected: () => false,
});

const emit = defineEmits<{
  play: [song: Song];
  collect: [song: Song];
}>();

function isCollected(song: Song) {
  return props.isCollected(song);
}
</script>

<style lang="scss" scoped>
.home-song-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 80px;
  gap: 10px;
  padding-bottom: 1rem;

  > * {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
}

.music-skeleton-item {
  width: 100%;
  height: 100%;
  padding: 0.5rem 0.8rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border-default);
  background: color-mix(in srgb, var(--color-bg-default) 82%, #ffffff 18%);
  box-sizing: border-box;
}

.music-skeleton-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.music-skeleton-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.empty-state {
  grid-column: 1 / -1;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  border: 1px dashed var(--color-border-default);
  border-radius: 8px;
}
</style>
