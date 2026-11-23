<template>
  <div class="mine-page">
    <div class="mine-header" :class="{ collapsed: isHeaderCollapsed }">
      <h1>我的</h1>
      <div class="mine-tabs">
        <button
          v-for="item in tabs"
          :key="item.key"
          class="tab-btn"
          :class="{ active: activeTab === item.key }"
          @click="switchMineTab(item.key)"
        >
          {{ item.label }}
          <span>{{ item.meta }}</span>
        </button>
      </div>
    </div>

    <div class="mine-content" @wheel.passive="handleScrollableContentWheel">
      <Transition :name="tabTransitionName" mode="out-in">
        <MineLocalSongsPanel
          v-if="activeTab === 'local'"
          @scroll="handleScrollableContentScroll"
          @scroll-to-top="handleScrollableContentTop"
          @wheel="handleScrollableContentWheel"
          @expand-header="expandHeader"
        />
        <MinePlaylistPanel
          v-else-if="activeTab === 'playlist'"
          @scroll="handleScrollableContentScroll"
          @expand-header="expandHeader"
          @go-account="switchMineTab('account')"
        />
        <MineDownloadPanel
          v-else-if="activeTab === 'download'"
          @scroll="handleScrollableContentScroll"
          @scroll-to-top="handleScrollableContentTop"
          @wheel="handleScrollableContentWheel"
          @expand-header="expandHeader"
        />
        <MineCloudPanel
          v-else-if="activeTab === 'cloud' && accounts.wy.loggedIn"
          @scroll="handleScrollableContentScroll"
          @scroll-to-top="handleScrollableContentTop"
          @expand-header="expandHeader"
        />
        <MineAccountCards v-else />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import MineAccountCards from "@/components/mine/MineAccountCards.vue";
import MineCloudPanel from "@/components/mine/MineCloudPanel.vue";
import MineDownloadPanel from "@/components/mine/MineDownloadPanel.vue";
import MineLocalSongsPanel from "@/components/mine/MineLocalSongsPanel.vue";
import MinePlaylistPanel from "@/components/mine/MinePlaylistPanel.vue";
import { useCookieAccountStatus } from "@/composables/useCookieAccountStatus";
import { useCollapsiblePageHeader } from "@/composables/useCollapsiblePageHeader";
import { useLocalDownloadLibrary } from "@/composables/useLocalDownloadLibrary";
import { useMineLibraryStore } from "@/store";
import { useThemeStore } from "@/store/theme";
import { getPageTransitionMeta } from "@/theme/pageTransitionOptions";

defineOptions({ name: "MineView" });

type MineTab = "local" | "playlist" | "download" | "cloud" | "account";

const VALID_TABS = new Set<MineTab>([
  "local",
  "playlist",
  "download",
  "cloud",
  "account",
]);

const route = useRoute();
const router = useRouter();
const store = useMineLibraryStore();
const themeStore = useThemeStore();
const tabTransitionName = computed(
  () => getPageTransitionMeta(themeStore.pageTransition).transitionName || undefined,
);
const { accounts } = useCookieAccountStatus();
const { mergedLocalSongs, downloadedSongs } = useLocalDownloadLibrary({
  poll: false,
});

const {
  isHeaderCollapsed,
  expandHeader,
  handleScrollableContentScroll,
  handleScrollableContentTop,
  handleScrollableContentWheel,
} = useCollapsiblePageHeader();

function resolveMineTab(raw: unknown): MineTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === "string" && VALID_TABS.has(value as MineTab)) {
    if (value === "cloud" && !accounts.wy.loggedIn) return "local";
    return value as MineTab;
  }
  return "local";
}

const activeTab = ref<MineTab>(resolveMineTab(route.query.tab));

const tabs = computed(() => {
  const list: { key: MineTab; label: string; meta: string | number }[] = [
    { key: "local", label: "本地歌曲", meta: mergedLocalSongs.value.length },
    {
      key: "playlist",
      label: "歌单",
      meta: store.initialized ? store.playlists.length : store.playlists.length || "待加载",
    },
    { key: "download", label: "下载", meta: downloadedSongs.value.length },
  ];
  if (accounts.wy.loggedIn) {
    list.push({
      key: "cloud",
      label: "云盘",
      meta: store.wyCloudSongs.length || "待加载",
    });
  }
  list.push({ key: "account", label: "账号", meta: "2" });
  return list;
});

function switchMineTab(tab: MineTab) {
  if (tab === "cloud" && !accounts.wy.loggedIn) {
    tab = "local";
  }
  activeTab.value = tab;
  expandHeader();
  const nextQuery = {
    ...route.query,
    tab: tab === "local" ? undefined : tab,
  };
  void router.replace({ path: "/mine", query: nextQuery });
}

watch(
  () => route.query.tab,
  (tab) => {
    const resolved = resolveMineTab(tab);
    if (resolved !== activeTab.value) {
      activeTab.value = resolved;
      expandHeader();
    }
  }
);

watch(
  () => accounts.wy.loggedIn,
  (loggedIn) => {
    if (!loggedIn && activeTab.value === "cloud") {
      switchMineTab("local");
    }
  }
);
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
  max-height: 120px;
  overflow: hidden;
  opacity: 1;
  transform: translateY(0);
  transition:
    max-height 0.28s ease,
    opacity 0.2s ease,
    transform 0.28s ease;

  &.collapsed {
    max-height: 0;
    opacity: 0;
    transform: translateY(-10px);
    pointer-events: none;
  }

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
  gap: 36px;
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
