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
          <div class="operate-btn">
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
                  <n-icon :component="CollectIcon" :color="collector.containsPlaylist(listDetail) ? 'red' : 'white'
                    "></n-icon>
                </template>
                {{
                  collector.containsPlaylist(listDetail) ? "取消收藏" : "收藏"
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
import SearchIcon from "@/icons/header/SearchIcon.vue";
import { CollectIcon, PlayStatic } from "@/icons";
import { useCollectStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { convertor } from "@/utils/convertor";
import type { CommonPlaylist, Song } from "@/types/song";
import type { WYPlaylistDetail } from "@/utils/webapi";
import { getPlaylistDetail, getPlaylistTracks } from "@/utils/api/musicAPI";
import { listMinePlaylistSongs, listMinePlaylists } from "@/utils/api/mineLibraryAPI";
import defaultPlaylistCover from "@/assets/images/default-created-playlist-cover.svg";

import SongList from "@/components/list/SongList.vue";

type DetailOrigin = "kg" | "wy" | "local";

const playbackCommands = usePlaybackCommands();
const collector = useCollectStore();
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
  const origin = getDetailOrigin();
  if (origin === "local") {
    return listDetail.value?.cover || defaultPlaylistCover;
  }
  if (origin == "wy") {
    return listDetail.value?.coverSize?.l || listDetail.value?.cover;
  } else {
    return getKgImage(listDetail.value?.cover, 240);
  }
});

function getDetailOrigin(): DetailOrigin {
  return route.query.origin === "wy" || route.query.origin === "local" ? route.query.origin : "kg";
}

const convertDetail = (origin: Exclude<DetailOrigin, "local">) => {
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
const localSongCache = ref<Song[]>([]);
const loadVersion = ref(0);
const INITIAL_PAGE_SIZE = 30;
const BACKGROUND_PAGE_SIZE = 300;
const VISIBLE_CHUNK_SIZE = 60;
const page = ref({
  currentPage: 1,
  size: INITIAL_PAGE_SIZE,
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
  const origin = getDetailOrigin();
  if (origin === "local") {
    const playlists = await listMinePlaylists("local");
    const playlist = playlists.find((item) => item.id === id);
    if (!playlist) throw new Error("自建歌单不存在");
    listDetail.value = playlist;
    localSongCache.value = await listMinePlaylistSongs(id as string);
    page.value.total = localSongCache.value.length;
    return;
  }

  if (origin == "wy") {
    const res: any = await getPlaylistDetail({
      source: "wy",
      id: id as string,
    });
    wyListDetail.value = res?.playlist;
    page.value.total = res?.playlist.trackCount!!;
  } else {
    const res: any = await getPlaylistDetail({
      source: "kg",
      id: id as string,
    });
    kgListDetail.value = res?.data[0];
    page.value.total = kgListDetail.value?.count || 0;
  }
  convertDetail(origin);
};

const getSongList = async () => {
  const initialSongs = await fetchPlaylistSongs(0, INITIAL_PAGE_SIZE);
  songList.value = initialSongs;
  allSong.value = initialSongs;
};

const fetchPlaylistSongs = async (offset: number, pageSize: number): Promise<Song[]> => {
  const origin = getDetailOrigin();
  if (origin === "local") {
    if (!localSongCache.value.length) {
      localSongCache.value = await listMinePlaylistSongs(id as string);
      page.value.total = localSongCache.value.length;
    }
    return localSongCache.value.slice(offset, offset + pageSize);
  }

  if (origin == "wy") {
    const res: any = await getPlaylistTracks({
      source: "wy",
      id: id as string,
      offset,
      pageSize,
    });
    const rawList = res?.songs || [];
    return rawList.map((i: any) => convertor.WY.convertPlaylistSong(i));
  }

  const res: any = await getPlaylistTracks({
    source: "kg",
    id: id as string,
    offset,
    pageSize,
  });
  const rawList = res?.data.info || [];
  page.value.total = res?.data.count || page.value.total;
  return rawList.map((i: any) => convertor.KG.convertKGPlaylistSong(i));
};

const appendUniqueSongs = (songs: Song[]) => {
  const songKeys = new Set(allSong.value.map((song) => `${song.source}:${song.id}`));
  const newSongs = songs.filter((song) => {
    const key = `${song.source}:${song.id}`;
    if (songKeys.has(key)) return false;
    songKeys.add(key);
    return true;
  });

  if (newSongs.length) {
    allSong.value = [...allSong.value, ...newSongs];
  }
};

const handlePlay = async (item?: Song) => {
  if (item) {
    playbackCommands.playSongFromList(allSong.value, item);
    return;
  }
  // 等待播放列表加载完成
  let timer: any;
  if (allLoading.value) {
    message.success("正在加载全部歌曲...");
  }
  timer = setInterval(() => {
    if (!allLoading.value) {
      clearInterval(timer);
      if (!item) {
        songList.value = allSong.value;
        playbackCommands.playAll(allSong.value);
      }
    }
  }, 300);
};

const playAll = async () => {
  if (!allLoading.value && allSong.value.length < page.value.total) {
    await loadAll();
  }
  songList.value = allSong.value;
  handlePlay();
};

const loadAll = async () => {
  if (allLoading.value) return;
  const currentVersion = loadVersion.value;
  allLoading.value = true;
  try {
    let offset = INITIAL_PAGE_SIZE;
    while (offset < page.value.total && currentVersion === loadVersion.value) {
      const pageSize = Math.min(BACKGROUND_PAGE_SIZE, page.value.total - offset);
      const songs = await fetchPlaylistSongs(offset, pageSize);
      if (!songs.length) break;
      appendUniqueSongs(songs);
      offset += pageSize;
    }
  } catch (error) {
    console.log("后台加载歌单歌曲失败：" + error);
  } finally {
    if (currentVersion === loadVersion.value) {
      allLoading.value = false;
    }
  }
};

const initData = debounce(async () => {
  loadVersion.value += 1;
  id = route.query.id;
  allLoading.value = false;
  allSong.value = [];
  songList.value = [];
  localSongCache.value = [];
  page.value.currentPage = 1;
  page.value.size = INITIAL_PAGE_SIZE;
  page.value.total = 0;
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
  let loadedCount = songList.value.length;

  const loadNextChunk = () => {
    if (loadedCount >= allSong.value.length) return;

    const remaining = allSong.value.length - loadedCount;
    const currentChunkSize = Math.min(VISIBLE_CHUNK_SIZE, remaining);
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
  () => [route.query.id, route.query.origin],
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
        transition: all 0.3s ease-in-out;

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
