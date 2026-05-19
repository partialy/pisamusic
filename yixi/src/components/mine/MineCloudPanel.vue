<template>
  <div class="mine-cloud-panel">
    <div class="toolbar">
      <n-tabs v-model:value="activeSource" type="segment" size="small" class="source-tabs">
        <n-tab-pane name="all" tab="全部" />
        <n-tab-pane name="private" tab="私人" />
        <n-tab-pane name="kg" tab="KG" />
        <n-tab-pane name="wy" tab="WY" />
      </n-tabs>
      <n-button secondary round :loading="store.cloudRefreshing" @click="store.refreshCloudSongs(true)">
        <template #icon>
          <n-icon :component="RefreshCw" />
        </template>
        刷新
      </n-button>
    </div>

    <SongList
      v-if="filteredSongs.length || store.cloudRefreshing"
      :songs="filteredSongs"
      :loading="store.cloudRefreshing && !filteredSongs.length"
      :min-size="64"
      show-header
      show-footer
      @scroll="emit('scroll', $event)"
      @scroll-to-top="emit('scrollToTop', $event)" />
    <n-empty v-else class="empty-state" :description="emptyDescription" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NEmpty, NIcon, NTabPane, NTabs } from "naive-ui";
import { RefreshCw } from "lucide-vue-next";
import { useMineLibraryStore } from "@/store";
import SongList from "@/components/list/SongList.vue";
import type { MineCloudSource } from "@/utils/api/mineLibraryAPI";

const store = useMineLibraryStore();
const activeSource = ref<MineCloudSource>("all");
const emit = defineEmits<{
  scroll: [event: Event];
  scrollToTop: [event: Event];
}>();
const filteredSongs = computed(() => store.getCloudSongsBySource(activeSource.value));
const emptyDescription = computed(() => {
  if (activeSource.value === "private") return "私人云盘后续接入";
  if (activeSource.value === "kg") return "KG 云盘后续接入";
  return store.cloudError || "暂无云盘歌曲";
});
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

.source-tabs {
  width: 360px;
}

.empty-state {
  flex: 1;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
