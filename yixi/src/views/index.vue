<template>
  <div class="index-container mw1600">
    <div class="title-card">
      <WelcomeCard
        :hot-songs="topPreviewSongs"
        :hot-loading="topSongsLoading"
        @show-more-hot-songs="scrollToHotSongs"
        @play="handlePlay" />
    </div>
    <div class="title">推荐歌单</div>
    <div class="recommend-playlist">
      <PlaylistCollect :playlist="recPlaylist" :loading="homeLoading" :skeleton-count="10" />
    </div>
    <div class="title" style="margin-top: 20px">推荐音乐</div>
    <HomeSongGrid
      :songs="recSong"
      :loading="homeLoading"
      :skeleton-count="9"
      :is-collected="isSongCollected"
      @play="handlePlay"
      @collect="handleCollectSong" />
    <div ref="hotSongsSectionRef" class="title" style="margin-top: 20px">热门歌曲</div>
    <HomeSongGrid
      :songs="topSectionSongs"
      :loading="topSongsLoading"
      :skeleton-count="12"
      :is-collected="isSongCollected"
      @play="handlePlay"
      @collect="handleCollectSong" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from "vue";
import PlaylistCollect from "@/components/list/PlaylistCollect.vue";
import WelcomeCard from "@/components/home/WelcomeCard.vue";
import HomeSongGrid from "@/components/home/HomeSongGrid.vue";
import type { CommonPlaylist, Song } from "@/types/song";
import { useAudioStore, useCollectStore } from "@/store";
import { convertor } from "@/utils/convertor";
import { getHomeRecommendations, getTopSongs } from "@/utils/api/musicAPI";

const player = useAudioStore();
const collector = useCollectStore();
const recPlaylist = ref<CommonPlaylist[]>([]);
const recSong = ref<Song[]>([]);
const topSongs = ref<Song[]>([]);
const homeLoading = ref(false);
const topSongsLoading = ref(false);
const hotSongsSectionRef = useTemplateRef<HTMLElement>("hotSongsSectionRef");

const topPreviewSongs = computed(() => topSongs.value.slice(0, 4));
const topSectionSongs = computed(() => topSongs.value.slice(0, 12));

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

const getHotSongs = async () => {
  try {
    topSongsLoading.value = true;
    const res: any = await getTopSongs();
    topSongs.value = (res?.data || []).map((item: any) =>
      convertor.KG.convertKGTopSong(item)
    );
  } catch (error) {
    window.$message?.warning("热门歌曲加载失败");
    void window.electronAPI.reportError(error, {
      scope: "home",
      action: "getHotSongs",
    });
  } finally {
    topSongsLoading.value = false;
  }
};

const handlePlay = (song: Song) => {
  player.setPlaylist([song], true);
};

const handleCollectSong = (song: Song) => {
  collector.collectSong(song);
};

const isSongCollected = (song: Song) => collector.containsSong(song);

const scrollToHotSongs = () => {
  hotSongsSectionRef.value?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

onMounted(async () => {
  void getHomeRecommend();
  void getHotSongs();
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
}
</style>
