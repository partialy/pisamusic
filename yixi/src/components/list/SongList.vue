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
            @add="handleAdd"
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
        <div
          style="
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-top: 20px;
          ">
          <div
            v-for="i in 20"
            :key="i"
            style="
              height: 60px;
              width: 100%;
              display: flex;
              flex-direction: column;
              gap: 5px;
              justify-content: center;
            ">
            <n-skeleton
              height="32px"
              width="90%"
              style="border-radius: 8px"></n-skeleton>
            <n-skeleton
              height="20px"
              width="60%"
              style="border-radius: 8px"></n-skeleton>
          </div>
        </div>
      </template>
      <ContextMenu ref="contextMenuRef" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAudioStore } from "@/store";
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import { CommonSongItem, ContextMenu } from "@/components";
import { VirtList } from "vue-virt-list";
import type { Song } from "@/types/song";
import { onBeforeRouteLeave } from "vue-router";
const player = useAudioStore();

const props = defineProps<{
  songs: Song[];
  loading?: boolean;
  minSize?: number;
  searchKey?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  hasMore?: boolean;
}>();

const emit = defineEmits<{
  scroll: [e: Event];
  scrollToBottom: [e: Event];
  scrollToTop: [e: Event];
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

const handleAdd = (song: Song) => {
  player.setPlaylist([song]);
};

const handleNextPlay = (song: Song) => {
  player.nextPlay(song);
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

  .song-list-header {
    height: 30px;
    display: flex;
    align-items: center;
    flex-direction: row;
    background-color: #fefefe;
    border-radius: 8px;
    padding: 0 1rem;

    .index,
    .img-con,
    .info,
    .collect,
    .album,
    .time {
      text-align: center;
      font-size: 0.8rem;
      color: #666;
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
