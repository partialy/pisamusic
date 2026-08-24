<template>
  <div class="recommend-song-page mw1600">
    <header class="page-header">
      <div class="header-copy">
        <h1>{{ pageTitle }}</h1>
      </div>
      <n-button
        type="primary"
        class="play-all-btn"
        :disabled="!songs.length"
        @click="handlePlayAll">
        <template #icon>
          <n-icon :component="Play" />
        </template>
        播放全部
      </n-button>
    </header>

    <div v-if="loading" class="song-grid">
      <div v-for="index in 18" :key="index" class="song-skeleton">
        <n-skeleton text width="24px" />
        <n-skeleton class="skeleton-cover" />
        <div class="skeleton-info">
          <n-skeleton text :width="`${72 + (index % 3) * 6}%`" />
          <n-skeleton text :width="`${42 + (index % 4) * 8}%`" />
        </div>
        <div class="skeleton-actions">
          <n-skeleton circle height="24px" width="24px" />
          <n-skeleton circle height="24px" width="24px" />
          <n-skeleton circle height="24px" width="24px" />
        </div>
      </div>
    </div>

    <div v-else-if="songs.length" class="song-grid">
      <article
        v-for="(song, index) in songs"
        :key="`${song.source}:${song.id}`"
        class="song-item"
        @dblclick="handlePlay(song)">
        <span class="song-rank" :class="{ top: index < 3 }">
          {{ formatRank(index) }}
        </span>
        <div class="cover-wrap">
          <img :src="getSongCover(song, 120)" :alt="song.name" />
          <button
            type="button"
            class="cover-play"
            :aria-label="`播放 ${song.name}`"
            @click.stop="handlePlay(song)">
            <n-icon :component="Play" />
          </button>
        </div>
        <div class="song-info">
          <div class="song-name" :title="song.name">{{ song.name }}</div>
          <div class="song-meta" :title="song.album ? `${song.singer} · ${song.album}` : song.singer">
            <span>{{ song.singer }}</span>
            <template v-if="song.album">
              <span class="song-meta-divider" aria-hidden="true">·</span>
              <span class="song-album">{{ song.album }}</span>
            </template>
          </div>
        </div>
        <div class="song-actions">
          <button type="button" :aria-label="`播放 ${song.name}`" title="播放" @click.stop="handlePlay(song)">
            <n-icon :component="PlaylistPlayIcon" />
          </button>
          <button
            type="button"
            :aria-label="isSongCollected(song) ? `取消收藏 ${song.name}` : `收藏 ${song.name}`"
            :title="isSongCollected(song) ? '取消收藏' : '收藏'"
            :class="{ collected: isSongCollected(song) }"
            :aria-pressed="isSongCollected(song)"
            @click.stop="handleCollectSong(song)">
            <n-icon :component="CollectIcon" />
          </button>
          <button
            type="button"
            :aria-label="`添加 ${song.name} 到歌单`"
            title="添加到歌单"
            @click.stop="handleAddToPlaylist(song)">
            <n-icon :component="MoreIcon" />
          </button>
        </div>
      </article>
    </div>

    <n-empty v-else class="empty-state" description="暂无推荐歌曲" />
    <AddToPlaylistDialog ref="addToPlaylistDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from "vue";
import { useRoute } from "vue-router";
import { NButton, NEmpty, NIcon, NSkeleton } from "naive-ui";
import { Play } from "lucide-vue-next";
import AddToPlaylistDialog from "@/components/player/AddToPlaylistDialog.vue";
import { CollectIcon, MoreIcon, PlaylistPlayIcon } from "@/icons";
import type { Song } from "@/types/song";
import { useCollectStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { getSongCover } from "@/utils/common";
import { convertor } from "@/utils/convertor";
import {
  getHomeRecommendations,
  getTopSongs,
  getWyPersonalizedNewSongs,
} from "@/utils/api/musicAPI";
import {
  SONG_SOURCE_META,
  normalizeSongType,
  queryString,
  type RecommendSongType,
} from "./recommendSources";

const route = useRoute();
const playbackCommands = usePlaybackCommands();
const collector = useCollectStore();
const songs = ref<Song[]>([]);
const loading = ref(false);
const addToPlaylistDialogRef = useTemplateRef("addToPlaylistDialogRef");

const sourceType = computed(() => normalizeSongType(route.query.type));
const sourceMeta = computed(() => SONG_SOURCE_META[sourceType.value]);
const pageTitle = computed(() => queryString(route.query.title) || sourceMeta.value.title);

async function loadSongs() {
  loading.value = true;
  try {
    songs.value = await fetchSongSource(sourceType.value);
  } catch (error) {
    songs.value = [];
    window.$message?.warning(`${pageTitle.value}加载失败`);
    void window.electronAPI.reportError(error, {
      scope: "recommend",
      action: "loadSongs",
      type: sourceType.value,
    });
  } finally {
    loading.value = false;
  }
}

async function fetchSongSource(type: RecommendSongType) {
  if (type === "kg-top") {
    const res: any = await getTopSongs();
    return (res?.data || []).map((item: any) => convertor.KG.convertKGTopSong(item));
  }

  if (type === "wy-new") {
    const res: any = await getWyPersonalizedNewSongs({ limit: 36 });
    return (res?.result || []).map((item: any) => convertor.WY.convertWYPersonalizedNewSong(item));
  }

  const res: any = await getHomeRecommendations();
  return (res?.songs?.data?.song_list || []).map((item: any) =>
    convertor.KG.convertKGRecommendSong(item)
  );
}

function handlePlay(song: Song) {
  playbackCommands.playSongFromList(songs.value, song);
}

function handlePlayAll() {
  playbackCommands.playAll(songs.value);
}

function handleCollectSong(song: Song) {
  void collector.collectSong(song);
}

function isSongCollected(song: Song) {
  return collector.containsSong(song);
}

function handleAddToPlaylist(song: Song) {
  addToPlaylistDialogRef.value?.open(song);
}

function formatRank(index: number) {
  return String(index + 1).padStart(2, "0");
}

watch(
  () => route.query.type,
  () => {
    void loadSongs();
  }
);

onMounted(() => {
  void loadSongs();
});
</script>

<style lang="scss" scoped>
.recommend-song-page {
  width: 100%;
  min-height: 100%;
  padding-bottom: 40px;
}

.page-header {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
  padding: 24px 26px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 14%, var(--color-border-default));
  border-radius: 18px;
  background:
    radial-gradient(circle at 84% 16%, color-mix(in srgb, var(--color-primary) 13%, transparent), transparent 34%),
    linear-gradient(120deg, color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-default)), var(--color-card-bg));

  &::after {
    content: "";
    position: absolute;
    right: 116px;
    bottom: -54px;
    width: 150px;
    height: 150px;
    border: 1px solid color-mix(in srgb, var(--color-primary) 14%, transparent);
    border-radius: 50%;
    pointer-events: none;
  }

  h1 {
    margin: 0;
    color: var(--color-text-default);
    font-size: clamp(28px, 2.3vw, 38px);
    line-height: 1.16;
    font-weight: 800;
    letter-spacing: -0.035em;
  }
}

.header-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.play-all-btn {
  z-index: 1;
  height: 40px;
  border-radius: 12px;
  padding: 0 20px;
  flex-shrink: 0;
  font-weight: 700;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--color-primary) 24%, transparent);
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 10px 14px;
}

.song-item,
.song-skeleton {
  min-width: 0;
  height: 92px;
  display: grid;
  grid-template-columns: 28px 68px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 11px 12px 11px 10px;
  border: 1px solid transparent;
  border-radius: 14px;
}

.song-item {
  cursor: pointer;
  outline: none;
  background: color-mix(in srgb, var(--color-card-bg) 68%, transparent);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;

  &:hover,
  &:focus-visible,
  &:focus-within {
    border-color: color-mix(in srgb, var(--color-primary) 24%, var(--color-border-default));
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-default));
    box-shadow: 0 10px 28px color-mix(in srgb, var(--color-primary) 10%, transparent);
    transform: translateY(-2px);

    .cover-play {
      opacity: 1;
      transform: scale(1);
    }

    .cover-wrap img {
      transform: scale(1.045);
      filter: brightness(0.72);
    }

    .song-actions {
      opacity: 1;
    }
  }
}

.song-rank {
  color: var(--color-text-third);
  font-size: 12px;
  line-height: 1;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  text-align: center;

  &.top {
    color: var(--color-primary);
  }
}

.cover-wrap {
  position: relative;
  width: 68px;
  height: 68px;
  border-radius: 11px;
  overflow: hidden;
  background: var(--color-bg-secondary);

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    transition:
      transform 0.24s ease,
      filter 0.24s ease;
  }
}

.cover-play {
  position: absolute;
  inset: 0;
  width: 36px;
  height: 36px;
  margin: auto;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 50%;
  color: var(--color-primary);
  background: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.86);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.2);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    background-color 0.2s ease;

  &:hover,
  &:focus-visible {
    background: #fff;
    transform: scale(1.06);
  }
}

.song-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
}

.song-name,
.song-meta,
.song-album {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-name {
  color: var(--color-text-default);
  font-size: 15px;
  line-height: 1.25;
  font-weight: 700;
}

.song-meta {
  display: flex;
  align-items: center;
  min-width: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.song-meta-divider {
  margin: 0 6px;
  color: var(--color-text-third);
}

.song-album {
  min-width: 0;
  color: var(--color-text-third);
}

.song-actions {
  display: flex;
  align-items: center;
  gap: 3px;
  opacity: 0.58;
  transition: opacity 0.2s ease;

  button {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 9px;
    color: var(--color-text-secondary);
    background: transparent;
    cursor: pointer;
    transition:
      color 0.18s ease,
      background-color 0.18s ease,
      transform 0.18s ease;

    &:hover,
    &:focus-visible {
      color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      transform: translateY(-1px);
      outline: none;
    }

    &.collected {
      color: #ff5c67;
    }
  }
}

.skeleton-cover {
  width: 68px;
  height: 68px;
  border-radius: 11px;
}

.skeleton-info {
  min-width: 0;
}

.skeleton-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.empty-state {
  min-height: 240px;
  margin-top: 12px;
  border: 1px dashed var(--color-border-default);
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-card-bg) 68%, transparent);
}

@media (max-width: 1320px) {
  .song-grid {
    grid-template-columns: repeat(2, minmax(300px, 1fr));
  }
}

@media (max-width: 820px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .song-grid {
    grid-template-columns: 1fr;
  }

  .play-all-btn {
    width: 100%;
  }
}
</style>
