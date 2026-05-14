<template>
  <div class="index-container mw1600">
    <div class="title-card">
      <WelcomeCard style="width: 100%; height: 100%" />
    </div>
    <div class="title">推荐歌单</div>
    <div class="recommend-playlist">
      <PlaylistCollect :playlist="recPlaylist" :loading="homeLoading" :skeleton-count="10" />
    </div>
    <div class="title" style="margin-top: 20px">推荐音乐</div>
    <div class="recommend-music">
      <template v-if="homeLoading">
        <div v-for="i in 9" :key="i" class="music-skeleton-item">
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
          v-for="i in recSong"
          :key="i.id"
          :song="i"
          :collected="collector.containsSong(i)"
          @play="handlePlay"
          @collect="handleCollectSong" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NSkeleton } from "naive-ui";
import KGRecommendSong from "@/components/playList/KGRecommendSong.vue";
import PlaylistCollect from "@/components/list/PlaylistCollect.vue";
import WelcomeCard from "@/components/home/WelcomeCard.vue";
import type { CommonPlaylist, Song } from "@/types/song";
import { useAudioStore, useCollectStore } from "@/store";
import { convertor } from "@/utils/convertor";
import { getHomeRecommendations } from "@/utils/api/musicAPI";

const player = useAudioStore();
const collector = useCollectStore();
const recPlaylist = ref<CommonPlaylist[]>([]);
const recSong = ref<Song[]>([]);
const homeLoading = ref(false);
const getHomeRecommend = async () => {
  try {
    homeLoading.value = true;
    const res: any = await getHomeRecommendations();
    recPlaylist.value = (res?.playlists?.data?.special_list || []).map((i: any) =>
      convertor.KG.convertKGPlaylist(i, "item")
    );
    recSong.value = (res?.songs?.data?.song_list || []).map((i: any) =>
      convertor.KG.convertKGRecommendSong(i)
    );
  } finally {
    homeLoading.value = false;
  }
};

const handlePlay = (song: Song) => {
  player.setPlaylist([song], true);
};

const handleCollectSong = (song: Song) => {
  collector.collectSong(song);
};

onMounted(async () => {
  getHomeRecommend();
});
</script>

<style lang="scss" scoped>
.index-container {
  height: 100%;
  width: 100%;
  will-change: transform;

  .title {
    font-size: 1.3rem;
    line-height: 40px;
    height: 40px;
    margin: 1rem 0;
    padding: 0 0.8rem;
    border-radius: 4px;
    border-left: 5px solid var(--color-primary);
  }

  .title-card {
    margin-bottom: 1.5rem;
  }

  .recommend-music {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 80px);
    gap: 10px;
    padding-bottom: 1rem;
  }

  /* 防止子元素被内容撑开 */
  .recommend-music > * {
    min-width: 0; /* 允许宽度缩小 */
    min-height: 0; /* 允许高度缩小 */
    overflow: hidden; /* 可选：隐藏超出内容 */
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
}
</style>
