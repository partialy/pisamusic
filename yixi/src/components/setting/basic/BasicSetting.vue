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
        <div class="setting-title">主题色</div>
        <div class="setting-desc">用于按钮、进度条、选中态、Naive UI primary 色和自动背景。</div>
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
        <div class="setting-title">自动设置背景</div>
        <div class="setting-desc">开启后根据主题色自动生成应用背景渐变。</div>
      </div>
      <n-switch
        :value="themeStore.autoBackground"
        @update:value="handleAutoBackgroundChange" />
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">渐变方向</div>
        <div class="setting-desc">控制侧栏与应用轨道背景的渐变方向。</div>
      </div>
      <n-select
        class="gradient-direction"
        :value="themeStore.gradientDirection"
        :options="gradientDirectionOptions"
        @update:value="handleGradientDirectionChange" />
    </div>

    <div class="setting-item gradient-setting-item">
      <div class="setting-info">
        <div class="setting-title">渐变颜色</div>
        <div class="setting-desc">关闭自动背景后可编辑，最多 5 个颜色。</div>
      </div>
      <div class="gradient-colors">
        <div
          v-for="(color, index) in themeStore.gradientColors"
          :key="`${index}-${color}`"
          class="gradient-color-row">
          <n-color-picker
            :value="color"
            :show-alpha="false"
            :modes="['hex']"
            :disabled="themeStore.autoBackground"
            @update:value="(value) => handleGradientColorChange(index, value)" />
          <n-button
            v-if="themeStore.gradientColors.length > 2"
            secondary
            circle
            size="small"
            :disabled="themeStore.autoBackground"
            @click="themeStore.removeGradientColor(index)">
            -
          </n-button>
        </div>
        <div class="gradient-actions">
          <n-button
            secondary
            :disabled="themeStore.autoBackground || themeStore.gradientColors.length >= 5"
            @click="themeStore.addGradientColor">
            添加颜色
          </n-button>
          <n-button secondary @click="themeStore.resetBackground">
            恢复默认背景
          </n-button>
        </div>
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
import { NButton, NColorPicker, NRadioButton, NRadioGroup, NSelect, NSwitch } from "naive-ui";
import electronAPI from "@/utils/electron";
import { useThemeStore, type GradientDirection, type ThemeMode } from "@/store/theme";

const themeStore = useThemeStore();
const localServer = ref(false);
const themeModeOptions = [
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" },
  { label: "跟随系统", value: "system" },
];
const gradientDirectionOptions = [
  { label: "自上而下", value: "to bottom" },
  { label: "自左向右", value: "to right" },
  { label: "左上到右下", value: "135deg" },
  { label: "左下到右上", value: "45deg" },
];

const handleThemeModeChange = (value: string | number) => {
  void themeStore.setMode(value as ThemeMode);
};

const handleAccentColorChange = (value: string) => {
  void themeStore.setAccentColor(value);
};

const handleAutoBackgroundChange = (value: boolean) => {
  void themeStore.setAutoBackground(value);
};

const handleGradientDirectionChange = (value: string) => {
  void themeStore.setGradientDirection(value as GradientDirection);
};

const handleGradientColorChange = (index: number, value: string) => {
  void themeStore.setGradientColor(index, value);
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

  .gradient-direction {
    width: 180px;
    flex-shrink: 0;
  }

  .gradient-setting-item {
    align-items: flex-start;
  }

  .gradient-colors {
    width: 300px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
  }

  .gradient-color-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .gradient-color-row :deep(.n-color-picker) {
    flex: 1;
  }

  .gradient-actions {
    display: flex;
    gap: 8px;
  }
}
</style>
