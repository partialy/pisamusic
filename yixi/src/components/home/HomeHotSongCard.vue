<template>
  <section class="hot-card">
    <div class="hot-card-header">
      <div>
        <div class="eyebrow">KG TOP</div>
        <h3>热门歌曲</h3>
      </div>
      <n-button text type="primary" class="more-btn" @click="emit('showMore')">
        查看更多
      </n-button>
    </div>

    <div v-if="loading" class="hot-list">
      <div v-for="i in 4" :key="i" class="hot-skeleton">
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
  border: 1px solid color-mix(in srgb, var(--color-border-default) 80%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 46%),
    color-mix(in srgb, var(--color-bg-default) 88%, #ffffff 12%);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
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
  color: color-mix(in srgb, var(--color-primary) 84%, #222 16%);
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
