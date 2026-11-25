import { createRouter, createWebHashHistory, createWebHistory, type RouteRecordRaw } from "vue-router";
import MainLayout from "../layout/MainLayout.vue";
import { openLegacyMediaDetail } from "@/share/mediaDetailRoute";

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
        path: "cloud",
        name: "CloudMusic",
        component: () => import("../views/cloud/CloudMusicView.vue"),
        meta: { title: "PisaMusic - 共享云盘" },
      },
      {
        path: "cloud/submit",
        name: "CloudMusicSubmit",
        component: () => import("../views/cloud/CloudSubmitPlaceholderView.vue"),
        meta: { title: "PisaMusic - 我要投稿" },
      },
      {
        path: "mine",
        name: "Mine",
        component: () => import("../views/mine/index.vue"),
        meta: { title: "PisaMusic - 我的" },
      },
      {
        path: "user/profile",
        name: "UserProfile",
        component: () => import("../views/user/ProfileView.vue"),
        meta: { title: "PisaMusic - 用户资料" },
      },
      {
        path: "user/editProfile",
        name: "EditUserProfile",
        component: () => import("../views/user/EditProfileView.vue"),
        meta: { title: "PisaMusic - 编辑用户资料" },
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
        redirect: { path: "/mine", query: { tab: "local" } },
      },
      {
        path: "search",
        name: "Search",
        component: () => import("../views/search.vue"),
        meta: { title: "PisaMusic - 搜索" },
      },
      {
        path: "discover",
        name: "Discover",
        component: () => import("../views/Discover.vue"),
        meta: { title: "PisaMusic - 发现" },
      },
      {
        path: "setting",
        name: "Setting",
        component: () => import("../views/setting.vue"),
        meta: { title: "PisaMusic - 设置" },
      },
      {
        path: "about",
        redirect: { path: "/setting", query: { tab: "about" } },
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
        component: () => import("../components/404.vue"),
        meta: { title: "PisaMusic - 页面走丢了" },
      },
    ],
  },
];

const router = createRouter({
  history: import.meta.env.DEV ? createWebHistory() : createWebHashHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  if (to.path === "/media/detail") {
    openLegacyMediaDetail(to.query);
    next({ path: from.path && from.path !== "/media/detail" ? from.path : "/", query: from.path === "/media/detail" ? {} : from.query, replace: true });
    return;
  }
  if (to.meta.title) {
    document.title = `${to.meta.title}`;
  }
  next();
});

export default router;
