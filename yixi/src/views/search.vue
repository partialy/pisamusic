<template>
  <div class="search-container">
    <div class="title-info">
      <div>
        <strong class="keywords-text">{{ keywords }}</strong>
        <span class="keywords-description">的搜索结果</span>
      </div>
      <div class="origin-select">
        <n-radio-group
          v-model:value="origin"
          name="radiogroup"
          @update:value="handleChangeOringin">
          <n-space>
            <n-radio v-for="i in originOptions" :key="i.value" :value="i.value">
              {{ i.label }}
            </n-radio>
          </n-space>
        </n-radio-group>
        <n-select
          style="width: 80px"
          v-model:value="searchType"
          :options="searchTypeOptions"
          @update-value="handleChangeType" />
      </div>
    </div>
    <div class="result-list" >
      <SongList v-show="change" v-if="searchType == 'song'"
        :loading="searchLoading"
        :songs="songList || []"
        show-footer
        show-header
        :has-more="hasMore"
        @scroll-to-bottom="handleToBottom" />

        <PlaylistCollect style="margin-top: 1rem;" v-else-if="searchType == 'playlist'" :playlist="playlist" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { NSelect, NRadio, NRadioGroup, NSpace } from "naive-ui";
import type { CommonPlaylist, Song } from "../types/song";
import directAPI from "../utils/api/directAPI";
import { convertor } from "../utils/convertor";
import { searchMusic } from "@/utils/api/musicAPI";

import { PlaylistCollect, SongList } from "@/components";

const route = useRoute();
const keywords = ref("");
const origin = ref("kg");
const originOptions = [
  { label: "kg", value: "kg" },
  { label: "wy", value: "wy" },
  { label: "kw", value: "kw" },
];
const searchType = ref("song");
const searchTypeOptions = [
  { label: "单曲", value: "song" },
  { label: "歌单", value: "playlist" },
  { label: "歌手", value: "artist" },
  { label: "专辑", value: "album" },
  { label: "歌词", value: "lyric" },
];
const songs = reactive<{
  kg: Song[],
  wy: Song[],
  kw: Song[],
}>({
  kg: [],
  wy: [],
  kw: [],
})

const change = ref(true);

const songList = computed(() => {
  switch (origin.value) {
    case "kg":
      return songs.kg;
    case "wy":
      return songs.wy;
    case "kw":
      return songs.kw;
  }
  return [];
});

const searchLoading = ref(false);

const pagination = reactive({
  page: 1,
  pageSize: 30,
  total: 0,
});

const handleChangeOringin = (value: string) => {
  pagination.page = 1;
  change.value = false
  search(value);
  nextTick(() => {
    change.value = true
  })
};

const handleChangeType = (value: string) => {
  if(value == "playlist"){
    searchList()
  }
};

const search = async (tab: string) => {
  pagination.page = 1;
  pagination.total = 0;
  pagination.pageSize = 30;
  try {
    searchLoading.value = true;
    switch (tab) {
      case "kg":
        const kgres: any = await searchMusic({
          source: "kg",
          keywords: keywords.value,
          page: pagination.page,
          pageSize: pagination.pageSize,
        });
        const kgList = kgres?.data?.lists ?? kgres?.data?.songs ?? [];
        songs.kg =
          kgList.map((item:any) =>
            convertor.KG.convertKGSearchSong(item)
          ) || [];
        pagination.total = kgres?.data.total || 0;
        break;
      case "wy":
        const wyres: any = await searchMusic({
          source: "wy",
          keywords: keywords.value,
          page: pagination.page,
          pageSize: pagination.pageSize,
        });
        songs.wy =
        // @ts-ignore
          wyres?.result.songs.map((item) =>
            convertor.WY.convertCloudSearchSong(item)
          ) || [];
          // @ts-ignore
        pagination.total = wyres?.result.songCount || 0;
        break;
      case "kw":
        const kwres: any = await searchMusic({
          source: "kw",
          keywords: keywords.value,
          page: pagination.page,
          pageSize: pagination.pageSize,
        });
        songs.kw = kwres?.data.map((item: any) => convertor.KW(item)) || [];
        pagination.total = 100;
        break;
    }
  } catch (error: any) {
    console.log(error);
    window.$notification.error({
      title: "搜索失败",
      duration: 2000,
      content: error.message,
    });
  } finally {
    searchLoading.value = false;
  }
};

const hasMore = computed(() => {
  return songList.value.length < (pagination.total || 0);
});

const handleToBottom = async () => {
  if (searchLoading.value || moreLoading.value) return;
  if (hasMore.value) {
    loadMore();
  }
};

const moreLoading = ref(false);
const loadMore = async () => {
  try {
    moreLoading.value = true;
    pagination.page += 1;
    switch (origin.value) {
      case "kg":
        const kgres: any = await searchMusic({
          source: "kg",
          keywords: keywords.value,
          page: pagination.page,
          pageSize: pagination.pageSize,
        });
        const kgList = kgres?.data?.lists ?? kgres?.data?.songs ?? [];
        const kl =
        // @ts-ignore
          kgList.map((item) =>
            convertor.KG.convertKGSearchSong(item)
          ) || [];
        songs.kg = [...songs.kg, ...kl];
        pagination.total = kgres?.data.total || 0;
        break;
      case "wy":
        const wyres: any = await searchMusic({
          source: "wy",
          keywords: keywords.value,
          page: pagination.page,
          pageSize: pagination.pageSize,
        });
        const wl =
        // @ts-ignore
          wyres?.result.songs.map((item) =>
            convertor.WY.convertCloudSearchSong(item)
          ) || [];
        songs.wy = [...songs.wy, ...wl];
        // @ts-ignore
        pagination.total = wyres?.result.songCount || 0;
        break;
      case "kw":
        const kwres: any = await searchMusic({
          source: "kw",
          keywords: keywords.value,
          page: pagination.page,
          pageSize: pagination.pageSize,
        });
        const kwl = kwres?.data.map((item: any) => convertor.KW(item)) || [];
        songs.kw = [...songs.kw, ...kwl];
        pagination.total = 100;
        break;
    }
  } catch (error: any) {
    console.log(error);
    window.$notification.error({
      title: "搜索失败",
      duration: 2000,
      content: error.message,
    });
  } finally {
    moreLoading.value = false;
  }
};

const init = async () => {
  keywords.value = route.query.key as string;
  origin.value = (route.query.tab as string) || "kg";
  if (!keywords.value) return;
  search(origin.value);
};

// 歌单
const list = reactive<{
  kg: CommonPlaylist[];
  wy: CommonPlaylist[];
}>({
  kg: [],
  wy: [],
})
const playlist = computed(() => {
  switch (origin.value) {
    case "kg":
      return list.kg;
    case "wy":
      return list.wy;
      default:
        return [];
  }
});
const page = reactive({
  page: 1,
  pageSize: 30,
  total: 0,
})

const searchList = async () => { 
  try {
    switch(origin.value){
      case 'kg':
        const kres = await directAPI.kg?.search({
          keywords: keywords.value,
          page: 1,
          pagesize: 30,
          type: 'special'
        })
        list.kg = kres?.data.lists.map((item:any) => convertor.KG.convertSearchList(item)) || []
        page.total = kres?.data.total || 0
        break;
        case 'wy':
          const wyres = await directAPI.wy?.cloudSearch({
            keywords: keywords.value,
            offset: 0,
            limit: 30,
            type: 1000,
          })
          // @ts-ignore
          list.wy = wyres?.result.playlists.map((item:any) => convertor.WY.convertSearchList(item)) || []
          // @ts-ignore
          page.total = wyres?.result.playlistCount || 0
          break;
    }
  } catch (error) {
    console.log("搜索歌单失败："+error);
  }
}

onMounted(() => {
  init();
});

watch(
  () => route.query.key,
  (newVal,oldVal) => {
    if (newVal == oldVal) return;
    init();
  }
);
</script>

<style lang="scss" scoped>
.search-container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;

  .title-info {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .keywords-text {
      font-size: 2rem;
      font-weight: 700;
      padding: 0 1rem;
      color: var(--color-primary);
    }

    .keywords-description {
      font-weight: 400;
      color: #666;
    }

    .origin-select {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-direction: row;
      gap: 1rem;
      padding: 0 1rem;
    }
  }

  .result-list {
    flex: 1;
    overflow-y: scroll;
  }
}
</style>
