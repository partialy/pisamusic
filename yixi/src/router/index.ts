import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import MainLayout from "../layout/MainLayout.vue";
import { NotFound } from "../components";

let firstTime = true;
// 定义路由规则
const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "Home",
    component: MainLayout,
    meta: {
      title: "Pisa Music",
    },
    children: [
      {
        path: "/",
        name: "Index",
        component: () => import("../views/index.vue"),
        meta: {
          title: "Pisa Music",
        },
      },
      {
        path: "/debugger",
        name: "Debugger",
        component: () => import("../views/debugger.vue"),
        meta: {
          title: "debugger",
        },
      },
      {
        path: "/mine",
        name: "Mine",
        meta: {
          title: "Pisa Music",
        },
        children: [
          {
            path: "collectSongs",
            name: "CollectSongs",
            component: () => import("../views/mine/collectSongs.vue"),
            meta: {
              title: "Pisa Music - 收藏歌曲",
            },
          },
          {
            path: "collectPlaylists",
            name: "CollectPlaylist",
            component: () => import("../views/mine/collectPlaylist.vue"),
            meta: {
              title: "Pisa Music - 收藏歌单",
            },
          },
        ],
      },
      {
        path: "/search",
        name: "Search",
        component: () => import("../views/search.vue"),
        meta: {
          title: "Pisa Music - 搜索",
        },
      },
      {
        path: "/setting",
        name: "Setting",
        component: () => import("../views/setting.vue"),
        meta: {
          title: "Pisa Music - 设置",
        },
      },
      {
        path: "/playlist",
        name: "Playlist",
        component: () => import("../views/playlist.vue"),
        meta: {
          title: "Pisa Music - 歌单",
        },
      },
      {
        path: "/playlist/detail",
        name: "PlaylistDetail",
        component: () =>
          import("../components/playList/PlayListDetailLayout.vue"),
        meta: {
          title: "Pisa Music - 歌单详情",
        },
      },
    ],
  },

  {
    path: "/:pathMatch(.*)*", // 404 处理
    component: MainLayout,
    meta: {
      title: "Pisa Music - 页面走丢了" + "/:pathMatch(.*)*",
    },
    children: [
      {
        path: "",
        name: "NotFound",
        component: NotFound,
        meta: {
          title: "Pisa Music - 页面走丢了" + "/:pathMatch(.*)*",
        },
      },
    ],
  },
];

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 全局前置守卫（可选）
router.beforeEach((to, _from, next) => {
  if(firstTime) {
    firstTime = false;
    router.push("/")
    return;
  }
  // 修改页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title}`;
  }
  next();
});

export default router;
