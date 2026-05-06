<template>
  <n-space vertical>
    <n-layout has-sider style="height: 100vh; padding-bottom: 80px;background: var(--color-bg-track);">
      <n-layout-sider style="margin: 1rem;background: transparent;" bordered collapse-mode="width" :collapsed-width="64"
        :width="240" :collapsed="collapsed" show-trigger @collapse="collapsed = true" @expand="collapsed = false">
        <div class="img-container">
          <n-image :src="logo" class="logo-img" :style="{
            height: collapsed ? '56px' : '160px',
            width: collapsed ? '56px' : '160px',
          }" />
        </div>
        <n-menu :collapsed="collapsed" :collapsed-width="64" :collapsed-icon-size="22" :options="menuOptions"
          v-model:value="activeTab" v-on:update-value="handleChangeMenu" />
        <div :style="{ padding: collapsed ? '0' : '8px 18px 0 32px' }">
          <n-tabs type="bar" animated size="small">
            <template #prefix>
              <n-button circle size="small" text title="刷新歌单" @click="handleRefresh">
                <n-icon :component="RefreshIcon" />
              </n-button>
            </template>
            <template #suffix v-if="!collapsed">
              <n-button circle size="small" text title="添加歌单">
                <n-icon :component="AddOutline" />
              </n-button>
            </template>
            <n-tab-pane name="create" tab="自建歌单">
              <div v-for="i in createdList" @click="handleClickPlaylist(i)">
                <PlaylistList :key="i.id" :list="i" :hideText="collapsed" :title="i.name"
                  :active="$route.query.ownList == '1' && $route.query.id == i.id">
                </PlaylistList>
              </div>
            </n-tab-pane>
            <n-tab-pane name="collect" tab="收藏歌单">
              <div v-for="i in collectList" @click="handleClickPlaylist(i)">
                <PlaylistList :key="i.id" :list="i" :hideText="collapsed" :title="i.name"
                  :active="$route.query.ownList == '1' && $route.query.id == i.id">
                </PlaylistList>
              </div>
            </n-tab-pane>
          </n-tabs>
        </div>
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
import { NMenu, NLayout, NLayoutSider, NSpace, type MenuOption, NTabs, NTabPane } from 'naive-ui';
import { computed, h, onMounted, ref, watch, type VNodeChild } from 'vue';
import { Header } from '../components';
import { NeteaseIcon, RefreshIcon } from '../icons';
import { useRouter } from 'vue-router';
import { AddOutline } from '@vicons/ionicons5';
import { PlaylistList } from '../components/playList';
import logo from "@/assets/logo-circle.png"
import { proxyAPI } from '@/utils/api/proxyAPI';
import { debounce, getKgImage, renderIcon } from '@/utils/common';
import electronAPI from '@/utils/electron';
const router = useRouter()
const collapsed = ref(false)
const activeTab = ref('home')

const atab = computed(() => {
  return router.currentRoute.value.query.activeTab as string
})

watch(() => atab.value, (val) => {
  activeTab.value = val
})

const WYUserPlaylist = ref<{
  label: string,
  key: string,
  info: {
    id: string,
    name: string,
    cover: string
  }
  icon: (() => VNodeChild) | undefined
}[]>([])


const menuOptions: MenuOption[] = [
  {
    label: '首页',
    key: 'home',
    icon: () => h("span", "🍕")
  },
  {
    label: '歌单',
    key: 'playlist',
    icon: () => h("span", "🎵"),
  },
  {
    label: '我的',
    key: 'mine',
    icon: () => h("span", "🕹️"),
    children: [
      {
        label: '歌曲收藏',
        key: 'mine/collectSongs',
        icon: () => h("span", "❤️")
      },
      {
        label: '歌单收藏',
        key: 'mine/collectPlaylists',
        icon: () => h("span", "🎶")
      },
      {
        label: '最近下载',
        key: 'mine/download',
        icon: () => h("span", "💾")
      },
    ]
  },
  {
    label: 'Netease',
    key: 'about',
    icon: renderIcon(NeteaseIcon, { style: { fontSize: '20px', color: "red" } }),
    children: WYUserPlaylist.value
  },
  {
    label: '设置',
    key: 'setting',
    icon: () => h("span", "⚙️")
  }
]

if(process.env.NODE_ENV == 'development'){
  menuOptions.push({
    label: 'dev page',
    key: 'debugger',
    icon: () => h("span", "🔍")
  })
}

const handleChangeMenu = (key: string) => {
  console.log(key)
  if (key.startsWith('wylist')) {
    router.push({
      path: `/playlist/detail`, query: {
        id: key.split('wylist')[1],
        ownList: '0',
        origin: 'wy'
      }
    })
    return;
  }
  if (key == 'home') {
    router.push({ path: '/', query: { activeTab: key } })
    return;
  }
  router.push({ path: `/${key}`, query: { activeTab: key } })
}

// 歌单
const collectList = ref<{
  id: string,
  name: string,
  cover: string
}[]>([])

const createdList = ref<{
  id: string,
  name: string,
  cover: string
}[]>([])

const handleRefresh = debounce(async () => { 
 
  fetchCollectList()
}, 500)

// kg
const fetchCollectList = async () => {
  try {
    const res = await proxyAPI.kg?.userPlayList();
    if (res?.status == 1) {
      collectList.value = res.data.info.filter(i => i.list_create_userid != res.data.userid)
        .map(i => {
          return {
            id: i.global_collection_id,
            name: i.name,
            cover: getKgImage(i.pic, 120)
          }
        })
      createdList.value = res.data.info
        .filter(i => i.list_create_userid == res.data.userid)
        .map(i => {
          return {
            id: i.global_collection_id,
            name: i.name,
            cover: getKgImage(i.pic, 120)
          }
        })
    } else {
      collectList.value = []
      createdList.value = []
    }
  } catch (error: any) {
    electronAPI.log(error.message)
    collectList.value = []
  }
}

const handleClickPlaylist = (list: { id: string, name: string, cover: string }) => {
  router.push({ path: `/playlist/detail`, query: { id: list.id, ownList: '1', origin: 'kg' } })
}

// wy
const fetchWYUserPlaylist = async () => {
  try {
    let uid = localStorage.getItem("wyuid") as string
    if (!uid) {
      const res = await proxyAPI.wy?.userAccount();
      uid = res?.account.id.toString() || "";
      localStorage.setItem("wyuid", uid);
    }
    const res = await proxyAPI.wy?.userPlaylist({
      uid: localStorage.getItem("wyuid") as string
    })
    res?.playlist.forEach(i => {
      WYUserPlaylist.value.push({
        label: i.name,
        key: 'wylist' + i.id.toString(),
        info: {
          id: i.id.toString(),
          name: i.name,
          cover: i.coverImgUrl
        },
        icon: () => h("img", { src: i.coverImgUrl, style: { "border-radius": "4px" } })
      })
    })
  } catch (error: any) {
    window.$notification.error({
      title: "获取歌单失败",
      content: "请检查网络:" + error.message
    })
  }
}
let t:NodeJS.Timeout;
onMounted(() => {
  if(t) clearTimeout(t);
  t = setTimeout(() => {
    fetchCollectList()
    fetchWYUserPlaylist()
  }, 1000)
})
</script>

<style lang="scss" scoped>
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

.img-container {
  display: flex;
  justify-content: center;
  align-items: center;
  -webkit-app-region: drag;

  .logo-img {

    margin: 0 auto;
    border-radius: 50%;
    transition: all 0.3s ease-in-out;

    &:hover {
      cursor: pointer;
    }
  }
}

:deep(.n-menu-item-content .n-menu-item-content--selected) {
  border-radius: 8px;
  background-color: var(--color-primary);
  overflow: hidden;
}
</style>
