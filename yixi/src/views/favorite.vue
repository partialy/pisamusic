<template>
  <div class="favorite-page">
    <div class="favorite-header">
      <h1>我的收藏</h1>
      <div class="favorite-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'songs' }"
          @click="activeTab = 'songs'">
          单曲 <span>{{ songs.length }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'playlists' }"
          @click="activeTab = 'playlists'">
          歌单 <span>{{ playlists.length }}</span>
        </button>
      </div>
    </div>

    <div class="toolbar">
      <n-button
        type="primary"
        class="play-all"
        :disabled="activeTab !== 'songs' || filteredSongs.length === 0"
        @click="playAll">
        <template #icon>
          <n-icon :component="Play" />
        </template>
        播放全部
      </n-button>

      <n-input
        v-model:value="searchKey"
        class="favorite-search"
        :class="{ focused: searchFocused || searchKey }"
        round
        clearable
        placeholder="搜索"
        @focus="searchFocused = true"
        @blur="searchFocused = false">
        <template #prefix>
          <n-icon :component="Search" />
        </template>
      </n-input>
    </div>

    <div class="favorite-content">
      <SongList
        v-if="activeTab === 'songs' && filteredSongs.length"
        :songs="filteredSongs"
        :min-size="64"
        show-footer
        show-header />

      <PlaylistCollect
        v-else-if="activeTab === 'playlists' && filteredPlaylists.length"
        :playlist="filteredPlaylists" />

      <n-empty v-else class="empty-state" description="暂无收藏内容" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NEmpty, NIcon, NInput } from "naive-ui";
import { Play, Search } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import PlaylistCollect from "@/components/list/PlaylistCollect.vue";
import SongList from "@/components/list/SongList.vue";
import { useAudioStore, useCollectStore } from "@/store";

const player = useAudioStore();
const collector = useCollectStore();
const { songs, playlists } = storeToRefs(collector);

const activeTab = ref<"songs" | "playlists">("songs");
const searchKey = ref("");
const searchFocused = ref(false);

const normalizedSearch = computed(() => searchKey.value.trim().toLowerCase());

const filteredSongs = computed(() => {
  const keyword = normalizedSearch.value;
  if (!keyword) return songs.value;
  return songs.value.filter((song) =>
    [song.name, song.singer, song.album]
      .filter(Boolean)
      .some((text) => text.toLowerCase().includes(keyword))
  );
});

const filteredPlaylists = computed(() => {
  const keyword = normalizedSearch.value;
  if (!keyword) return playlists.value;
  return playlists.value.filter((playlist) =>
    [playlist.name, playlist.desc, playlist.source]
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(keyword))
  );
});

function playAll() {
  if (!filteredSongs.value.length) return;
  player.switchPlayList(filteredSongs.value, true);
}

</script>

<style lang="scss" scoped>
.favorite-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: #30343b;
}

.favorite-header {
  h1 {
    margin: 0 0 22px;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 0;
  }
}

.favorite-tabs {
  display: flex;
  align-items: center;
  gap: 48px;
  margin-bottom: 26px;
}

.tab-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: #7d838c;
  font-size: 18px;
  cursor: pointer;
  transition: color 0.2s ease;

  span {
    margin-left: 4px;
    font-size: 14px;
  }

  &.active {
    color: #087bff;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}

.play-all {
  min-width: 108px;
  height: 40px;
  border-radius: 6px;
  background: #087bff;
}

.favorite-search {
  width: 92px;
  transition: width 0.25s ease;

  &.focused {
    width: 220px;
  }
}

.favorite-content {
  flex: 1;
  min-height: 0;
}

.empty-state {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
