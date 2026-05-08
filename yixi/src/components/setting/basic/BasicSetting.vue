<template>
  <div class="setting-con">
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">主题模式</div>
        <div class="setting-desc">选择浅色、深色，或跟随系统外观。</div>
      </div>
      <n-radio-group
        class="theme-mode-group"
        :value="themeStore.mode"
        @update:value="handleThemeModeChange">
        <n-radio-button
          v-for="item in themeModeOptions"
          :key="item.value"
          :value="item.value">
          {{ item.label }}
        </n-radio-button>
      </n-radio-group>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">强调色</div>
        <div class="setting-desc">用于按钮、进度条、选中态和 Naive UI primary 色。</div>
      </div>
      <div class="accent-setting">
        <n-color-picker
          :value="themeStore.accentColor"
          :show-alpha="false"
          :modes="['hex']"
          @update:value="handleAccentColorChange" />
        <n-button secondary @click="themeStore.resetAccentColor">
          恢复默认
        </n-button>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">使用本地 Server</div>
        <div class="setting-desc">仅用于开发或本地调试。</div>
      </div>
      <n-switch
        :value="localServer"
        @update:value="changeLocalServer" />
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title danger" @click="electronAPI.reloadWindow">
          软件热重载
        </div>
        <div class="setting-desc">重新加载当前桌面端页面。</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NButton, NColorPicker, NRadioButton, NRadioGroup, NSwitch } from "naive-ui";
import electronAPI from "@/utils/electron";
import { useThemeStore, type ThemeMode } from "@/store/theme";

const themeStore = useThemeStore();
const localServer = ref(false);
const themeModeOptions = [
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" },
  { label: "跟随系统", value: "system" },
];

const handleThemeModeChange = (value: string | number) => {
  void themeStore.setMode(value as ThemeMode);
};

const handleAccentColorChange = (value: string) => {
  void themeStore.setAccentColor(value);
};

const changeLocalServer = (value: boolean) => {
  localServer.value = value;
  localStorage.setItem("pisa-local-server", value ? "true" : "false");
};

onMounted(() => {
  localServer.value = localStorage.getItem("pisa-local-server") === "true";
});
</script>

<style lang="scss" scoped>
.setting-con {
  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 14px 20px;
    border-radius: 8px;

    &:hover {
      background: var(--color-setting-hover);
    }
  }

  .setting-info {
    min-width: 0;
  }

  .setting-title {
    color: var(--color-text-default);
    font-size: 15px;
    font-weight: 600;

    &.danger {
      color: #f03f3f;
      cursor: pointer;
    }
  }

  .setting-desc {
    margin-top: 4px;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .accent-setting {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 280px;
  }

  .theme-mode-group {
    flex-shrink: 0;
  }
}
</style>
