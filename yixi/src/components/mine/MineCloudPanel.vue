<template>
  <div class="mine-cloud-panel">
    <div class="toolbar">
      <div class="toolbar-left">
        <BatchSegmentedActions
          always-show-label
          aria-label="云盘操作"
          :actions="toolbarActions"
          @action="handleToolbarAction"
        />
      </div>
      <ExpandableSearchInput v-model:value="searchKey" placeholder="搜索云盘歌曲" />
    </div>

    <div class="panel-content">
      <SongList
        v-if="filteredSongs.length || store.cloudRefreshing"
        :songs="filteredSongs"
        :loading="store.cloudRefreshing && !filteredSongs.length"
        :search-key="searchKey"
        :min-size="64"
        show-header
        show-footer
        @scroll="emit('scroll', $event)"
        @scroll-to-top="emit('scrollToTop', $event)"
      />
      <n-empty v-else class="empty-state" :description="store.cloudError || '暂无 WY 云盘歌曲'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NEmpty } from "naive-ui";
import { Play, RefreshCw } from "lucide-vue-next";
import { useMineLibraryStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import BatchSegmentedActions, {
  type SegmentedActionItem,
} from "@/components/batch/BatchSegmentedActions.vue";
import ExpandableSearchInput from "@/components/common/ExpandableSearchInput.vue";
import SongList from "@/components/list/SongList.vue";

const store = useMineLibraryStore();
const playbackCommands = usePlaybackCommands();
const searchKey = ref("");

const emit = defineEmits<{
  scroll: [event: Event];
  scrollToTop: [event: Event];
  expandHeader: [];
}>();

const filteredSongs = computed(() => {
  const keyword = searchKey.value.trim().toLowerCase();
  if (!keyword) return store.wyCloudSongs;
  return store.wyCloudSongs.filter((song) =>
    [song.name, song.singer, song.album]
      .filter(Boolean)
      .some((val) => val.toLowerCase().includes(keyword))
  );
});

const toolbarActions = computed<SegmentedActionItem[]>(() => [
  {
    key: "playAll",
    label: "播放全部",
    icon: Play,
    primary: true,
    disabled: !filteredSongs.value.length || store.cloudRefreshing,
  },
  {
    key: "refresh",
    label: "刷新",
    icon: RefreshCw,
    loading: store.cloudRefreshing,
    spinIcon: true,
  },
]);

function handleToolbarAction(key: string) {
  if (key === "playAll") {
    if (filteredSongs.value.length) playbackCommands.playAll(filteredSongs.value);
  } else if (key === "refresh") {
    void store.refreshCloudSongs(true);
  }
}

watch(searchKey, () => emit("expandHeader"));
</script>

<style scoped lang="scss">
.mine-cloud-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.empty-state {
  height: 100%;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
