<template>
  <div class="mine-playlist-panel">
    <div class="toolbar">
      <n-tabs v-model:value="activeSource" type="segment" size="small" class="source-tabs">
        <n-tab-pane name="all" tab="全部" />
        <n-tab-pane name="local" tab="自建" />
        <n-tab-pane name="kg" tab="KG" />
        <n-tab-pane name="wy" tab="WY" />
      </n-tabs>
      <div class="toolbar-actions">
        <n-button secondary round @click="createDialogRef?.open()">
          <template #icon>
            <n-icon :component="Plus" />
          </template>
          添加
        </n-button>
        <n-button secondary round :loading="store.playlistRefreshing" @click="store.refreshPlaylists(true)">
          <template #icon>
            <n-icon :component="RefreshCw" />
          </template>
          刷新
        </n-button>
      </div>
    </div>

    <div v-if="filteredPlaylists.length" class="playlist-grid" @scroll="emit('scroll', $event)">
      <button
        v-for="playlist in filteredPlaylists"
        :key="`${playlist.source}:${playlist.id}`"
        class="playlist-card"
        type="button"
        @click="openPlaylist(playlist)"
        @contextmenu.stop="openContextMenu($event, playlist)">
        <div class="cover-wrap">
          <img :src="getPlaylistCover(playlist)" :alt="playlist.name" />
          <span class="source-badge">{{ sourceLabel(playlist.source) }}</span>
          <span class="song-count">{{ playlist.song_count || 0 }} 首</span>
        </div>
        <div class="playlist-info">
          <div class="playlist-name" :title="playlist.name">{{ playlist.name }}</div>
          <div class="playlist-desc" :title="playlist.desc">{{ playlist.desc || "暂无描述" }}</div>
          <div v-if="playlist.tags.length" class="tag-row">
            <span v-for="tag in playlist.tags.slice(0, 3)" :key="tag.id || tag.name">{{ tag.name }}</span>
          </div>
        </div>
      </button>
    </div>

    <n-empty
      v-else
      class="empty-state"
      :description="store.playlistError || '暂无歌单内容'" />

    <ContextMenu ref="contextMenuRef" />
    <CreatePlaylistDialog ref="createDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NEmpty, NIcon, NTabPane, NTabs } from "naive-ui";
import { Plus, RefreshCw } from "lucide-vue-next";
import type { CommonPlaylist } from "@/types/song";
import { getKgImage } from "@/utils/common";
import { useMineLibraryStore } from "@/store";
import { useRouter } from "vue-router";
import ContextMenu from "@/components/common/ContextMenu.vue";
import CreatePlaylistDialog from "@/components/mine/CreatePlaylistDialog.vue";
import defaultCover from "@/assets/images/default-created-playlist-cover.svg";

type PlaylistFilter = "all" | "local" | "kg" | "wy";

const store = useMineLibraryStore();
const router = useRouter();
const activeSource = ref<PlaylistFilter>("all");
const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null);
const createDialogRef = ref<InstanceType<typeof CreatePlaylistDialog> | null>(null);
const emit = defineEmits<{
  scroll: [event: Event];
}>();

const filteredPlaylists = computed(() => store.getPlaylistsBySource(activeSource.value));

async function openPlaylist(playlist: CommonPlaylist) {
  await router.push({
    path: "/playlist/detail",
    query: { id: playlist.id, origin: playlist.source },
  });
}

function openContextMenu(event: MouseEvent, playlist: CommonPlaylist) {
  contextMenuRef.value?.openContextMenu(event, {
    type: "playlist",
    data: playlist,
  });
}

function getPlaylistCover(playlist: CommonPlaylist) {
  if (playlist.source === "local") return playlist.cover || defaultCover;
  if (playlist.source === "kg") return getKgImage(playlist.cover, 240);
  return playlist.coverSize?.m || playlist.cover || defaultCover;
}

function sourceLabel(source: CommonPlaylist["source"]) {
  if (source === "local") return "自建";
  return source.toUpperCase();
}
</script>

<style scoped lang="scss">
.mine-playlist-panel {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}

.source-tabs {
  width: 360px;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
}

.playlist-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.2rem, 1fr));
  grid-auto-rows: max-content;
  align-content: start;
  align-items: start;
  gap: 1rem;
  overflow: auto;
  padding-bottom: 18px;
}

.playlist-card {
  display: block;
  width: 100%;
  height: auto;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 20px;
  overflow: hidden;
  text-align: left;
  line-height: 1.4;
  color: var(--color-text-default);
  background: var(--color-bg);
  appearance: none;
  cursor: pointer;
}

.cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 20px;
  background: color-mix(in srgb, var(--color-bg-default) 86%, #ffffff 14%);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.24s ease;
  }
}

.playlist-card:hover .cover-wrap img {
  transform: scale(1.05);
}

.source-badge,
.song-count {
  position: absolute;
  z-index: 2;
  height: 26px;
  padding: 0 9px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(12px);
}

.source-badge {
  top: 10px;
  left: 10px;
}

.song-count {
  right: 10px;
  bottom: 10px;
}

.playlist-info {
  padding: 10px 8px 4px;
}

.playlist-name,
.playlist-desc {
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-name {
  min-height: 40px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  font-weight: 700;
}

.playlist-desc {
  margin-top: 6px;
  color: var(--color-text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;

  span {
    max-width: 100%;
    padding: 2px 7px;
    border-radius: 999px;
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    font-size: 11px;
  }
}

.empty-state {
  flex: 1;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}

</style>
