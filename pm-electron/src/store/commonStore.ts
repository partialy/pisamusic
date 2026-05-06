
import { defineStore } from "pinia";

export const useCommonStore = defineStore("common", {
  state: () => {
    return {
      isDarkMode: false,
      showPlayer: false,
      isFullscreen: false,
    };
  },
  actions: {
    toggleDarkMode() {
      this.isDarkMode = !this.isDarkMode;
    },
    openPlayer() {
      this.showPlayer = true;
    },
    hidePlayer() {
      this.showPlayer = false;
    },

    handleToggleFullscreen() {
      // 切换全屏
      if (document.fullscreenElement) {
        document.exitFullscreen();
        this.isFullscreen = false;
      } else {
        document.documentElement.requestFullscreen();
        this.isFullscreen = true;
      }
    },
  },
});
