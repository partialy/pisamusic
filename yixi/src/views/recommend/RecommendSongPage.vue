<template>
  <div class="recommend-song-page mw1600">
    <header class="page-header">
      <div>
        <h1>{{ pageTitle }}</h1>
        <span class="subtitle">{{ headerSubtitle }}</span>
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
        <n-skeleton class="skeleton-cover" />
        <div class="skeleton-info">
          <n-skeleton text :width="`${72 + (index % 3) * 6}%`" />
          <n-skeleton text :width="`${42 + (index % 4) * 8}%`" />
          <div class="skeleton-actions">
            <n-skeleton circle height="20px" width="20px" />
            <n-skeleton circle height="20px" width="20px" />
            <n-skeleton circle height="20px" width="20px" />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="songs.length" class="song-grid">
      <article
        v-for="(song, index) in songs"
        :key="`${song.source}:${song.id}`"
        class="song-item"
        :class="{ featured: index === 0 }"
        @dblclick="handlePlay(song)">
        <div class="cover-wrap">
          <img :src="getSongCover(song, 120)" :alt="song.name" />
          <button
            v-if="index === 0"
            type="button"
            class="featured-play"
            title="播放"
            @click.stop="handlePlay(song)">
            <n-icon :component="Play" />
          </button>
        </div>
        <div class="song-info">
          <div class="song-name" :title="song.name">{{ song.name }}</div>
          <div class="song-singer" :title="song.singer">{{ song.singer }}</div>
          <div class="song-actions">
            <button type="button" title="播放" @click.stop="handlePlay(song)">
              <n-icon :component="PlaylistPlayIcon" />
            </button>
            <button
              type="button"
              :title="isSongCollected(song) ? '取消收藏' : '收藏'"
              :class="{ collected: isSongCollected(song) }"
              @click.stop="handleCollectSong(song)">
              <n-icon :component="CollectIcon" />
            </button>
            <button type="button" title="添加到歌单" @click.stop="handleAddToPlaylist(song)">
              <n-icon :component="MoreIcon" />
            </button>
          </div>
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
const headerSubtitle = computed(() => {
  if (sourceType.value === "kg-top") return "KG 热门榜单歌曲";
  if (sourceType.value === "wy-new") return "WY 推荐新歌";
  return "KG 每日推荐音乐";
});

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
  padding-bottom: 32px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 26px;
  padding: 8px 0 0;

  h1 {
    margin: 0;
    color: var(--color-text-default);
    font-size: 30px;
    line-height: 1.25;
    font-weight: 700;
    letter-spacing: 0;
  }
}

.subtitle {
  display: inline-block;
  margin-top: 8px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.play-all-btn {
  height: 34px;
  border-radius: 5px;
  padding: 0 18px;
  flex-shrink: 0;
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(230px, 1fr));
  column-gap: 42px;
  row-gap: 12px;
}

.song-item,
.song-skeleton {
  min-width: 0;
  height: 76px;
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 0;
  border-radius: 6px;
}

.song-item {
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    transform 0.18s ease;

  &:hover,
  &.featured {
    background: color-mix(in srgb, var(--color-primary) 7%, transparent);
  }

  &:hover {
    transform: translateY(-1px);
  }
}

.cover-wrap {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 4px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
}

.featured-play {
  position: absolute;
  inset: 0;
  width: 44px;
  height: 44px;
  margin: auto;
  border: 0;
  border-radius: 50%;
  color: var(--color-primary);
  background: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
}

.song-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.song-name,
.song-singer {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-name {
  color: var(--color-text-default);
  font-size: 15px;
  font-weight: 650;
}

.song-singer {
  margin-top: 5px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.song-actions,
.skeleton-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.song-actions {
  button {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    color: var(--color-text-secondary);
    background: transparent;
    cursor: pointer;
    transition: color 0.18s ease;

    &:hover {
      color: var(--color-primary);
    }

    &.collected {
      color: #ff5c67;
    }
  }
}

.skeleton-cover {
  width: 76px;
  height: 76px;
  border-radius: 4px;
}

.skeleton-info {
  min-width: 0;
}

.empty-state {
  margin-top: 80px;
}

@media (max-width: 1100px) {
  .song-grid {
    grid-template-columns: repeat(2, minmax(230px, 1fr));
    column-gap: 26px;
  }
}

@media (max-width: 700px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .song-grid {
    grid-template-columns: 1fr;
  }
}
</style>
