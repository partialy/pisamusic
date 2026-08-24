<template>
  <div class="recommend-song-page mw1600">
    <header class="page-header">
      <div class="header-copy">
        <span class="header-kicker">CURATED FOR YOU</span>
        <h1>{{ pageTitle }}</h1>
      </div>
      <n-button
        type="primary"
        secondary
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
        <n-skeleton class="skeleton-cover" />
        <div class="skeleton-info">
          <n-skeleton text :width="`${72 + (index % 3) * 6}%`" />
          <n-skeleton text :width="`${42 + (index % 4) * 8}%`" />
          <div class="skeleton-actions">
            <n-skeleton circle height="18px" width="18px" />
            <n-skeleton circle height="18px" width="18px" />
            <n-skeleton circle height="18px" width="18px" />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="songs.length" class="song-grid">
      <template
        v-for="(song, index) in songs"
        :key="`${song.source}:${song.id}`">
        <article class="song-item" @dblclick="handlePlay(song)">
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
          </div>
        </article>
        <div v-if="index === 8 && songs.length > 9" class="section-divider" aria-hidden="true"></div>
      </template>
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
  padding: 4px 4px 10px;

  h1 {
    margin: 4px 0 0;
    color: var(--color-text-default);
    font-size: clamp(26px, 2vw, 32px);
    line-height: 1.2;
    font-weight: 650;
    letter-spacing: -0.025em;
  }
}

.header-copy {
  min-width: 0;
}

.header-kicker {
  color: var(--color-primary);
  font-size: 10px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.play-all-btn {
  height: 36px;
  border-radius: 9px;
  padding: 0 16px;
  flex-shrink: 0;
  font-weight: 650;
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 22px;
  row-gap: 8px;
}

.song-item,
.song-skeleton {
  min-width: 0;
  height: 80px;
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 2px 8px 2px 2px;
  border-radius: 7px;
}

.song-item {
  cursor: pointer;
  outline: none;
  background: transparent;
  transition: background-color 0.18s ease;

  &:hover,
  &:focus-within {
    background: color-mix(in srgb, var(--color-primary) 7%, transparent);

    .cover-play {
      opacity: 1;
      transform: scale(1);
    }

    .cover-wrap img {
      filter: brightness(0.74);
    }
  }
}

.cover-wrap {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 5px;
  overflow: hidden;
  background: var(--color-bg-secondary);

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    transition: filter 0.18s ease;
  }
}

.cover-play {
  position: absolute;
  inset: 0;
  width: 38px;
  height: 38px;
  margin: auto;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 50%;
  color: var(--color-primary);
  background: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.9);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
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
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
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
  font-size: 14px;
  line-height: 1.3;
  font-weight: 600;
}

.song-meta {
  display: flex;
  align-items: center;
  min-width: 0;
  margin-top: 3px;
  color: var(--color-text-secondary);
  font-size: 12px;
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
  gap: 5px;
  margin-top: 5px;

  button {
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 5px;
    color: var(--color-text-third);
    background: transparent;
    cursor: pointer;
    transition:
      color 0.18s ease,
      background-color 0.18s ease,
      opacity 0.18s ease;

    &:hover,
    &:focus-visible {
      color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 9%, transparent);
      outline: none;
    }

    &.collected {
      color: #ff5c67;
    }
  }
}

.skeleton-cover {
  width: 76px;
  height: 76px;
  border-radius: 5px;
}

.skeleton-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.section-divider {
  grid-column: 1 / -1;
  height: 1px;
  margin: 8px 0;
  background: color-mix(in srgb, var(--color-border-default) 84%, transparent);
}

.empty-state {
  min-height: 240px;
  margin-top: 8px;
}

@media (max-width: 1080px) {
  .song-grid {
    grid-template-columns: repeat(2, minmax(280px, 1fr));
  }

  .section-divider {
    display: none;
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
