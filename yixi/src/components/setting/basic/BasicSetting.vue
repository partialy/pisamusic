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
        <div class="setting-desc">用于按钮、进度条、选中态与 UI 主色。</div>
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
        <div class="setting-title">跟随歌曲自动换色</div>
        <div class="setting-desc">开启后，切歌时会根据封面自动更新主题强调色。</div>
      </div>
      <n-switch
        :value="themeStore.followSongAccent"
        @update:value="handleFollowSongAccentChange" />
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">背景模式</div>
        <div class="setting-desc">选择纯色/渐变色彩或自定义背景图片。</div>
      </div>
      <n-select
        class="background-mode-select"
        :value="themeStore.backgroundMode"
        :options="backgroundModeOptions"
        @update:value="handleBackgroundModeChange" />
    </div>

    <!-- 颜色模式下的设置项 -->
    <template v-if="themeStore.backgroundMode === 'color'">
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
    </template>

    <!-- 图片模式下的设置项 -->
    <template v-else>
      <div class="setting-item image-setting-item">
        <div class="setting-info">
          <div class="setting-title">当前图片</div>
          <div class="setting-desc">可选择自定义图片，建议4:3</div>
        </div>
        <div class="current-image-control">
          <div class="image-thumb-wrapper current-thumb">
            <img :src="themeStore.backgroundImage" class="image-thumb" alt="当前背景" />
          </div>
          <n-button
            secondary
            circle
            title="选择本地图片"
            class="upload-btn"
            @click="handleSelectCustomImage">
            <template #icon>
              <n-icon><Upload /></n-icon>
            </template>
          </n-button>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            style="display: none"
            @change="handleFileInputChange" />
        </div>
      </div>

      <div class="setting-item image-setting-item">
        <div class="setting-info">
          <div class="setting-title">图片库</div>
          <div class="setting-desc">管理与选用壁纸图片库</div>
        </div>
        <div class="gallery-control">
          <div class="preset-images-control">
            <div
              v-for="item in latestThreeImages"
              :key="item.id"
              class="image-thumb-wrapper preset-thumb"
              :class="{ active: themeStore.backgroundImage === item.url }"
              :title="item.name"
              @click="handleSelectGalleryImage(item.url)">
              <img :src="item.url" class="image-thumb" :alt="item.name" />
              <div v-if="themeStore.backgroundImage === item.url" class="active-badge">
                <n-icon size="12"><Check /></n-icon>
              </div>
            </div>
          </div>
          <n-button
            secondary
            circle
            title="打开图片库"
            class="gallery-btn"
            @click="showImageCenterModal = true">
            <template #icon>
              <n-icon :size="18"><Images /></n-icon>
            </template>
          </n-button>
        </div>
      </div>

      <div class="setting-item blur-setting-item">
        <div class="setting-info">
          <div class="setting-title">背景模糊度</div>
          <div class="setting-desc">调节背景图片的模糊程度（0-100）。</div>
        </div>
        <div class="blur-slider-control">
          <button
            type="button"
            class="blur-step-btn"
            title="减少模糊度"
            :disabled="themeStore.backgroundBlur <= 0"
            @click="handleStepBlur(-1)">
            <n-icon :size="14"><Minus /></n-icon>
          </button>
          <div class="blur-slider-wrap">
            <n-slider
              class="blur-slider"
              :value="themeStore.backgroundBlur"
              :min="0"
              :max="100"
              :step="1"
              :tooltip="false"
              @update:value="handleBlurChange" />
          </div>
          <button
            type="button"
            class="blur-step-btn"
            title="增加模糊度"
            :disabled="themeStore.backgroundBlur >= 100"
            @click="handleStepBlur(1)">
            <n-icon :size="14"><Plus /></n-icon>
          </button>
          <span class="blur-val-text">{{ themeStore.backgroundBlur }}%</span>
        </div>
      </div>

      <div class="setting-item blur-setting-item">
        <div class="setting-info">
          <div class="setting-title">背景亮度</div>
          <div class="setting-desc">调节背景图片的明暗程度（0-100%）。</div>
        </div>
        <div class="blur-slider-control">
          <button
            type="button"
            class="blur-step-btn"
            title="降低亮度"
            :disabled="themeStore.backgroundBrightness <= 0"
            @click="handleStepBrightness(-1)">
            <n-icon :size="14"><Minus /></n-icon>
          </button>
          <div class="blur-slider-wrap">
            <n-slider
              class="blur-slider"
              :value="themeStore.backgroundBrightness"
              :min="0"
              :max="100"
              :step="1"
              :tooltip="false"
              @update:value="handleBrightnessChange" />
          </div>
          <button
            type="button"
            class="blur-step-btn"
            title="提高亮度"
            :disabled="themeStore.backgroundBrightness >= 100"
            @click="handleStepBrightness(1)">
            <n-icon :size="14"><Plus /></n-icon>
          </button>
          <span class="blur-val-text">{{ themeStore.backgroundBrightness }}%</span>
        </div>
      </div>
    </template>

    <!-- 图片库 Modal -->
    <AppImageCenterModal
      v-model:show="showImageCenterModal"
      :current-url="themeStore.backgroundImage"
      @confirm="handleConfirmFromGallery" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  NButton,
  NColorPicker,
  NIcon,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSwitch,
} from "naive-ui";
import { Upload, Check, Minus, Plus, Images } from "lucide-vue-next";
import {
  useThemeStore,
  type BackgroundMode,
  type GradientDirection,
  type ThemeMode,
} from "@/store/theme";
import { useImageManager } from "@/composables/useImageManager";
import AppImageCenterModal from "@/components/common/AppImageCenterModal.vue";

const themeStore = useThemeStore();
const imageManager = useImageManager();
const { latestThreeImages } = imageManager;

const fileInputRef = ref<HTMLInputElement | null>(null);
const showImageCenterModal = ref(false);

onMounted(() => {
  void imageManager.loadImages();
});

const themeModeOptions = [
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" },
  { label: "跟随系统", value: "system" },
];
const backgroundModeOptions = [
  { label: "颜色", value: "color" },
  { label: "图片", value: "image" },
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

const handleFollowSongAccentChange = (value: boolean) => {
  void themeStore.setFollowSongAccent(value);
};

const handleBackgroundModeChange = (value: string) => {
  void themeStore.setBackgroundMode(value as BackgroundMode);
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

const handleSelectGalleryImage = (url: string) => {
  void themeStore.setBackgroundImage(url);
};

const handleConfirmFromGallery = (url: string) => {
  void themeStore.setBackgroundImage(url);
};

const handleBlurChange = (val: number) => {
  void themeStore.setBackgroundBlur(val);
};

const handleStepBlur = (delta: number) => {
  void themeStore.setBackgroundBlur(themeStore.backgroundBlur + delta);
};

const handleBrightnessChange = (val: number) => {
  void themeStore.setBackgroundBrightness(val);
};

const handleStepBrightness = (delta: number) => {
  void themeStore.setBackgroundBrightness(themeStore.backgroundBrightness + delta);
};

const handleSelectCustomImage = async () => {
  try {
    if (window.electronAPI?.selectBackgroundImage) {
      const filePath = await window.electronAPI.selectBackgroundImage();
      if (filePath) {
        await themeStore.setCustomBackgroundImage(filePath);
        await imageManager.addImage(filePath);
        window.$message?.success("背景图片已更新");
        return;
      }
    } else {
      fileInputRef.value?.click();
    }
  } catch (error) {
    console.error("选择背景图片失败:", error);
    fileInputRef.value?.click();
  }
};

const handleFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target?.result as string;
    if (dataUrl) {
      await themeStore.setCustomBackgroundImage(dataUrl);
      await imageManager.addImage(dataUrl, file.name);
      window.$message?.success("背景图片已更新");
    }
  };
  reader.readAsDataURL(file);
  target.value = "";
};
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
    transition: background-color 0.18s ease;

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

  .background-mode-select {
    width: 180px;
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

  .image-setting-item {
    align-items: center;
  }

  .current-image-control {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
  }

  .preset-images-control {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .gallery-control {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .gallery-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .image-thumb-wrapper {
    position: relative;
    width: 88px;
    height: 66px;
    aspect-ratio: 4 / 3;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--color-border-default, rgba(0, 0, 0, 0.1));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    .image-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    &.current-thumb {
      cursor: default;
    }

    &.preset-thumb {
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
        border-color: var(--color-primary);
      }

      &.active {
        border: 2px solid var(--color-primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 32%, transparent);

        .active-badge {
          position: absolute;
          right: 4px;
          bottom: 4px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-primary);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
        }
      }
    }
  }

  .upload-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .blur-setting-item {
    align-items: center;
  }

  .blur-slider-control {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 280px;
    flex-shrink: 0;

    .blur-step-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 1px solid var(--color-border-default, #e8e8e8);
      background: color-mix(in srgb, var(--color-bg-default, #fff) 85%, transparent);
      color: var(--color-text-default);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.2s ease;

      &:hover:not(:disabled) {
        background: var(--color-primary);
        color: #ffffff;
        border-color: var(--color-primary);
        transform: scale(1.05);
      }

      &:active:not(:disabled) {
        transform: scale(0.95);
      }

      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }

    .blur-slider-wrap {
      flex: 1;
      display: flex;
      align-items: center;

      :deep(.n-slider) {
        .n-slider-rail {
          height: 4px;
          border-radius: 2px;
          background-color: var(--color-slider-rail, rgba(0, 0, 0, 0.12));

          .n-slider-rail__fill {
            background-color: var(--color-primary);
            border-radius: 2px;
          }
        }

        .n-slider-handle {
          width: 12px;
          height: 12px;
          background-color: #ffffff;
          border: 2px solid var(--color-primary);
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
          transition: transform 0.15s ease;
        }

        &:hover .n-slider-handle {
          transform: scale(1.25);
        }
      }
    }

    .blur-val-text {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-default);
      min-width: 38px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  }
}
</style>
