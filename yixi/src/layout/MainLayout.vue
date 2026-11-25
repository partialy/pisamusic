<template>
  <div class="main-layout-root">
    <n-space vertical class="layout-space">
      <n-layout has-sider class="app-shell">
        <n-layout-sider class="app-sider" bordered collapse-mode="width" :collapsed-width="88" :width="232"
          :collapsed="collapsed" show-trigger @collapse="collapsed = true" @expand="collapsed = false">
          <div class="brand-container" :class="{ collapsed }">
            <n-image :src="logo" preview-disabled class="brand-logo" />
            <span v-if="!collapsed" class="brand-title">PisaMusic</span>
          </div>
          <n-menu v-model:value="activeTab" :collapsed="collapsed" :collapsed-width="80" :collapsed-icon-size="20"
            :options="menuOptions" @update:value="handleChangeMenu" />
        </n-layout-sider>
        <n-layout class="app-main-layout">
          <div class="right-content">
            <Header class="header" @refresh="refreshContent" />
            <div ref="contentContainerRef" class="content">
              <router-view v-slot="{ Component }">
                <Transition :name="pageTransitionName" mode="out-in" @enter="handlePageEnter">
                  <KeepAlive :max="8" :exclude="NON_CACHED_VIEWS">
                    <component :is="Component" :key="getPageComponentKey()" />
                  </KeepAlive>
                </Transition>
              </router-view>
            </div>
          </div>
        </n-layout>
      </n-layout>
    </n-space>
    <AppAnnouncementAutoPopup />
    <MediaDetailDialog />
  </div>
</template>

<script setup lang="ts">
import { computed, h, nextTick, reactive, ref, watch, type Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NIcon, NImage, NLayout, NLayoutSider, NMenu, NSpace, type MenuOption } from "naive-ui";
import {
  Cloud,
  Compass,
  Heart,
  Home,
  ListMusic,
  Settings,
  UserRound,
  Wrench,
} from "lucide-vue-next";
import Header from "../components/Header.vue";
import AppAnnouncementAutoPopup from "@/components/home/AppAnnouncementAutoPopup.vue";
import MediaDetailDialog from "@/components/common/MediaDetailDialog.vue";
import { KGIcon, NeteaseIcon } from "@/icons";
import logo from "@/assets/pisamusic_icon_1024.png";
import "@/css/pageTransitions.css";
import { useCookieAccountStatus } from "@/composables/useCookieAccountStatus";
import { useThemeStore } from "@/store/theme";
import { getPageTransitionMeta } from "@/theme/pageTransitionOptions";

const router = useRouter();
const route = useRoute();
const themeStore = useThemeStore();
const pageTransitionName = computed(
  () => getPageTransitionMeta(themeStore.pageTransition).transitionName || undefined,
);
const collapsed = ref(false);
const contentContainerRef = ref<HTMLElement | null>(null);
const refreshVersionMap = reactive<Record<string, number>>({});
const contentScrollMap = new Map<string, number>();
const NON_CACHED_VIEWS = [
  "CloudSubmitPlaceholderView",
  "Discover",
  "ProfileView",
  "EditProfileView",
  "debugger",
  "404",
];

function getPageScopeKey(targetRoute = route) {
  if (targetRoute.path === "/playlist/detail") {
    const origin = String(targetRoute.query.origin ?? "");
    const id = String(targetRoute.query.id ?? "");
    return `${targetRoute.path}:${origin}:${id}`;
  }
  return targetRoute.path;
}

function getPageComponentKey() {
  const scopeKey = getPageScopeKey(route);
  return `${scopeKey}:${refreshVersionMap[scopeKey] ?? 0}`;
}

function restoreContentScroll(targetScopeKey = getPageScopeKey(route)) {
  const saved = contentScrollMap.get(targetScopeKey) ?? 0;
  void nextTick(() => {
    requestAnimationFrame(() => {
      if (contentContainerRef.value) {
        contentContainerRef.value.scrollTop = saved;
      }
    });
  });
}

function handlePageEnter() {
  restoreContentScroll(getPageScopeKey(route));
}
const { accounts } = useCookieAccountStatus();
const isDev = import.meta.env.DEV;

const routeToMenuKey = (path: string) => {
  if (path.startsWith("/recommend")) return "home";
  if (path.startsWith("/playlist")) return "playlist";
  if (path.startsWith("/favorite")) return "favorite";
  if (path.startsWith("/cloud")) return "cloud";
  if (path.startsWith("/mine")) return "mine";
  if (path.startsWith("/kg")) return "kg";
  if (path.startsWith("/wy")) return "wy";
  if (path.startsWith("/setting")) return "setting";
  if (path === "/discover") return "discover";
  if (path.startsWith("/debugger")) return "debugger";
  return "home";
};

const activeTab = ref(routeToMenuKey(route.path));

const menuOptions = computed<MenuOption[]>(() => {
  const items: MenuOption[] = [
    { label: "推荐", key: "home", icon: renderMenuIcon(Home) },
    { label: "歌单", key: "playlist", icon: renderMenuIcon(ListMusic) },
    { label: "收藏", key: "favorite", icon: renderMenuIcon(Heart) },
    { label: "云盘", key: "cloud", icon: renderMenuIcon(Cloud) },
    { label: "我的", key: "mine", icon: renderMenuIcon(UserRound) },
    { label: "设置", key: "setting", icon: renderMenuIcon(Settings) },
    ...cookieAccountMenuOptions.value,
  ];

  if (isDev) {
    items.push({ label: "dev page", key: "debugger", icon: renderMenuIcon(Wrench) });
  }

  items.push({ label: "发现", key: "discover", icon: renderMenuIcon(Compass) });
  return items;
});

const cookieAccountMenuOptions = computed<MenuOption[]>(() => {
  const items: MenuOption[] = [];
  if (!isDev) return items;

  if (accounts.kg.loggedIn) {
    items.push({ label: "KG", key: "kg", icon: renderMenuIcon(KGIcon) });
  }

  if (accounts.wy.loggedIn) {
    items.push({ label: "WY", key: "wy", icon: renderMenuIcon(NeteaseIcon) });
  }

  return items;
});

watch(
  () => [route.path, getPageScopeKey(route)] as const,
  ([path, scopeKey], prev) => {
    activeTab.value = routeToMenuKey(path);
    const prevScopeKey = prev?.[1];
    if (prevScopeKey && prevScopeKey !== scopeKey && contentContainerRef.value) {
      contentScrollMap.set(prevScopeKey, contentContainerRef.value.scrollTop);
    }
    if (!pageTransitionName.value) {
      restoreContentScroll(scopeKey);
    }
  },
  { immediate: true, flush: "sync" }
);

function handleChangeMenu(key: string) {
  const pathMap: Record<string, string> = {
    home: "/",
    playlist: "/playlist",
    favorite: "/favorite",
    cloud: "/cloud",
    mine: "/mine",
    kg: "/kg",
    wy: "/wy",
    setting: "/setting",
    discover: "/discover",
    debugger: "/debugger",
  };
  router.push(pathMap[key] || "/");
}

function refreshContent() {
  const scopeKey = getPageScopeKey(route);
  contentScrollMap.delete(scopeKey);
  refreshVersionMap[scopeKey] = (refreshVersionMap[scopeKey] ?? 0) + 1;
  if (contentContainerRef.value) {
    contentContainerRef.value.scrollTop = 0;
  }
}

function renderMenuIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) });
}
</script>

<style lang="scss" scoped>
.main-layout-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: transparent;
}

.layout-space {
  position: relative;
  z-index: 2;
  height: 100%;
  width: 100%;

  :deep(.n-space) {
    height: 100%;
  }
}

.app-shell {
  height: 100vh;
  padding-bottom: 80px;
  background: var(--surface-shell);
  transition: background-color 0.3s ease;

  :deep(.n-layout),
  :deep(.n-layout-scroll-container),
  :deep(.n-layout-sider),
  :deep(.n-layout-sider-scroll-container) {
    background: transparent;
  }
}

.app-sider {
  padding: 1rem;
  background: transparent;
}

.app-main-layout {
  background: transparent;
}

.right-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  background: transparent;

  .header {
    display: flex;
    flex: 0 0 auto;
    width: 100%;
    background: transparent;
  }

  .content {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow-y: overlay;
    padding: 1rem 1rem 0 1rem;
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
    border-radius: var(--radius-control);
    transition: all 0.3s ease-in-out;
  }

  .brand-title {
    color: var(--color-primary);
    font-size: 24px;
    font-weight: 800;
    line-height: 1;
    white-space: nowrap;
    letter-spacing: 0;
  }
}

:deep(.n-menu-item-content) {
  padding-left: 18px !important;
}
</style>
