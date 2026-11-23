<template>
  <div ref="settingScrollRef" class="setting-page-root">
    <n-tabs
      v-model:value="activeName"
      type="line"
      :animated="themeStore.pageTransitionEnabled">
      <n-tab-pane
        v-for="item in settingTabItems"
        :key="item.name"
        :name="item.name"
        :tab="item.tab">
        <component :is="item.component" />
        <div class="tab-bottom-spacer" aria-hidden="true" />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import {
  AboutSetting,
  AnnouncementSetting,
  AdvanceSetting,
  BasicSetting,
  LocalSetting,
  LyricSetting,
  ShortcutSetting,
  SyncSetting,
} from "@/components/setting";
import { ref, watch, type Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useKeepAliveScroll } from "@/composables/useKeepAliveScroll";
import { useThemeStore } from "@/store/theme";

defineOptions({ name: "SettingView" });

type SettingTab = "basic" | "local" | "sync" | "lyric" | "shortcut" | "advance" | "about" | "announcements";

const settingTabItems: ReadonlyArray<{ name: SettingTab; tab: string; component: Component }> = [
  { name: "basic", tab: "基本设置", component: BasicSetting },
  { name: "local", tab: "本地设置", component: LocalSetting },
  { name: "sync", tab: "同步设置", component: SyncSetting },
  { name: "lyric", tab: "歌词设置", component: LyricSetting },
  { name: "shortcut", tab: "快捷键设置", component: ShortcutSetting },
  { name: "advance", tab: "高级设置", component: AdvanceSetting },
  { name: "about", tab: "关于", component: AboutSetting },
  { name: "announcements", tab: "公告", component: AnnouncementSetting },
];

const SETTING_TABS = new Set<SettingTab>(settingTabItems.map((item) => item.name));

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const settingScrollRef = ref<HTMLElement | null>(null);
useKeepAliveScroll(settingScrollRef);
const activeName = ref<SettingTab>(resolveSettingTab(route.query.tab));

watch(
  () => route.query.tab,
  (tab) => {
    if (route.path !== "/setting") return;
    activeName.value = resolveSettingTab(tab);
  }
);

watch(activeName, (tab) => {
  if (route.path !== "/setting") return;
  if (resolveSettingTab(route.query.tab) === tab && route.query.tab === tab) return;
  const query = { ...route.query, tab: tab === "basic" ? undefined : tab };
  void router.replace({ path: "/setting", query });
});

function resolveSettingTab(value: unknown): SettingTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return typeof tab === "string" && SETTING_TABS.has(tab as SettingTab)
    ? tab as SettingTab
    : "basic";
}
</script>

<style lang="scss" scoped>
.setting-page-root {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
}

:deep(.n-tabs) {
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:deep(.n-tabs-nav) {
  flex-shrink: 0;
  margin-bottom: 12px;
}

:deep(.n-tabs-pane-wrapper) {
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

:deep(.n-tabs-pane-wrapper > div) {
  height: 100%;
  min-height: 0;
}

:deep(.n-tabs .n-tabs-pane-wrapper .n-tab-pane) {
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow-y: auto;
  padding-right: 12px;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
}

.tab-bottom-spacer {
  height: 16px;
  flex-shrink: 0;
}

:deep(*::-webkit-scrollbar) {
  display: none;
  width: 0;
  height: 0;
}

:deep(*) {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
</style>
