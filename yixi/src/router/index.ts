import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import MainLayout from "../layout/MainLayout.vue";
import { NotFound } from "../components";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "Home",
    component: MainLayout,
    meta: { title: "PisaMusic" },
    children: [
      {
        path: "",
        name: "Index",
        component: () => import("../views/index.vue"),
        meta: { title: "PisaMusic" },
      },
      {
        path: "debugger",
        name: "Debugger",
        component: () => import("../views/debugger.vue"),
        meta: { title: "debugger" },
      },
      {
        path: "favorite",
        name: "Favorite",
        component: () => import("../views/favorite.vue"),
        meta: { title: "PisaMusic - 收藏" },
      },
      {
        path: "mine",
        name: "Mine",
        component: () => import("../views/mine/index.vue"),
        meta: { title: "PisaMusic - 我的" },
      },
      {
        path: "kg",
        name: "KgAccount",
        component: () => import("../views/cookieAccount/index.vue"),
        meta: { title: "PisaMusic - KG", source: "kg" },
      },
      {
        path: "wy",
        name: "WyAccount",
        component: () => import("../views/cookieAccount/index.vue"),
        meta: { title: "PisaMusic - WY", source: "wy" },
      },
      {
        path: "local-download",
        name: "LocalDownload",
        component: () => import("../views/localDownload.vue"),
        meta: { title: "PisaMusic - 本地与下载" },
      },
      {
        path: "search",
        name: "Search",
        component: () => import("../views/search.vue"),
        meta: { title: "PisaMusic - 搜索" },
      },
      {
        path: "setting",
        name: "Setting",
        component: () => import("../views/setting.vue"),
        meta: { title: "PisaMusic - 设置" },
      },
      {
        path: "about",
        name: "About",
        component: () => import("../views/about.vue"),
        meta: { title: "PisaMusic - 关于" },
      },
      {
        path: "playlist",
        name: "Playlist",
        component: () => import("../views/playlist.vue"),
        meta: { title: "PisaMusic - 歌单" },
      },
      {
        path: "recommend/playlists",
        name: "RecommendPlaylists",
        component: () => import("../views/recommend/RecommendPlaylistPage.vue"),
        meta: { title: "PisaMusic - 推荐歌单" },
      },
      {
        path: "recommend/songs",
        name: "RecommendSongs",
        component: () => import("../views/recommend/RecommendSongPage.vue"),
        meta: { title: "PisaMusic - 推荐歌曲" },
      },
      {
        path: "playlist/detail",
        name: "PlaylistDetail",
        component: () => import("../components/playList/PlayListDetailLayout.vue"),
        meta: { title: "PisaMusic - 歌单详情" },
      },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    component: MainLayout,
    meta: { title: "PisaMusic - 页面走丢了" },
    children: [
      {
        path: "",
        name: "NotFound",
        component: NotFound,
        meta: { title: "PisaMusic - 页面走丢了" },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  if (to.meta.title) {
    document.title = `${to.meta.title}`;
  }
  next();
});

export default router;
