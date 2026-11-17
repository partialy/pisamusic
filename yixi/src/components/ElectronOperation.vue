<template>
  <div class="controller">
    <!-- 最小化 -->
    <n-button secondary class="control-btn" @click="minimizeWindow" circle>
      <template #icon>
        <n-icon :component="MiniWindowIcon" class="icon"></n-icon>
      </template>
    </n-button>
    <!-- 切换最大化,正常 -->
    <n-button secondary class="control-btn" @click="toggleFullscreen" circle>
      <template #icon>
        <n-icon
          v-if="!isFullscreen"
          :component="ScaleWindowNormalIcon"
          class="icon"
        ></n-icon>
        <n-icon v-else :component="ScaleWindowIcon" class="icon"></n-icon>
      </template>
    </n-button>
    <!-- 关闭 -->
    <n-button class="control-btn close" secondary @click="closeWindow" circle>
      <template #icon>
        <n-icon :component="CloseIcon" class="icon"></n-icon>
      </template>
    </n-button>
    <AppModal v-model:show="showQuit" title="退出" :width="500" :icon="LogOut">
      <p>您点击了关闭按钮，请选择要执行的操作</p>
      <template #footer-left>
        <n-checkbox v-model:checked="remember">记住选择</n-checkbox>
      </template>
      <template #footer>
        <n-button round @click="handleCancel">取消</n-button>
        <n-button round secondary @click="handleHide">托盘</n-button>
        <n-button round type="primary" @click="handleQuit">退出</n-button>
      </template>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NButton, NCheckbox, NIcon } from "naive-ui";
import {
  ScaleWindowIcon,
  ScaleWindowNormalIcon,
  MiniWindowIcon,
  CloseIcon,
} from "../icons";
import { electronAPI } from "../utils/electron";
import { useSettingStore } from "@/store/settingStore";
import AppModal from "@/components/common/AppModal.vue";
import { LogOut } from "lucide-vue-next";

const settingStore = useSettingStore();
const isFullscreen = ref(false);
const showQuit = ref(false);
const remember = ref(false);
const toggleFullscreen = () => {
  electronAPI.maximizeWindow();
  isFullscreen.value = !isFullscreen.value;
};

electronAPI.onWindowMaximized(() => {
  isFullscreen.value = true;
});

electronAPI.onWindowUnmaximized(() => {
  isFullscreen.value = false;
});

const minimizeWindow = () => {
  electronAPI.minimizeWindow();
};

const closeWindow = async () => {
  await settingStore.initBasicSetting();
  const action = settingStore.basic.closeAppAction;
  if (action === "tray") {
    electronAPI.hideWindow();
    return;
  }
  if (action === "quit") {
    electronAPI.closeWindow();
    return;
  }
  remember.value = false;
  showQuit.value = true;
};

const handleHide = async () => {
  if (remember.value) {
    await settingStore.updateCloseAppAction("tray");
  }
  showQuit.value = false;
  electronAPI.hideWindow();
};

const handleQuit = async () => {
  if (remember.value) {
    await settingStore.updateCloseAppAction("quit");
  }
  showQuit.value = false;
  electronAPI.closeWindow();
};

const handleCancel = () => {
  showQuit.value = false;
};
</script>

<style lang="scss" scoped>
.controller {
  gap: 10px;
  display: flex;
}

.icon {
  transition: all 0.3s ease-in-out;
}
.control-btn {
  -webkit-app-region: no-drag;

  &:hover {
    .icon {
      color: var(--color-primary);
      transform: rotate(360deg);
    }
  }
}

.close {
  &:hover {
    .icon {
      color: red;
    }
  }
}

</style>
