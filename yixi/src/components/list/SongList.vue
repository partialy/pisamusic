<template>
  <Transition name="fade" mode="out-in">
    <div class="content-container" ref="contentConRef">
      <Teleport :to="batchToolbarTarget || 'body'" :disabled="!batchExternal || !batchToolbarTarget">
        <div v-if="batchEnabled && (!batchExternal || internalBatch || batchPreparing)" ref="batchToolbarRef" class="batch-toolbar">
          <n-button v-if="!batchExternal && !internalBatch && !batchPreparing" round secondary @click="enterInternalBatch">
            <template #icon><n-icon :component="SquarePen" /></template>多选
          </n-button>
          <n-button v-if="batchPreparing" round :disabled="batchDisabled" @click="exitInternalBatch()">
            <template #icon><n-icon :component="X" /></template>取消加载
          </n-button>
          <BatchActionBar v-if="internalBatch" ref="batchBarRef" :songs="selection.selectedSongs.value" :context="batchContext" :can-remove="batchRemovable"
            :refresh-loading="batchRefreshing" :disabled="batchDisabled"
            @select-all="selection.selectVisible(true)" @invert="selection.invertVisible" @exit="exitInternalBatch()"
            @busy="batchBusy = $event" @remove="emit('batchRemove', $event)" @refresh="emit('batchRefresh')" />
        </div>
      </Teleport>
      <VirtList
        v-if="!loading"
        ref="virtListRef"
        :buffer="2"
        :offset="offset"
        :min-size="minSize || 64"
        :list="renderSongs"
        :style="{ height: Math.max(0, height - (batchExternal && batchToolbarTarget ? 0 : batchToolbarHeight)) + 'px' , 'padding-right': '8px' }"
        @scroll="emit('scroll', $event)"
        @toBottom="emit('scrollToBottom', $event)"
        @toTop="emit('scrollToTop', $event)"
        item-key="listKey">
        <template #stickyHeader v-if="showHeader">
          <div class="song-list-header">
            <div class="index">
              <n-checkbox
                v-if="effectiveSelectable"
                :checked="allSelected"
                :indeterminate="isIndeterminate"
                @update:checked="selectAllVisible"
              />
              <span v-else>#</span>
            </div>
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
            :active="player.currentSong?.source === itemData.source && player.currentSong?.id == itemData.id"
            :selectable="effectiveSelectable"
            :selected="isSongSelected(itemData)"
            @play="handlePlay"
            @add="handleAddToPlaylist"
            @next-play="handleNextPlay"
            @toggle-select="toggleSelection"
            @contextmenu.stop="openRowContext($event, itemData)" />
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
            {{ (hasMore && !searchKey && !internalBatch) ? "正在加载中..." : "没有更多了~" }}
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
      <BatchActionMenu v-if="internalBatch" :show="batchMenu.show" :x="batchMenu.x" :y="batchMenu.y" :favorites="batchContext === 'favorites'" :removable="batchRemovable" :queue-disabled="listenTogether.enabled"
        @close="batchMenu.show = false" @action="batchBarRef?.perform($event)" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { NButton, NCheckbox, NIcon } from "naive-ui";
import { useAudioStore } from "@/store";
import { useListenTogetherStore } from "@/store/listenTogether";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from "vue";
import { SquarePen, X } from "lucide-vue-next";
import CommonSongItem from "@/components/search/CommonSongItem.vue";
import ContextMenu from "@/components/common/ContextMenu.vue";
import DownloadSongDialog from "@/components/player/DownloadSongDialog.vue";
import AddToPlaylistDialog from "@/components/player/AddToPlaylistDialog.vue";
import { VirtList } from "vue-virt-list";
import type { Song } from "@/types/song";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { useSongDownload } from "@/composables/useSongDownload";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { openSongDetail } from "@/share/mediaDetailRoute";
import BatchActionBar from "@/components/batch/BatchActionBar.vue";
import BatchActionMenu from "@/components/batch/BatchActionMenu.vue";
import { useBatchSelection } from "@/composables/useBatchSelection";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";
const player = useAudioStore();
const listenTogether = useListenTogetherStore();
const playbackCommands = usePlaybackCommands();
const songDownload = useSongDownload();
const router = useRouter();


const props = withDefaults(
  defineProps<{
    songs: Song[];
    loading?: boolean;
    minSize?: number;
    searchKey?: string;
    showHeader?: boolean;
    showFooter?: boolean;
    hasMore?: boolean;
    removable?: boolean;
    playMode?: "replace" | "append";
    selectable?: boolean;
    selectedKeys?: Set<string>;
    batchEnabled?: boolean;
    batchContext?: "songs" | "favorites" | "playlist" | "local" | "download";
    batchRemovable?: boolean;
    prepareBatch?: (signal?: AbortSignal) => Promise<Song[]>;
    batchSnapshotMode?: boolean;
    batchToolbarTarget?: HTMLElement | null;
    batchExternal?: boolean;
    batchRefreshing?: boolean;
    batchDisabled?: boolean;
  }>(),
  {
    playMode: "replace",
    selectable: false,
    batchEnabled: false,
  }
);

const emit = defineEmits<{
  scroll: [e: Event];
  scrollToBottom: [e: Event];
  scrollToTop: [e: Event];
  removeSong: [song: Song];
  toggleSelect: [song: Song, event?: MouseEvent];
  selectAll: [];
  batchRemove: [songs: Song[]];
  batchModeChange: [active: boolean];
  batchPreparingChange: [preparing: boolean];
  batchRefresh: [];
}>();

const internalBatch = ref(false), batchPreparing = ref(false), batchBusy = ref(false);
const batchMenu = ref({ show: false, x: 0, y: 0 });
const batchBarRef = useTemplateRef("batchBarRef");
const batchSongs = shallowRef<Song[] | null>(null);
const sourceSongs = computed(() => internalBatch.value && props.batchSnapshotMode && batchSongs.value ? batchSongs.value : props.songs);
const effectiveSelectable = computed(() => props.selectable || internalBatch.value);
let batchGeneration = 0;
let batchController: AbortController | undefined;

const filteredSongs = computed(() => {
  if (!props.searchKey) return sourceSongs.value;
  return sourceSongs.value.filter(
    (s) =>
      s.name.toLowerCase().includes(props.searchKey!!.toLowerCase()) ||
      s.singer.toLowerCase().includes(props.searchKey!!.toLowerCase()) ||
      s.album.toLowerCase().includes(props.searchKey!!.toLowerCase())
  );
});

const displaySongs = computed(() => {
  return props.searchKey ? filteredSongs.value : sourceSongs.value;
});
const renderSongs = computed(() => displaySongs.value.map(song => ({ ...song, listKey: `${song.source}:${song.id}` })));
const selection = useBatchSelection(sourceSongs, displaySongs);
const effectiveSelectedKeys = computed(() => props.selectable ? props.selectedKeys : selection.selectedKeys.value);
function toggleSelection(song: Song, event?: MouseEvent) {
  if (props.selectable) emit('toggleSelect', song, event);
  else if (!batchBusy.value && !props.batchDisabled) selection.toggle(song, event);
}
function selectAllVisible() {
  if (props.selectable) emit('selectAll');
  else if (!batchBusy.value && !props.batchDisabled) selection.selectVisible(!allSelected.value);
}
async function enterInternalBatch() {
  if (internalBatch.value || batchPreparing.value || props.batchDisabled || !props.batchEnabled) return;
  const generation = ++batchGeneration;
  batchController = new AbortController();
  batchPreparing.value = true;
  try {
    const revision = await captureLibraryRevision();
    const complete = props.prepareBatch ? await props.prepareBatch(batchController.signal) : null;
    if (generation !== batchGeneration || !isCurrentLibraryRevision(revision)) return;
    batchSongs.value = complete;
    selection.clear();
    internalBatch.value = true;
  } catch (error) { if (generation === batchGeneration) window.$message.error(error instanceof Error ? error.message : '无法读取完整列表'); }
  finally { if (generation === batchGeneration) batchPreparing.value = false; }
}
function exitInternalBatch(force = false) {
  if (!force && (batchBusy.value || props.batchDisabled)) return;
  batchGeneration++;
  batchController?.abort();
  internalBatch.value = false;
  batchPreparing.value = false;
  batchSongs.value = null;
  selection.clear();
  batchMenu.value.show = false;
}
function openRowContext(event: MouseEvent, song: Song) {
  event.preventDefault();
  if (internalBatch.value) {
    if (batchBusy.value || props.batchDisabled) return;
    selection.selectForContext(song);
    batchMenu.value = { show: true, x: event.clientX, y: event.clientY };
  } else contextMenuRef.value?.openContextMenu(event, { type: 'song', data: song });
}
const stopBatchIdentity = onLibraryIdentityChanged(() => { batchBusy.value = false; exitInternalBatch(true); });
watch(() => internalBatch.value || batchPreparing.value, value => emit("batchModeChange", value), { flush: "sync" });
watch(batchPreparing, value => emit("batchPreparingChange", value), { flush: "sync" });
watch(sourceSongs, songs => {
  const available = new Set(songs.map(song => `${song.source}:${song.id}`));
  const retained = new Set([...selection.selectedKeys.value].filter(key => available.has(key)));
  if (retained.size !== selection.selectedKeys.value.size) selection.selectedKeys.value = retained;
});


const isSongSelected = (song: Song) => {
  return effectiveSelectedKeys.value?.has(`${song.source}:${song.id}`) ?? false;
};

const selectedCountInView = computed(() => {
  if (!effectiveSelectedKeys.value || !effectiveSelectable.value) return 0;
  return displaySongs.value.filter(isSongSelected).length;
});

const allSelected = computed(() => {
  if (!displaySongs.value.length || !effectiveSelectable.value) return false;
  return selectedCountInView.value === displaySongs.value.length;
});

const isIndeterminate = computed(() => {
  if (!displaySongs.value.length || !effectiveSelectable.value) return false;
  return (
    selectedCountInView.value > 0 &&
    selectedCountInView.value < displaySongs.value.length
  );
});

const height = ref(0);
const batchToolbarHeight = ref(0);
const batchToolbarRef = useTemplateRef("batchToolbarRef");
const contentConRef = useTemplateRef("contentConRef");
const virtListRef = useTemplateRef("virtListRef");
const contextMenuRef = useTemplateRef("contextMenuRef");
const addToPlaylistDialogRef = useTemplateRef("addToPlaylistDialogRef");

const offset = ref(0);
const observer = new ResizeObserver((entries) => {
  for (let entry of entries) {
    const { height: val } = entry.contentRect;
    if (entry.target === batchToolbarRef.value) batchToolbarHeight.value = val;
    else height.value = val;
  }
});

watch(batchToolbarRef, (element, previous) => {
  if (previous) observer.unobserve(previous);
  if (element) observer.observe(element);
  else batchToolbarHeight.value = 0;
}, { flush: "post" });

const handlePlay = (song: Song) => {
  if (props.playMode === "append") {
    playbackCommands.playSongAppend(song);
  } else {
    playbackCommands.playSongFromList(props.songs, song);
  }
};

const handleNextPlay = (song: Song) => {
  playbackCommands.playNext(song);
};

const handleDownloadSong = (song: Song) => {
  songDownload.openDownloadDialog(song);
};

const handleAddToPlaylist = (song: Song) => {
  addToPlaylistDialogRef.value?.open(song);
};

const handleDetailSong = (song: Song) => {
  void openSongDetail(router, song);
};

onMounted(() => {
  contentConRef.value && observer.observe(contentConRef.value);
  batchToolbarRef.value && observer.observe(batchToolbarRef.value);
  if (offset.value > 0) {
    virtListRef.value?.scrollToIndex(offset.value);
  }
});

onBeforeRouteLeave(() => {
  exitInternalBatch(true);
  offset.value = virtListRef.value?.getOffset() || 0;
});

onBeforeUnmount(() => {
  exitInternalBatch(true);
  batchGeneration++;
  batchController?.abort();
  stopBatchIdentity();
  observer.disconnect();
});

defineExpose({ enterBatch: enterInternalBatch, exitBatch: () => exitInternalBatch() });
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
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-control);
    background: var(--surface-skeleton);
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
    background: var(--surface-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-control);
    padding: 0 1rem;
    margin-bottom: 6px;
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);

    .index,
    .img-con,
    .info,
    .collect,
    .album,
    .time {
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-secondary);
      font-weight: 600;
    }

    .index {
      width: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
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
