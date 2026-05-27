<template>
  <n-config-provider
    :theme="themeStore.naiveTheme"
    :theme-overrides="themeStore.naiveThemeOverrides">
    <n-notification-provider>
      <n-message-provider>
        <n-modal-provider>
          <router-view v-show="!showPlayer" v-slot="{ Component }">
            <Transition name="main-page" mode="in-out">
              <component :is="Component" />
            </Transition>
          </router-view>
          <PlayerBar class="player-bar"></PlayerBar>
          <Transition name="player-slide">
            <MainPlayer v-if="showPlayer" class="player" />
          </Transition>
        </n-modal-provider>
      </n-message-provider>
    </n-notification-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import {
  NConfigProvider,
  NNotificationProvider,
  NModalProvider,
  NMessageProvider,
  NButton,
} from "naive-ui";
import { h, onBeforeUnmount, Transition, watch } from "vue";
import { PlayerBar, MainPlayer } from "./components";
import {
  useCommonStore,
  useCollectStore,
  useAudioStore,
  useLyricStore,
  useMineLibraryStore,
  useRuntimeConfigStore,
  useShortcutStore,
  useThemeStore,
  useUserStore,
} from "./store";
import { storeToRefs } from "pinia";
import {
  dialog,
  notification,
  modal,
  loadingBar,
} from "./utils/common/message";
import electronAPI from "./utils/electron";
import { getColorFromUrl, getSongCover } from "./utils/common";
import { message } from "./utils/pure/message";
import { normalizeSong } from "./utils/song";
const player = useAudioStore();
const commonStore = useCommonStore();
const collector = useCollectStore();
const lyric = useLyricStore();
const mineLibrary = useMineLibraryStore();
const runtimeConfig = useRuntimeConfigStore();
const themeStore = useThemeStore();
const shortcutStore = useShortcutStore();
const userStore = useUserStore();
// 初始化
commonStore.hidePlayer();

const { showPlayer } = storeToRefs(commonStore);

function setupListeners() {
  const { currentTime, currentSong } = storeToRefs(player);
  const { followSongAccent } = storeToRefs(themeStore);
  electronAPI.onMediaControl(
    async (action: "play" | "pause" | "next" | "prev") => {
      switch (action) {
        case "play":
          player.play();
          break;
        case "pause":
          player.pause();
          break;
        case "next":
          player.next();
          break;
        case "prev":
          player.prev();
          break;
      }
    }
  );

  electronAPI.onLyricWindowStatus((status: boolean) => {
    lyric.setDesktop(status);
  });

  electronAPI.onLyricLockedStatus((locked: boolean) => {
    lyric.syncDesktopLocked(locked);
  });

  watch(currentTime, (newTime) => {
    electronAPI.updateTime(newTime);
  });

  watch(
    [() => currentSong.value, followSongAccent],
    ([newSong, enabled]) => {
      if (newSong) {
        const coverUrl = getSongCover(newSong);
        if (enabled && coverUrl) {
          void getColorFromUrl(coverUrl).then((color) => {
            void themeStore.setAccentColor(color);
          });
        }
        electronAPI.changeCurrentSong(normalizeSong(newSong));
      } else {
        // void themeStore.setAccentColor('#2897ff');
        electronAPI.changeCurrentSong(null);
      }
    },
    {
      deep: true,
      immediate: true,
    }
  );
}

let lastUpdaterProgressNotice = -1;
function setupUpdaterNotifications() {
  electronAPI.onUpdaterState?.((state) => {
    if (state.status === "available") {
      window.$notification.info({
        title: state.forceUpdate ? "发现必须更新版本" : "发现新版本",
        content: `新版本 ${state.updateInfo?.version || ""} 已可用`,
        duration: state.forceUpdate ? 0 : 8000,
        action: () =>
          h(
            NButton,
            {
              size: "small",
              type: "primary",
              onClick: () => void electronAPI.downloadUpdate?.(),
            },
            { default: () => "下载更新" },
          ),
      });
    } else if (state.status === "downloading") {
      const percent = Math.round(state.progress?.percent ?? 0);
      if (percent === 100 || percent - lastUpdaterProgressNotice >= 20) {
        lastUpdaterProgressNotice = percent;
        window.$message.info(`更新下载中 ${percent}%`);
      }
    } else if (state.status === "downloaded") {
      lastUpdaterProgressNotice = -1;
      window.$notification.success({
        title: "更新下载完成",
        content: "重启应用后将安装新版本",
        duration: state.forceUpdate ? 0 : 10000,
        action: () =>
          h(
            NButton,
            {
              size: "small",
              type: "primary",
              onClick: () => void electronAPI.quitAndInstallUpdate?.(),
            },
            { default: () => "立即重启安装" },
          ),
      });
    } else if (state.status === "error" && state.manual) {
      window.$notification.warning({
        title: "检查更新失败",
        content: state.error || "请稍后重试",
        duration: 5000,
      });
    } else if (state.status === "not-available" && state.manual) {
      window.$notification.success({
        title: "当前已是最新版本",
        content: "暂未发现可用更新",
        duration: 4000,
      });
    } else if (state.status === "disabled" && state.manual) {
      window.$notification.info({
        title: "无法检查更新",
        content: state.error || "当前环境不支持自动更新",
        duration: 4000,
      });
    }
  });
}

function setUpWindow() {
  window.$message = message;
  window.$notification = notification;
  window.$modal = modal;
  window.$dialog = dialog;
  window.$loadingBar = loadingBar;
  window.$mainServer = "";
}

let t: NodeJS.Timeout;
function setupAutoSaver() {
  t = setInterval(() => {
    player.saveState();
    if (collector.changed) {
      collector.save();
    }
  }, 1000 * 60 * 10);
}

async function bootstrapApp() {
  try {
    setUpWindow();
    setupListeners();
    setupUpdaterNotifications();
    setupAutoSaver();
    lyric.loadSetting();
    const startupServiceState = await electronAPI.getStartupServiceState?.();
    const isLocalMode = Boolean(startupServiceState?.localMode);
    if (isLocalMode) {
      window.$notification.warning({
        title: "服务不可用",
        content: "已进入本地模式，在线功能暂不可用",
        duration: 5000,
      });
    }

    const results = await Promise.allSettled([
      themeStore.init(),
      isLocalMode ? Promise.resolve(null) : runtimeConfig.refresh(),
      collector.initStore(),
      mineLibrary.init(),
      isLocalMode ? Promise.resolve(null) : userStore.init(),
      lyric.loadDesktopLyricSetting(),
      player.loadState(),
      shortcutStore.init(),
    ]);

    results.forEach((result, index) => {
      if (result.status === "fulfilled") return;
      void electronAPI.reportError(result.reason, {
        scope: "startup",
        action: "bootstrapApp",
        taskIndex: index,
      });
    });
  } catch (error) {
    void electronAPI.reportError(error, {
      scope: "startup",
      action: "bootstrapApp",
    });
  } finally {
    electronAPI.notifyStartupReady?.();
  }
}

void bootstrapApp();

// 离开页面保存数据
onBeforeUnmount(() => {
  player.saveState();
  collector.save();
  themeStore.dispose();
  shortcutStore.dispose();
  clearInterval(t);
});
</script>

<style src="./css/animation.css"></style>
<style scoped lang="scss">
.player-bar {
  position: fixed;
  display: flex;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 100;
}

@keyframes slide-up {
  0% {
    transform: translateY(100%);
  }

  100% {
    transform: translateY(0);
  }
}

@keyframes slide-down {
  0% {
    transform: translateY(0);
  }

  100% {
    transform: translateY(100%);
  }
}

@keyframes player-in {
  0% {
    scale: 1;
    opacity: 1;
  }

  100% {
    scale: 0.95;
    opacity: 0;
  }
}

@keyframes player-out {
  0% {
    scale: 0.95;
    opacity: 0;
  }

  100% {
    scale: 1;
    opacity: 1;
  }
}

.showPlayer {
  animation: player-in 0.3s;
}

.hidePlayer {
  animation: player-out 0.3s;
}

.main-page-enter-active {
  animation: player-out 0.5s ease-in-out;
}

.main-page-leave-active {
  animation: player-in 0.5s ease-in-out;
}

.player-slide-leave-active {
  animation: slide-down 0.5s ease-in-out;
}

.player-slide-enter-active {
  animation: slide-up 0.5s ease-in-out;
}
</style>
