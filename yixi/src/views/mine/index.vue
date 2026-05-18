<template>
  <div class="mine-page">
    <div class="mine-header">
      <h1>我的</h1>
      <div class="mine-tabs">
        <button
          v-for="item in tabs"
          :key="item.key"
          class="tab-btn"
          :class="{ active: activeTab === item.key }"
          @click="activeTab = item.key">
          {{ item.label }}
          <span>{{ item.meta }}</span>
        </button>
      </div>
    </div>

    <div class="mine-content">
      <MinePlaylistPanel v-if="activeTab === 'playlist'" />
      <MineCloudPanel v-else-if="activeTab === 'cloud'" />
      <MineAccountCards v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MineAccountCards from "@/components/mine/MineAccountCards.vue";
import MineCloudPanel from "@/components/mine/MineCloudPanel.vue";
import MinePlaylistPanel from "@/components/mine/MinePlaylistPanel.vue";
import { useMineLibraryStore } from "@/store";

type MineTab = "playlist" | "cloud" | "account";

const store = useMineLibraryStore();
const activeTab = ref<MineTab>("playlist");
const tabs = computed(() => [
  { key: "playlist" as const, label: "歌单", meta: store.playlists.length || "待加载" },
  { key: "cloud" as const, label: "云盘", meta: store.cloudSongs.length || "待加载" },
  { key: "account" as const, label: "账号", meta: "2" },
]);
</script>

<style scoped lang="scss">
.mine-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--color-text-default);
}

.mine-header {
  h1 {
    margin: 0 0 22px;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 0;
  }
}

.mine-tabs {
  display: flex;
  align-items: center;
  gap: 48px;
  margin-bottom: 26px;
}

.tab-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 18px;
  cursor: pointer;
  transition: color 0.2s ease;

  span {
    margin-left: 4px;
    font-size: 14px;
  }

  &.active {
    color: var(--color-primary);
  }
}

.mine-content {
  flex: 1;
  min-height: 0;
}
</style>
