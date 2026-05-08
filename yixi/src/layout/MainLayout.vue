<template>
  <n-space vertical>
    <n-layout has-sider class="app-shell">
      <n-layout-sider
        class="app-sider"
        bordered
        collapse-mode="width"
        :collapsed-width="72"
        :width="216"
        :collapsed="collapsed"
        show-trigger
        @collapse="collapsed = true"
        @expand="collapsed = false">
        <div class="brand-container" :class="{ collapsed }">
          <n-image :src="logo" preview-disabled class="brand-logo" />
          <span v-if="!collapsed" class="brand-title">PisaMusic</span>
        </div>
        <n-menu
          v-model:value="activeTab"
          :collapsed="collapsed"
          :collapsed-width="72"
          :collapsed-icon-size="22"
          :options="menuOptions"
          @update:value="handleChangeMenu" />
      </n-layout-sider>
      <n-layout>
        <div class="right-content">
          <Header class="header" />
          <div class="content">
            <router-view />
          </div>
        </div>
      </n-layout>
    </n-layout>
  </n-space>
</template>

<script setup lang="ts">
import { computed, h, ref, watch, type Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NIcon, NImage, NLayout, NLayoutSider, NMenu, NSpace, type MenuOption } from "naive-ui";
import {
  Download,
  Heart,
  Home,
  ListMusic,
  Settings,
  UserRound,
  Wrench,
} from "lucide-vue-next";
import { Header } from "../components";
import logo from "@/assets/pisamusic_icon_1024.png";

const router = useRouter();
const route = useRoute();
const collapsed = ref(false);

const routeToMenuKey = (path: string) => {
  if (path.startsWith("/playlist")) return "playlist";
  if (path.startsWith("/favorite")) return "favorite";
  if (path.startsWith("/mine")) return "mine";
  if (path.startsWith("/local-download")) return "local-download";
  if (path.startsWith("/setting")) return "setting";
  if (path.startsWith("/debugger")) return "debugger";
  return "home";
};

const activeTab = ref(routeToMenuKey(route.path));

const menuOptions = computed<MenuOption[]>(() => {
  const items: MenuOption[] = [
    { label: "首页", key: "home", icon: renderMenuIcon(Home) },
    { label: "歌单", key: "playlist", icon: renderMenuIcon(ListMusic) },
    { label: "收藏", key: "favorite", icon: renderMenuIcon(Heart) },
    { label: "我的", key: "mine", icon: renderMenuIcon(UserRound) },
    { label: "本地与下载", key: "local-download", icon: renderMenuIcon(Download) },
    { label: "设置", key: "setting", icon: renderMenuIcon(Settings) },
  ];

  if (process.env.NODE_ENV === "development") {
    items.push({ label: "dev page", key: "debugger", icon: renderMenuIcon(Wrench) });
  }

  return items;
});

watch(
  () => route.path,
  (path) => {
    activeTab.value = routeToMenuKey(path);
  },
  { immediate: true }
);

function handleChangeMenu(key: string) {
  const pathMap: Record<string, string> = {
    home: "/",
    playlist: "/playlist",
    favorite: "/favorite",
    mine: "/mine",
    "local-download": "/local-download",
    setting: "/setting",
    debugger: "/debugger",
  };
  router.push(pathMap[key] || "/");
}

function renderMenuIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) });
}
</script>

<style lang="scss" scoped>
.app-shell {
  height: 100vh;
  padding-bottom: 80px;
  background: var(--color-bg-track);
}

.app-sider {
  margin: 1rem;
  background: transparent;
}

.right-content {
  height: calc(100vh - 80px);
  background: var(--color-bg-track);

  .header {
    display: flex;
    width: 100%;
  }

  .content {
    display: flex;
    height: calc(100% - 80px);
    overflow-y: overlay;
    padding: 1rem 1.5rem 1rem 1rem;
    background: transparent;
  }
}

.brand-container {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
  height: 72px;
  padding: 0 20px;
  -webkit-app-region: drag;

  &.collapsed {
    justify-content: center;
    padding: 0;
  }

  .brand-logo {
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
    border-radius: 12px;
    transition: all 0.3s ease-in-out;
  }

  .brand-title {
    color: #2f343d;
    font-size: 24px;
    font-weight: 800;
    line-height: 1;
    white-space: nowrap;
    letter-spacing: 0;
  }
}
</style>
