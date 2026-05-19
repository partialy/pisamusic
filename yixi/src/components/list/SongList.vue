<template>
  <Transition name="fade" mode="out-in">
    <div class="content-container" ref="contentConRef">
      <VirtList
        v-if="!loading"
        ref="virtListRef"
        :buffer="2"
        :offset="offset"
        :min-size="minSize || 64"
        :list="searchKey ? filteredSongs : songs"
        :style="{ height: height + 'px' }"
        @scroll="emit('scroll', $event)"
        @toBottom="emit('scrollToBottom', $event)"
        @toTop="emit('scrollToTop', $event)"
        item-key="id">
        <template #stickyHeader v-if="showHeader">
          <div class="song-list-header">
            <div class="index">#</div>
            <div class="img-con">封面</div>
            <div class="info">歌名、歌手</div>
            <div class="collect">收藏</div>
            <div class="album">专辑</div>
            <div class="time">时长、操作</div>
          </div>
        </template>
        <template #default="{ itemData, index }">
          <CommonSongItem
            :song="itemData"
            :playing="player.isPlaying"
            :index="index"
            :active="player.currentSong?.id == itemData.id"
            @play="handlePlay"
            @add="handleAddToPlaylist"
            @next-play="handleNextPlay"
            @contextmenu.stop="
              contextMenuRef?.openContextMenu($event, {
                type: 'song',
                data: itemData,
              })
            " />
        </template>
        <template #footer v-if="showFooter">
          <div
            style="
              height: 40px;
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #888;
            ">
            {{ (hasMore && !searchKey) ? "正在加载中..." : "没有更多了~" }}
          </div>
        </template>
      </VirtList>
      <template v-else>
        <div class="song-skeleton-list">
          <div class="song-list-header skeleton-header" v-if="showHeader">
            <n-skeleton text width="24px" />
            <n-skeleton text width="40px" />
            <n-skeleton text width="160px" />
            <n-skeleton text width="42px" />
            <n-skeleton text width="120px" />
            <n-skeleton text width="86px" />
          </div>
          <div v-for="i in 12" :key="i" class="song-skeleton-row">
            <n-skeleton circle height="42px" width="42px" />
            <div class="song-skeleton-main">
              <n-skeleton text :width="`${68 + (i % 4) * 6}%`" />
              <n-skeleton text :width="`${42 + (i % 3) * 8}%`" />
            </div>
            <n-skeleton class="song-skeleton-album" text :width="`${46 + (i % 4) * 8}%`" />
            <div class="song-skeleton-actions">
              <n-skeleton circle height="28px" width="28px" />
              <n-skeleton circle height="28px" width="28px" />
            </div>
          </div>
        </div>
      </template>
      <ContextMenu
        ref="contextMenuRef"
        :removable="removable"
        @remove-song="emit('removeSong', $event)"
        @download-song="handleDownloadSong"
        @detail-song="handleDetailSong"
        @add-to-playlist="handleAddToPlaylist" />
      <DownloadSongDialog :ref="songDownload.downloadDialogRef" />
      <AddToPlaylistDialog ref="addToPlaylistDialogRef" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAudioStore } from "@/store";
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import CommonSongItem from "@/components/search/CommonSongItem.vue";
import ContextMenu from "@/components/common/ContextMenu.vue";
import DownloadSongDialog from "@/components/player/DownloadSongDialog.vue";
import AddToPlaylistDialog from "@/components/player/AddToPlaylistDialog.vue";
import { VirtList } from "vue-virt-list";
import type { Song } from "@/types/song";
import { onBeforeRouteLeave } from "vue-router";
import { useSongDownload } from "@/composables/useSongDownload";
const player = useAudioStore();
const songDownload = useSongDownload();


const props = defineProps<{
  songs: Song[];
  loading?: boolean;
  minSize?: number;
  searchKey?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  hasMore?: boolean;
  removable?: boolean;
}>();

const emit = defineEmits<{
  scroll: [e: Event];
  scrollToBottom: [e: Event];
  scrollToTop: [e: Event];
  removeSong: [song: Song];
}>();

const filteredSongs = computed(() => {
  if (!props.searchKey) return props.songs;
  return props.songs.filter(
    (s) =>
      s.name.toLowerCase().includes(props.searchKey!!.toLowerCase()) ||
      s.singer.toLowerCase().includes(props.searchKey!!.toLowerCase())
  );
});

const height = ref(0);
const contentConRef = useTemplateRef("contentConRef");
const virtListRef = useTemplateRef("virtListRef");
const contextMenuRef = useTemplateRef("contextMenuRef");
const addToPlaylistDialogRef = useTemplateRef("addToPlaylistDialogRef");

const offset = ref(0);
const observer = new ResizeObserver((entries) => {
  for (let entry of entries) {
    const { height: val } = entry.contentRect;
    height.value = val;
  }
});

const handlePlay = (song: Song) => {
  player.switchPlayList(props.songs, false);
  player.play(song);
};

const handleNextPlay = (song: Song) => {
  player.nextPlay(song);
};

const handleDownloadSong = (song: Song) => {
  songDownload.openDownloadDialog(song);
};

const handleAddToPlaylist = (song: Song) => {
  addToPlaylistDialogRef.value?.open(song);
};

const handleDetailSong = (_song: Song) => {
  window.$message.info("详情功能后续接入");
};

onMounted(() => {
  contentConRef.value && observer.observe(contentConRef.value);
  if (offset.value > 0) {
    virtListRef.value?.scrollToIndex(offset.value);
  }
});

onBeforeRouteLeave(() => {
  offset.value = virtListRef.value?.getOffset() || 0;
});

onBeforeUnmount(() => {
  observer.disconnect();
});
</script>

<style lang="scss" scoped>
@keyframes fade-in {
  from {
    opacity: 0.5;
    transform: translateY(40px);
    scale: 0.95;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    scale: 1;
  }
}

@keyframes fade-out {
  from {
    opacity: 1;
    scale: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0.5;
    scale: 0.95;
    transform: translateY(40px);
  }
}

.fade-enter-active {
  animation: fade-in 0.5s ease-in-out;
}

.fade-leave-active {
  animation: fade-out 0.5s ease-in-out;
}

.content-container {
  width: 100%;
  height: 100%;

  .song-skeleton-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 0 16px;
  }

  .skeleton-header {
    display: grid;
    grid-template-columns: 48px 64px minmax(180px, 1fr) 64px 200px 114px;
    gap: 12px;
    align-items: center;
  }

  .song-skeleton-row {
    height: 64px;
    display: grid;
    grid-template-columns: 42px minmax(180px, 1fr) minmax(120px, 200px) 76px;
    gap: 14px;
    align-items: center;
    padding: 0 1rem;
    border: 1px solid var(--color-border-default);
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-bg-default) 82%, #ffffff 18%);
  }

  .song-skeleton-main,
  .song-skeleton-actions {
    display: flex;
    align-items: center;
  }

  .song-skeleton-main {
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .song-skeleton-actions {
    justify-content: flex-end;
    gap: 10px;
  }

  .song-list-header {
    height: 36px;
    display: flex;
    align-items: center;
    flex-direction: row;
    background: color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-default));
    border: 1px solid var(--color-border-default);
    border-radius: 12px;
    padding: 0 1rem;
    margin-bottom: 6px;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);

    .index,
    .img-con,
    .info,
    .collect,
    .album,
    .time {
      text-align: center;
      font-size: 0.8rem;
      color: var(--color-text-secondary);
      font-weight: 600;
    }

    .index {
      width: 48px;
    }

    .img-con {
      width: 64px;
    }

    .info {
      flex: 1;
      text-align: left;
    }

    .collect {
      width: 64px;
    }

    .album {
      width: 200px;
    }

    .time {
      width: 114px;
    }
  }
}
</style>
