<template>
  <section class="hot-card">
    <div class="hot-card-header">
      <div>
        <div class="eyebrow">HOT TOP</div>
        <h3>热门歌曲</h3>
      </div>
      <n-button text type="primary" class="more-btn" @click="emit('showMore')">
        查看更多
      </n-button>
    </div>

    <div v-if="loading" class="hot-list">
      <div v-for="i in 3" :key="i" class="hot-skeleton">
        <n-skeleton text width="42px" />
        <n-skeleton circle height="42px" width="42px" />
        <div class="hot-skeleton-main">
          <n-skeleton text :width="`${68 + i * 4}%`" />
          <n-skeleton text :width="`${40 + i * 8}%`" />
        </div>
      </div>
    </div>

    <div v-else-if="songs.length" class="hot-list">
      <button
        v-for="(song, index) in songs.slice(0, 3)"
        :key="song.id"
        type="button"
        class="hot-song"
        @dblclick="emit('play', song)">
        <span class="rank">TOP{{ index + 1 }}</span>
        <img class="cover" :src="getSongCover(song, 120)" :alt="song.name" />
        <span class="song-info">
          <span class="song-name">{{ song.name }}</span>
          <span class="song-meta">{{ song.singer }} · {{ formatDuration(song.duration) }}</span>
        </span>
      </button>
    </div>

    <div v-else class="empty-state">暂无热门歌曲</div>
  </section>
</template>

<script setup lang="ts">
import { NButton, NSkeleton } from "naive-ui";
import type { Song } from "@/types/song";
import { formatDuration, getSongCover } from "@/utils/common";

defineOptions({ name: "HomeHotSongCard" });

withDefaults(defineProps<{
  songs: Song[];
  loading?: boolean;
}>(), {
  loading: false,
});

const emit = defineEmits<{
  showMore: [];
  play: [song: Song];
}>();
</script>

<style lang="scss" scoped>
.hot-card {
  width: 40%;
  min-width: 360px;
  height: 220px;
  padding: 18px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 46%),
    rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  box-sizing: border-box;
  transition: all 0.25s cubic-bezier(0.25, 1, 0.5, 1);

  &:hover {
    border-color: rgba(255, 255, 255, 0.22);
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.18);
  }
}

.hot-card-header {
  height: 42px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h3 {
    margin: 0;
    font-size: 18px;
    line-height: 24px;
  }
}

.eyebrow {
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
}

.more-btn {
  flex-shrink: 0;
}

.hot-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hot-song,
.hot-skeleton {
  height: 34px;
  display: grid;
  grid-template-columns: 46px 34px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.hot-song {
  width: 100%;
  padding: 0;
  border: 0;
  color: inherit;
  text-align: left;
  background: transparent;
  cursor: pointer;

  &:hover {
    .song-name {
      color: var(--color-primary);
    }

    .cover {
      transform: scale(1.04);
    }
  }
}

.rank {
  font-size: 12px;
  font-weight: 800;
  color: color-mix(in srgb, var(--color-primary) 90%, #ffffff 10%);
}

.cover {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  object-fit: cover;
  transition: transform 0.18s ease;
}

.song-info,
.hot-skeleton-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.song-name,
.song-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-name {
  font-size: 13px;
  font-weight: 700;
  transition: color 0.18s ease;
}

.song-meta {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.empty-state {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}
</style>
