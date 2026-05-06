<template>
  <div class="play-list-detail-layout" v-if="!loading">
    <div class="detail-header" :style="{ height: isMini ? '120px' : '220px' }">
      <div class="detail-header-left" :style="{ width: isMini ? '100px' : '200px' }">
        <div class="detail-header-left-img" :style="{ width: isMini ? '100px' : '200px' }">
          <img :src="detailCover" alt="detailHeader" />
        </div>
      </div>
      <div class="detail-header-right">
        <div class="list-title">
          <span>{{ listDetail?.name }}</span>
        </div>
        <div class="list-info">
          <div class="list-intro text-line-2" v-show="!isMini">
            <n-tooltip trigger="click" placement="top" style="max-width: 300px">
              <template #trigger>
                <n-text class="truncate-text">{{ listDetail?.desc }}</n-text>
              </template>
              <template #default>
                <span>{{ listDetail?.desc }}</span>
              </template>
            </n-tooltip>
          </div>
          <div class="list-tag-time" v-show="!isMini">
            <n-tag round :type="ramdomTagType()" v-for="item in listDetail?.tags" :key="item.id"
              style="margin-right: 8px">{{
              item.name }}</n-tag>
          </div>
          <div class="operate-btn" ref="operateBtn">
            <div>
              <n-button round type="primary" :loading="moreLoading" style="background-color: var(--color-primary)"
                @click="playAll">
                <template #icon>
                  <n-icon :component="PlayStatic"></n-icon>
                </template>
                播放全部({{ page.total }}首)
              </n-button>
              <n-button round type="success" :loading="allLoading" style="
                  background-color: var(--color-primary);
                  margin-left: 10px;
                " @click="collector.collectList(listDetail)">
                <template #icon>
                  <n-icon :component="CollectIcon" :color="playlistMap.has(listDetail?.id || '') ? 'red' : 'white'
                    "></n-icon>
                </template>
                {{
                  playlistMap.has(listDetail?.id || "") ? "取消收藏" : "收藏"
                }}
              </n-button>
            </div>

            <n-input round :style="{
              width: searchFocus ? '150px' : '80px',
              display: 'flex',
              'align-items': 'center',
              transition: 'width 0.3s',
            }" v-model:value="searchText" @blur="searchFocus = false" @focus="searchFocus = true" placeholder="搜索">
              <template #prefix>
                <n-icon :component="SearchIcon"></n-icon>
              </template>
            </n-input>
          </div>
        </div>
      </div>
    </div>
    <div class="scroll-list">
      <SongList :songs="songList" :loading="loading" :has-more="songList.length < page.total" :search-key="searchText"
        show-footer show-header @scroll="onScroll" @scroll-to-bottom="onToBottom" />
    </div>
  </div>
  <!-- 骨架屏 -->
  <div class="play-list-detail-layout" v-else>
    <div class="detail-header" style="height: 220px; display: flex; padding: 20px">
      <div class="detail-header-left" style="margin-right: 20px">
        <n-skeleton height="200px" width="200px" />
      </div>
      <div class="detail-header-right" style="flex: 1">
        <n-skeleton text :repeat="1" style="margin-bottom: 20px" />
        <n-skeleton text :repeat="2" style="margin-bottom: 20px" />
        <div style="display: flex; gap: 8px; margin-bottom: 20px">
          <n-skeleton height="22px" width="60px" round />
          <n-skeleton height="22px" width="80px" round />
          <n-skeleton height="22px" width="70px" round />
        </div>
        <div style="display: flex; gap: 12px">
          <n-skeleton height="34px" width="140px" round />
          <n-skeleton height="34px" width="80px" round />
          <n-skeleton height="34px" width="150px" round />
        </div>
      </div>
    </div>
    <div style="margin-top: 10px">
      <n-skeleton text style="margin: 8px 0" :repeat="10" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import {
  NButton,
  NInput,
  NTooltip,
  NText,
  NTag,
  NSkeleton,
  useMessage,
} from "naive-ui";
import { computed, onMounted, ref, watch } from "vue";

import type { KGPlaylistDetailData } from "@/utils/webapi";
import { debounce, getKgImage } from "@/utils/common";
import directAPI from "@/utils/api/directAPI";
import SearchIcon from "@/icons/header/SearchIcon.vue";
import { CollectIcon, PlayStatic } from "@/icons";
import { useAudioStore, useCollectStore } from "@/store";
import { convertor } from "@/utils/convertor";
import type { CommonPlaylist, Song } from "@/types/song";
import type { WYPlaylistDetail } from "@/utils/webapi";

import { SongList } from "..";
import { storeToRefs } from "pinia";

const player = useAudioStore();
const collector = useCollectStore();
const { playlistMap } = storeToRefs(collector);
const message = useMessage();
const route = useRoute();
let id = route.query.id;
const searchText = ref("");
const searchFocus = ref(false);
const loading = ref(false);
const moreLoading = ref(false);
const allLoading = ref(false);
const kgListDetail = ref<KGPlaylistDetailData>();
const wyListDetail = ref<WYPlaylistDetail>();

const listDetail = ref<CommonPlaylist>();
const detailCover = computed(() => {
  if (route.query.origin == "wy") {
    return listDetail.value?.coverSize?.l || listDetail.value?.cover;
  } else {
    return getKgImage(listDetail.value?.cover, 240);
  }
});

const convertDetail = (origin: "kg" | "wy") => {
  if (origin != "wy") {
    if (!kgListDetail.value) return;
    listDetail.value = convertor.KG.convertKGPlaylist(
      kgListDetail.value,
      "detail"
    );
  } else {
    if (!wyListDetail.value) return;
    listDetail.value = convertor.WY.convertWYPlaylist(wyListDetail.value);
  }
};

const TagType = {
  default: "default",
  primary: "primary",
  info: "info",
  success: "success",
  warning: "warning",
  error: "error",
};

const songList = ref<Song[]>([]);
const allSong = ref<Song[]>([]);
const page = ref({
  currentPage: 1,
  size: 30,
  total: 0,
});

const ramdomTagType = ():
  | "default"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "error" => {
  const key = Math.floor(Math.random() * 6) + 1;
  return Object.values(TagType)[key] as
    | "default"
    | "primary"
    | "info"
    | "success"
    | "warning"
    | "error";
};

const getListDetail = async () => {
  if (route.query.origin == "wy") {
    const res = await directAPI.wy?.playlistDetail({
      id: id as string,
      s: 3,
    });
    wyListDetail.value = res?.playlist;
    page.value.total = res?.playlist.trackCount!!;
    if (page.value.total > 300) {
      page.value.size = Math.max(Math.ceil(page.value.total / 5), 60);
    }
  } else {
    const res = await directAPI.kg?.playListDetail([id as string]);
    kgListDetail.value = res?.data[0];
  }
  convertDetail(route.query.origin as "kg" | "wy");
};

const getSongList = async () => {
  if (route.query.origin == "wy") {
    const res = await directAPI.wy?.playlistTrackAll({
      id: id as string,
      limit: page.value.size,
      offset: page.value.size * (page.value.currentPage - 1),
    });
    const rawList = res?.songs || [];
    songList.value = rawList.map((i) => convertor.WY.convertPlaylistSong(i));
  } else {
    const res = await directAPI.kg?.playListTracks({ id: id as string });
    const rawList = res?.data.info || [];
    songList.value = rawList.map((i) => convertor.KG.convertKGPlaylistSong(i));
    page.value.currentPage = ((res?.data.begin_idx || 0) % page.value.size) + 1;
    page.value.total = res?.data.count || 0;
    if (page.value.total > 300) {
      page.value.size = Math.max(Math.ceil(page.value.total / 5), 60);
    }
  }
};

const handlePlay = async (item?: Song) => {
  if (item) player.play(item);
  // 等待播放列表加载完成
  let timer: any;
  if (allLoading.value) {
    message.success("正在加载全部歌曲...");
  }
  timer = setInterval(() => {
    if (!allLoading.value) {
      clearInterval(timer);
      player.switchPlayList(allSong.value, false);
      if (!item) {
        player.play(allSong.value[0]);
      }
    }
  }, 300);
};

const playAll = async () => {
  songList.value = allSong.value;
  handlePlay();
};

const loadAll = async () => {
  if (allLoading.value) return;
  allLoading.value = true;
  const times =
    page.value.total % page.value.size === 0
      ? Math.floor(page.value.total / page.value.size)
      : Math.floor(page.value.total / page.value.size) + 1;
  if (route.query.origin == "wy") {
    for (let i = 1; i <= times; i++) {
      const res = await directAPI.wy?.playlistTrackAll({
        id: id as string,
        limit: page.value.size,
        offset: page.value.size * (i - 1),
      });
      const l = res?.songs.map((i) => convertor.WY.convertPlaylistSong(i));
      if (l) allSong.value = [...allSong.value, ...l];
    }
  } else {
    for (let i = 1; i <= times; i++) {
      const res = await directAPI.kg?.playListTracks({
        id: id as string,
        page: i,
        pagesize: page.value.size,
      });
      const s = res?.data.info || [];
      const l = s.map((i) =>
        convertor.KG.convertKGPlaylistSong(i)
      );
      if (l) allSong.value = [...allSong.value, ...l];
    }
  }
  allLoading.value = false;
};

const initData = debounce(async () => {
  id = route.query.id;
  allSong.value = [];
  songList.value = [];
  await getListDetail();
  await getSongList();
  loading.value = false;
  setTimeout(loadAll, 100);
}, 300);

onMounted(async () => {
  loading.value = true;
  initData();
});

const isMini = ref(false);
const operateBtn = ref<HTMLElement | null>(null);

// 列表滚动
const onScroll = (event: Event) => {
  const container = event.target as HTMLElement;
  const scrollTop = container.scrollTop;
  isMini.value = true;

  // 检测是否滚动到顶部
  if (scrollTop === 0) {
    onToTop();
  }
};

// 列表触底
const onToBottom = () => {
  if (loading.value || allLoading.value) return;
  loadSongsInChunks();
};

const loadSongsInChunks = async () => {
  const chunkSize = 60;
  let loadedCount = 0;

  songList.value = allSong.value.slice(0, chunkSize);
  loadedCount += chunkSize;

  const loadNextChunk = () => {
    if (loadedCount >= allSong.value.length) return;

    const remaining = allSong.value.length - loadedCount;
    const currentChunkSize = Math.min(chunkSize, remaining);
    const nextChunk = allSong.value.slice(
      loadedCount,
      loadedCount + currentChunkSize
    );

    songList.value = [...songList.value, ...nextChunk];
    loadedCount += currentChunkSize;

    requestAnimationFrame(loadNextChunk);
  };

  requestAnimationFrame(loadNextChunk);
};

// 列表触顶
const onToTop = () => {
  isMini.value = false;
};

watch(
  () => route.query.id,
  async () => {
    loading.value = true;
    initData();
  }
);
</script>

<style scoped lang="scss">
@keyframes moveUp {
  0% {
    transform: translateY(0);
  }

  100% {
    transform: translateY(-100px);
  }
}

* {
  transition: all 0.4s;
}

.active {
  background-color: white !important;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(255, 255, 255, 0.3);
  // box-shadow: 0 0 10px 3px rgba(255, 255, 255, 0.3);
}

.play-list-detail-layout {
  margin: 0 auto;
  width: 100%;
  max-width: 1400px;
  background: transparent;
  position: relative;
  display: flex;
  flex-direction: column;

  .detail-header {
    width: 100%;
    background: transparent;
    display: flex;
    padding-bottom: 20px;
    position: sticky;
    top: 0;
    z-index: 90;

    .detail-header-left {
      width: 200px;
      height: 100%;
      box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
      border-radius: 20px;
      overflow: hidden;

      .detail-header-left-img {
        width: 100%;
        height: 100%;

        img {
          width: 100%;
          height: 100%;
        }
      }
    }

    .detail-header-right {
      flex: 1;
      margin-left: 20px;
      background: transparent;
      display: flex;
      flex-direction: column;

      .list-title {
        height: 60px;
        font-size: 26px;
        font-weight: 600;
      }

      .list-info {
        display: flex;
        flex: 1;
        flex-direction: column;
        position: relative;

        .list-intro {
          height: 35%;
          font-size: 16px;
          color: var(--color-text);
          cursor: pointer;
        }

        .list-tag-time {
          height: 30%;
          display: flex;
          align-items: center;
          font-size: 14px;
          color: var(--color-text);
        }

        .operate-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: absolute;
          bottom: 5px;
          left: 0;
          right: 0;
        }
      }
    }
  }

  .scroll-list {
    width: 100%;
    flex: 1;
    overflow: hidden;
  }
}
</style>
