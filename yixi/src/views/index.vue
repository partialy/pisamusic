<template>
  <div class="index-container mw1600">
    <div class="title-card">
      <WelcomeCard style="width: 100%; height: 100%" />
    </div>
    <div class="title">推荐歌单</div>
    <div class="recommend-playlist">
      <PlaylistCollect :playlist="recPlaylist" />
    </div>
    <div class="title" style="margin-top: 20px">推荐音乐</div>
    <div class="recommend-music">
      <KGRecommendSong
        v-for="i in recSong"
        :key="i.id"
        :song="i"
        :collected="songMap.has(i.id)"
        @play="handlePlay"
        @collect="handleCollectSong" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  KGRecommendSong,
  PlaylistCollect,
  WelcomeCard,
} from "@/components";
import type { CommonPlaylist, Song } from "@/types/song";
import { useAudioStore, useCollectStore } from "@/store";
import { convertor } from "@/utils/convertor";
import { storeToRefs } from "pinia";
import { getKgDailyRecommend, getTopPlaylists } from "@/utils/api/musicAPI";

const player = useAudioStore();
const collector = useCollectStore();
const { songMap } = storeToRefs(collector);
const recPlaylist = ref<CommonPlaylist[]>([]);
const recSong = ref<Song[]>([]);
interface localData {
  time:number,
  data:any
}
const getRecPlaylist = async () => {
  const str = localStorage.getItem("recPlaylist");
  if(str){
    
    const data = JSON.parse(str) as localData;
    if(data.time == new Date().getDate()) {
      recPlaylist.value = data.data;
      return;
    }
  }
  const res: any = await getTopPlaylists({
    source: "kg",
    categoryId: 0,
  });
  recPlaylist.value = (res?.data.special_list || []).map((i: any) =>
    convertor.KG.convertKGPlaylist(i, "item")
  );
  localStorage.setItem("recPlaylist", JSON.stringify({time:new Date().getDate(),data:recPlaylist.value}))
};
const getRecSong = async () => {
  const str = localStorage.getItem("recSong");
  if(str){
    const data = JSON.parse(str) as localData;
    if(data.time == new Date().getDate()) {
      recSong.value = data.data;
      return;
    }
  }
  const res: any = await getKgDailyRecommend();
  recSong.value = (res?.data.song_list || []).map((i: any) =>
    convertor.KG.convertKGRecommendSong(i)
  );
  localStorage.setItem("recSong", JSON.stringify({time:new Date().getDate(),data:recSong.value}))
};

const handlePlay = (song: Song) => {
  player.setPlaylist([song], true);
};

const handleCollectSong = (song: Song) => {
  collector.collectSong(song);
};

onMounted(async () => {
  getRecPlaylist();
  getRecSong();
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
}
</style>
