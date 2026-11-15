<template>
  <div class="play-list-detail-layout" v-if="!loading && listDetail">
    <div class="detail-header" :style="{ height: isMini ? '120px' : '220px' }">
      <div class="detail-header-left" :style="{ width: isMini ? '100px' : '200px' }">
        <div class="detail-header-left-img" :style="{ width: isMini ? '100px' : '200px' }">
          <img :src="detailCover" alt="detailHeader" @error="playlistCoverFallback($event, listDetail)" />
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
          <div class="operate-btn batch-operation-toolbar">
            <div v-show="!batchMode">
              <n-button round type="primary" :loading="moreLoading" style="background-color: var(--color-primary)"
                @click="playAll">
                <template #icon>
                  <n-icon :component="PlayStatic"></n-icon>
                </template>
                播放全部({{ page.total }}首)
              </n-button>
              <n-button v-if="getDetailOrigin() !== 'local'" data-batch-trigger round secondary style="margin-left: 10px" @click="enterOnlineBatch">
                <template #icon><n-icon :component="SquarePen" /></template>多选
              </n-button>
              <n-button v-else round secondary style="margin-left: 10px" @click="collector.collectList(listDetail)">
                <template #icon><n-icon :component="collector.containsPlaylist(listDetail) ? HeartOff : Heart" /></template>
                {{ collector.containsPlaylist(listDetail) ? "取消收藏" : "收藏" }}
              </n-button>
              <n-dropdown trigger="click" :options="moreOptions" @select="handleMoreAction">
                <n-button round secondary style="margin-left: 10px">
                  <template #icon><n-icon :component="EllipsisVertical" /></template>
                  更多
                </n-button>
              </n-dropdown>
              <n-button v-if="listDetail?.source === 'local'" round secondary style="margin-left: 10px" @click="editDialogRef?.open(listDetail)"><template #icon><n-icon :component="SquarePen" /></template>编辑</n-button>
              <n-button v-if="listDetail?.source === 'local'" round secondary style="margin-left: 10px" @click="deleteCurrentPlaylist"><template #icon><n-icon :component="Trash2" /></template>删除</n-button>
            </div>

            <div ref="batchToolbarTarget" v-show="batchMode" class="detail-batch-target" />
            <n-input :style="{
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
      <SongList ref="songListRef" :batch-external="getDetailOrigin() !== 'local'" :batch-toolbar-target="getDetailOrigin() !== 'local' ? batchToolbarTarget : null" @batch-mode-change="batchMode = getDetailOrigin() !== 'local' && $event" :songs="songList" :loading="loading" :has-more="songList.length < page.total" :search-key="searchText"
        batch-enabled batch-context="playlist" :batch-snapshot-mode="getDetailOrigin() !== 'local'" :batch-removable="getDetailOrigin() === 'local'" :prepare-batch="prepareBatchSongs" @batch-remove="removeBatchSongs"
        show-footer show-header @scroll="onScroll" @scroll-to-bottom="onToBottom" />
    </div>
    <PlaylistEditDialog ref="editDialogRef" />
    <ShareDialog ref="shareDialogRef" />
    <OnlinePlaylistConversionDialog v-model:show="conversionVisible" :playlist="listDetail" />
  </div>
  <!-- 骨架屏 -->
  <div class="play-list-detail-layout" v-else-if="loading">
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
  <n-empty v-else :description="loadError || '歌单暂不可用'" />
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import {
  NButton,
  NDropdown,
  NInput,
  NTooltip,
  NText,
  NTag,
  NSkeleton,
  NEmpty,
  useMessage,
} from "naive-ui";
import { computed, h, onMounted, onUnmounted, ref, watch } from "vue";

import type { KGPlaylistDetailData } from "@/utils/webapi";
import { debounce, getSongCover } from "@/utils/common";
import SearchIcon from "@/icons/header/SearchIcon.vue";
import { PlayStatic } from "@/icons";
import { useAudioStore, useCollectStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { convertor } from "@/utils/convertor";
import type { CommonPlaylist, Song } from "@/types/song";
import type { WYPlaylistDetail } from "@/utils/webapi";
import { getPlaylistDetail, getPlaylistTracks } from "@/utils/api/musicAPI";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";
import { listMinePlaylistSongs, listMinePlaylists } from "@/utils/api/mineLibraryAPI";
import PlaylistEditDialog from "@/components/mine/PlaylistEditDialog.vue";
import { usePlaylistManagement } from "@/composables/usePlaylistManagement";
import { getPlaylistCover, playlistCoverFallback } from "@/playlist/playlistCover";
import defaultPlaylistCover from "@/assets/images/default-created-playlist-cover.svg";
import { EllipsisVertical, FolderInput, Info, Share2, SquarePen, Trash2, Heart, HeartOff } from "lucide-vue-next";
import ShareDialog from "@/components/common/ShareDialog.vue";
import OnlinePlaylistConversionDialog from "./OnlinePlaylistConversionDialog.vue";
import { loadOnlinePlaylist } from "@/playlist/onlinePlaylistBatchLoader";
import { openPlaylistDetail } from "@/share/mediaDetailRoute";

import { useBatchToolbarMorph } from "@/composables/useBatchToolbarMorph";
import SongList from "@/components/list/SongList.vue";
import { resolveDynamicBatchSize } from "@/utils/playlistTracks";

type DetailOrigin = "kg" | "wy" | "local";

const playbackCommands = usePlaybackCommands();
const collector = useCollectStore();
const audio = useAudioStore();
const isPlayingAllFromHere = ref(false);
const message = useMessage();
const route = useRoute();
const router = useRouter();
const searchText = ref("");
const songListRef = ref<InstanceType<typeof SongList> | null>(null);
const batchToolbarTarget = ref<HTMLElement | null>(null);
const batchMode = ref(false);
const batchMorph = useBatchToolbarMorph(batchMode, batchToolbarTarget);
function enterOnlineBatch(event: MouseEvent) { batchMorph.captureOrigin(event); void songListRef.value?.enterBatch(); }
watch(() => [route.query.id, route.query.origin], () => { batchMorph.reset(); batchMode.value = false; songListRef.value?.exitBatch(); });
const conversionVisible = ref(false);
const searchFocus = ref(false);
const loading = ref(false);
const loadError = ref("");
const moreLoading = ref(false);
const allLoading = ref(false);
const kgListDetail = ref<KGPlaylistDetailData>();
const wyListDetail = ref<WYPlaylistDetail>();

const listDetail = ref<CommonPlaylist>();
const editDialogRef = ref<InstanceType<typeof PlaylistEditDialog> | null>(null);
const { confirmDelete } = usePlaylistManagement();
function deleteCurrentPlaylist() {
  const playlist = listDetail.value;
  if (playlist?.source === "local") void confirmDelete(playlist, () => {
    if (getDetailOrigin() !== "local" || String(route.query.id) !== playlist.id) return;
    loadVersion.value++; listDetail.value = undefined; songList.value = []; allSong.value = []; localSongCache.value = [];
    void router.replace("/mine");
  });
}

const shareDialogRef = ref<InstanceType<typeof ShareDialog> | null>(null);
async function prepareBatchSongs(signal?: AbortSignal): Promise<Song[]> {
  const request = captureDetailRequest();
  const revision = await captureLibraryRevision();
  const songs = request.origin === "local" ? await listMinePlaylistSongs(request.id)
    : (await loadOnlinePlaylist(request.origin, request.id, { signal })).songs;
  if (signal?.aborted || !isCurrentDetailRequest(request) || !isCurrentLibraryRevision(revision)) throw new Error("歌单或账号已变化，已停止读取");
  if (request.origin === "local") { localSongCache.value = songs; allSong.value = songs; songList.value = songs; page.value.total = songs.length; }
  return songs;
}
async function removeBatchSongs(songs: Song[]) {
  const request = captureDetailRequest();
  if (request.origin !== "local" || !songs.length) return;
  const revision = await captureLibraryRevision();
  const keys = songs.map(song => ({ source: song.source, id: song.id }));
  window.$dialog.warning({ title: "移除所选歌曲？", content: `从当前自建歌单移除 ${keys.length} 首歌曲，不删除音频文件。`, positiveText: "移除", negativeText: "取消", onPositiveClick: async () => {
    if (!isCurrentDetailRequest(request) || !isCurrentLibraryRevision(revision)) return false;
    try {
      const payload = { playlistId: request.id, keys, identityRevision: revision };
      const result = await window.electronAPI.bulkRemoveUserPlaylistTracks(payload);
      if (!isCurrentDetailRequest(request) || !isCurrentLibraryRevision(revision)) return;
      const remaining = await listMinePlaylistSongs(request.id);
      if (!isCurrentDetailRequest(request)) return;
      localSongCache.value = remaining; allSong.value = remaining; songList.value = remaining; page.value.total = remaining.length;
      window.$message.success(`已移除 ${result.removed.length} 首`);
    } catch (error) { if (isCurrentDetailRequest(request)) window.$message.error(error instanceof Error ? error.message : "移除失败"); return false; }
  } });
}
const detailCover = computed(() => {
  const origin = getDetailOrigin();
  if (origin === "local") {
    return getPlaylistCover(listDetail.value, 720);
  }
  return listDetail.value ? getSongCover(listDetail.value, 720, defaultPlaylistCover) : defaultPlaylistCover;
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
const VISIBLE_CHUNK_SIZE = 60;
const page = ref({
  currentPage: 1,
  size: 50,
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

type DetailRequest = { version: number; id: string; origin: DetailOrigin };
const captureDetailRequest = (): DetailRequest => ({ version: loadVersion.value, id: String(route.query.id || ""), origin: getDetailOrigin() });
const isCurrentDetailRequest = (request: DetailRequest) => request.version === loadVersion.value && request.id === route.query.id && request.origin === getDetailOrigin();

const getListDetail = async (request: DetailRequest) => {
  const { origin, id } = request;
  if (origin === "local") {
    const playlists = await listMinePlaylists("local");
    if (!isCurrentDetailRequest(request)) return;
    const playlist = playlists.find((item) => item.id === id);
    if (!playlist) throw new Error("自建歌单不存在");
    const songs = await listMinePlaylistSongs(id);
    if (!isCurrentDetailRequest(request)) return;
    listDetail.value = playlist;
    localSongCache.value = songs;
    page.value.total = localSongCache.value.length;
    return;
  }

  if (origin == "wy") {
    const res: any = await getPlaylistDetail({
      source: "wy",
      id: id as string,
    });
    if (!isCurrentDetailRequest(request)) return;
    if (String(res?.playlist?.id) !== id) throw new Error("歌单不存在或身份不匹配");
    wyListDetail.value = res?.playlist;
    page.value.total = res?.playlist.trackCount!!;
  } else {
    const res: any = await getPlaylistDetail({
      source: "kg",
      id: id as string,
    });
    if (!isCurrentDetailRequest(request)) return;
    if (String(res?.data?.[0]?.global_collection_id) !== id) throw new Error("歌单不存在或身份不匹配");
    kgListDetail.value = res?.data[0];
    page.value.total = kgListDetail.value?.count || 0;
  }
  convertDetail(origin);
};

const getSongList = async (batchSize: number, request: DetailRequest) => {
  const initialSongs = await fetchPlaylistSongs(0, batchSize, request);
  if (!isCurrentDetailRequest(request)) return;
  songList.value = initialSongs;
  allSong.value = initialSongs;
};

const fetchPlaylistSongs = async (offset: number, pageSize: number, request = captureDetailRequest()): Promise<Song[]> => {
  const { origin, id } = request;
  if (origin === "local") {
    if (!localSongCache.value.length) {
      const songs = await listMinePlaylistSongs(id);
      if (!isCurrentDetailRequest(request)) return [];
      localSongCache.value = songs;
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
    if (!isCurrentDetailRequest(request)) return [];
    const rawList = res?.songs || [];
    return rawList.map((i: any) => convertor.WY.convertPlaylistSong(i));
  }

  const res: any = await getPlaylistTracks({
    source: "kg",
    id: id as string,
    offset,
    pageSize,
  });
  if (!isCurrentDetailRequest(request)) return [];
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
    songList.value = allSong.value;

    // 若当前正在播放此歌单，静默补全播放队列
    if (isPlayingAllFromHere.value && audio.currentSong) {
      const isCurrentInList = allSong.value.some(
        (s) => s.source === audio.currentSong?.source && String(s.id) === String(audio.currentSong?.id)
      );
      if (isCurrentInList) {
        void audio.setPlaylist(newSongs);
      }
    }
  }
};

const playAll = async () => {
  if (allSong.value.length === 0) {
    if (loading.value) {
      message.info("正在加载歌单歌曲，请稍候...");
      return;
    }
    if (page.value.total === 0) {
      message.info("歌单中暂无歌曲");
      return;
    }
  }

  isPlayingAllFromHere.value = true;
  songList.value = allSong.value;
  void playbackCommands.playAll(allSong.value);

  if (!allLoading.value && allSong.value.length < page.value.total) {
    void loadAll(page.value.size);
  }
};

function openDetailPage() {
  if (!listDetail.value) return;
  void openPlaylistDetail(router, listDetail.value);
}

const moreOptions = computed(() => [
  ...(getDetailOrigin() !== "local" ? [{ label: (listDetail.value && collector.containsPlaylist(listDetail.value)) ? "取消收藏" : "收藏", key: "collect", icon: () => h((listDetail.value && collector.containsPlaylist(listDetail.value)) ? HeartOff : Heart, { size: 16 }) }] : []),
  ...(["kg", "wy"].includes(listDetail.value?.source || "")
    ? [{ label: "转为本地歌单", key: "convert", icon: () => h(FolderInput, { size: 16 }) }] : []),
  { label: "详情", key: "detail", icon: () => h(Info, { size: 16 }) },
  { label: "分享", key: "share", icon: () => h(Share2, { size: 16 }) },
]);

function handleMoreAction(key: string) {
  if (key === "collect" && listDetail.value) void collector.collectList(listDetail.value);
  else if (key === "convert") conversionVisible.value = true;
  else if (key === "detail") openDetailPage();
  else if (key === "share") openShareDialog();
}

function openShareDialog() {
  if (!listDetail.value) return;
  shareDialogRef.value?.openForPlaylist(listDetail.value);
}

const loadAll = async (batchSize: number = page.value.size) => {
  if (allLoading.value) return;
  const currentVersion = loadVersion.value;
  allLoading.value = true;
  try {
    let offset = allSong.value.length;
    while (offset < page.value.total && currentVersion === loadVersion.value) {
      const songs = await fetchPlaylistSongs(offset, batchSize);
      if (!songs.length || currentVersion !== loadVersion.value) break;
      appendUniqueSongs(songs);
      offset += batchSize;
      if (songs.length < batchSize) break;
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
  batchMode.value = false;
  songListRef.value?.exitBatch();
  loadVersion.value += 1;
  const request = captureDetailRequest();
  const revision = await captureLibraryRevision();
  if (!isCurrentDetailRequest(request)) return;
  try {
    listDetail.value = undefined;
    kgListDetail.value = undefined;
    wyListDetail.value = undefined;
    loadError.value = "";
    isPlayingAllFromHere.value = false;
    allLoading.value = false;
    allSong.value = [];
    songList.value = [];
    localSongCache.value = [];
    page.value.currentPage = 1;
    page.value.size = 50;
    page.value.total = 0;
    await getListDetail(request);
    if (!isCurrentDetailRequest(request)) return;
    const batchSize = resolveDynamicBatchSize(page.value.total);
    page.value.size = batchSize;
    await getSongList(batchSize, request);
    if (!isCurrentDetailRequest(request)) return;
    loading.value = false;
    if (page.value.total > allSong.value.length) {
      setTimeout(() => { if (isCurrentDetailRequest(request)) void loadAll(batchSize); }, 100);
    }
  } catch (error) {
    if ((request.origin === "local" && !isCurrentLibraryRevision(revision)) || !isCurrentDetailRequest(request)) return;
    listDetail.value = undefined;
    loadError.value = error instanceof Error ? error.message : "读取歌单失败";
    loading.value = false;
    window.$message.error(error instanceof Error ? error.message : "读取歌单失败");
    void window.electronAPI.reportError(error, { scope: "playlist-detail", action: "load" });
  }
}, 300);

const stopIdentityListener = onLibraryIdentityChanged(() => {
  if (getDetailOrigin() !== "local") return;
  loadVersion.value++;
  listDetail.value = undefined;
  localSongCache.value = [];
  songList.value = [];
  allSong.value = [];
  page.value.total = 0;
  isPlayingAllFromHere.value = false;
  void router.replace("/mine");
});
let metadataGeneration = 0;
const stopPlaylistChanges = window.electronAPI.onMineLibraryChanged(async () => {
  if (getDetailOrigin() !== "local") return;
  const request = captureDetailRequest();
  const revision = await captureLibraryRevision();
  const generation = ++metadataGeneration;
  try {
    const playlists = await listMinePlaylists("local");
    if (generation !== metadataGeneration || !isCurrentLibraryRevision(revision) || !isCurrentDetailRequest(request)) return;
    const playlist = playlists.find(item => item.id === request.id);
    if (playlist) {
      const songs = await listMinePlaylistSongs(request.id);
      if (generation !== metadataGeneration || !isCurrentLibraryRevision(revision) || !isCurrentDetailRequest(request)) return;
      listDetail.value = playlist; localSongCache.value = songs; allSong.value = songs; songList.value = songs; page.value.total = songs.length;
    }
    else { loadVersion.value++; listDetail.value = undefined; songList.value = []; allSong.value = []; localSongCache.value = []; void router.replace("/mine"); }
  } catch { /* 保留当前详情；下次成功通知或重新进入时恢复。 */ }
});
onUnmounted(() => { loadVersion.value++; metadataGeneration++; stopIdentityListener(); stopPlaylistChanges(); });

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
    loadVersion.value++;
    listDetail.value = undefined;
    conversionVisible.value = false;
    loading.value = true;
    initData();
  }
);
</script>

<style scoped lang="scss">
.detail-batch-target { min-width: 0; flex: 1; max-height: 100px; overflow-y: auto; }
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
  background-color: var(--surface-control-active) !important;
  border-radius: var(--radius-control);
  box-shadow: var(--shadow-card);
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
      border-radius: var(--radius-control);
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
        color: var(--text-primary);
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
          color: var(--text-secondary);
          cursor: pointer;
        }

        .list-tag-time {
          height: 30%;
          display: flex;
          align-items: center;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .operate-btn {
          display: flex;
          gap: 10px;
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
