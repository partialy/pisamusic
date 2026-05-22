<template>
  <div class="index-container mw1600">
    <div class="title-card">
      <WelcomeCard
        :hot-songs="topPreviewSongs"
        :hot-loading="topSongsLoading"
        @show-more-hot-songs="scrollToHotSongs"
        @play="handlePlay" />
    </div>

    <HomeReveal>
      <HomeSectionTitle title="推荐歌单" show-more @more="handleSectionMore" />
      <PlaylistCollect :playlist="recPlaylist" :loading="homeLoading" :skeleton-count="24" :max-rows="4" />
    </HomeReveal>

    <HomeReveal>
      <HomeSectionTitle title="推荐音乐" />
      <HomeSongGrid
        :songs="recSong"
        :loading="homeLoading"
        :skeleton-count="9"
        :is-collected="isSongCollected"
        @play="handlePlay"
        @collect="handleCollectSong" />
    </HomeReveal>

    <HomeReveal>
      <div ref="hotSongsSectionRef">
        <HomeSectionTitle title="热门歌曲" />
      </div>
      <HomeSongGrid
        :songs="topSectionSongs"
        :loading="topSongsLoading"
        :skeleton-count="12"
        :is-collected="isSongCollected"
        @play="handlePlay"
        @collect="handleCollectSong" />
    </HomeReveal>

    <HomeReveal>
      <HomeSectionTitle title="网友精选碟" show-more @more="handleSectionMore" />
      <PlaylistCollect :playlist="wyTopPlaylists" :loading="wyTopPlaylistLoading" :skeleton-count="24" :max-rows="4" />
    </HomeReveal>

    <HomeReveal>
      <HomeSectionTitle title="WY推荐歌曲" />
      <HomeSongGrid
        :songs="wyNewSongs"
        :loading="wyNewSongsLoading"
        :skeleton-count="12"
        :is-collected="isSongCollected"
        @play="handlePlay"
        @collect="handleCollectSong" />
    </HomeReveal>

    <HomeReveal>
      <HomeSectionTitle title="WY推荐歌单" show-more @more="handleSectionMore" />
      <PlaylistCollect
        :playlist="wyPersonalizedPlaylists"
        :loading="wyPersonalizedPlaylistLoading"
        :skeleton-count="24"
        :max-rows="4" />
    </HomeReveal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from "vue";
import { useRouter } from "vue-router";
import PlaylistCollect from "@/components/list/PlaylistCollect.vue";
import WelcomeCard from "@/components/home/WelcomeCard.vue";
import HomeSongGrid from "@/components/home/HomeSongGrid.vue";
import HomeSectionTitle from "@/components/home/HomeSectionTitle.vue";
import HomeReveal from "@/components/home/HomeReveal.vue";
import type { CommonPlaylist, Song } from "@/types/song";
import { useAudioStore, useCollectStore } from "@/store";
import { convertor } from "@/utils/convertor";
import {
  getHomeRecommendations,
  getTopPlaylists,
  getTopSongs,
  getWyPersonalizedNewSongs,
  getWyPersonalizedPlaylists,
} from "@/utils/api/musicAPI";

const player = useAudioStore();
const collector = useCollectStore();
const router = useRouter();
const recPlaylist = ref<CommonPlaylist[]>([]);
const recSong = ref<Song[]>([]);
const topSongs = ref<Song[]>([]);
const wyTopPlaylists = ref<CommonPlaylist[]>([]);
const wyNewSongs = ref<Song[]>([]);
const wyPersonalizedPlaylists = ref<CommonPlaylist[]>([]);
const homeLoading = ref(false);
const topSongsLoading = ref(false);
const wyTopPlaylistLoading = ref(false);
const wyNewSongsLoading = ref(false);
const wyPersonalizedPlaylistLoading = ref(false);
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

const getWyTopPlaylists = async () => {
  try {
    wyTopPlaylistLoading.value = true;
    const res: any = await getTopPlaylists({
      source: "wy",
      page: 1,
      pageSize: 24,
      order: "hot",
      cat: "全部",
    });
    wyTopPlaylists.value = (res?.playlists || []).map((item: any) =>
      convertor.WY.convertWYTopPlaylist(item)
    );
  } catch (error) {
    window.$message?.warning("网友精选碟加载失败");
    void window.electronAPI.reportError(error, {
      scope: "home",
      action: "getWyTopPlaylists",
    });
  } finally {
    wyTopPlaylistLoading.value = false;
  }
};

const getWyNewSongs = async () => {
  try {
    wyNewSongsLoading.value = true;
    const res: any = await getWyPersonalizedNewSongs({ limit: 12 });
    wyNewSongs.value = (res?.result || []).map((item: any) =>
      convertor.WY.convertWYPersonalizedNewSong(item)
    );
  } catch (error) {
    window.$message?.warning("WY推荐歌曲加载失败");
    void window.electronAPI.reportError(error, {
      scope: "home",
      action: "getWyNewSongs",
    });
  } finally {
    wyNewSongsLoading.value = false;
  }
};

const getWyPersonalizedPlaylist = async () => {
  try {
    wyPersonalizedPlaylistLoading.value = true;
    const res: any = await getWyPersonalizedPlaylists({ limit: 24 });
    wyPersonalizedPlaylists.value = (res?.result || []).map((item: any) =>
      convertor.WY.convertWYPersonalizedPlaylist(item)
    );
  } catch (error) {
    window.$message?.warning("WY推荐歌单加载失败");
    void window.electronAPI.reportError(error, {
      scope: "home",
      action: "getWyPersonalizedPlaylist",
    });
  } finally {
    wyPersonalizedPlaylistLoading.value = false;
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

const handleSectionMore = () => {
  router.push("/playlist")
};

onMounted(async () => {
  void getHomeRecommend();
  void getHotSongs();
  void getWyTopPlaylists();
  void getWyNewSongs();
  void getWyPersonalizedPlaylist();
});
</script>

<style lang="scss" scoped>
.index-container {
  height: 100%;
  width: 100%;
  will-change: transform;

  .title-card {
    margin-bottom: 1.5rem;
  }
}
</style>
