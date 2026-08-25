<template>
  <div class="setting-con">
    <n-tabs v-model:value="activeName" type="line" animated>
      <n-tab-pane name="basic" tab="基本设置">
        <BasicSetting></BasicSetting>
      </n-tab-pane>
      <n-tab-pane name="local" tab="本地设置">
        <LocalSetting></LocalSetting>
      </n-tab-pane>
      <n-tab-pane name="sync" tab="同步设置">
        <SyncSetting></SyncSetting>
      </n-tab-pane>
      <n-tab-pane name="lyric" tab="歌词设置">
        <LyricSetting></LyricSetting>
      </n-tab-pane>
      <n-tab-pane name="shortcut" tab="快捷键设置">
        <ShortcutSetting></ShortcutSetting>
      </n-tab-pane>
      <n-tab-pane name="advance" tab="高级设置">
        <AdvanceSetting></AdvanceSetting>
      </n-tab-pane>
      <n-tab-pane name="about" tab="关于">
        <AboutSetting></AboutSetting>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import {
  AboutSetting,
  AdvanceSetting,
  BasicSetting,
  LocalSetting,
  LyricSetting,
  ShortcutSetting,
  SyncSetting,
} from "@/components/setting";
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

type SettingTab = "basic" | "local" | "sync" | "lyric" | "shortcut" | "advance" | "about";

const SETTING_TABS = new Set<SettingTab>([
  "basic",
  "local",
  "sync",
  "lyric",
  "shortcut",
  "advance",
  "about",
]);

const route = useRoute();
const router = useRouter();
const activeName = ref<SettingTab>(resolveSettingTab(route.query.tab));

watch(
  () => route.query.tab,
  (tab) => {
    activeName.value = resolveSettingTab(tab);
  }
);

watch(activeName, (tab) => {
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
.setting-con {
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

:deep(.n-tab-pane) {
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow-y: auto;
  padding-right: 12px;
  padding-bottom: 40px;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
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
