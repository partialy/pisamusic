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
    <dialog-wrapper v-model:visible="showQuit">
      <template #all-content>
        <n-card
          title="退出"
          class="close-container"
          closable
          @close="handleCancel"
        >
          <div class="content">您点击了关闭按钮，请选择要执行的操作</div>
          <div class="footer">
            <div class="left">
              <n-checkbox v-model:checked="remenber"></n-checkbox> 以后不再提示
            </div>
            <div class="right">
              <n-button @click="electronAPI.closeWindow" secondary
                >退出</n-button
              >
              <n-button @click="handleHide" secondary>最小化</n-button>
              <n-button @click="handleCancel" secondary>取消</n-button>
            </div>
          </div>
        </n-card>
      </template>
    </dialog-wrapper>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  ScaleWindowIcon,
  ScaleWindowNormalIcon,
  MiniWindowIcon,
  CloseIcon,
} from "../icons";
import { electronAPI } from "../utils/electron";
import { DialogWrapper } from ".";
import { NCard } from "naive-ui";
const isFullscreen = ref(false);
const showQuit = ref(false);
const remenber = ref(false);
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
const closeWindow = () => {
  const closeType = localStorage.getItem("closeType") || "ask";
  if (closeType == "ask") {
    showQuit.value = true;
  } else if (closeType == "minimize") {
    electronAPI.hideWindow();
    if(remenber.value) {
      localStorage.setItem("closeType", "minimize")
    }
  } else if (closeType == "quit") {
    electronAPI.closeWindow();
    if(remenber.value) {
      localStorage.setItem("closeType", "quit")
    }
  }
};

const handleHide = () => {
  electronAPI.hideWindow();
  showQuit.value = false;
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

.close-container {
  width: 500px;
  border-radius: 10px;
  padding: 10px;
  background-color: #f1eaf9;
  animation: fade-in 0.4s ease-in-out;
  .content {
    margin-bottom: 20px;
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .left {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .right {
      display: flex;
      gap: 10px;
    }
  }
}
</style>
