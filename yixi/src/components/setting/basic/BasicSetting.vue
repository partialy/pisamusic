<template>
  <div class="settings-stack setting-con">
    <SettingSection title="主题与外观" description="设置应用主题与强调色。">
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
        <div class="setting-title">启动动画</div>
        <div class="setting-desc">{{ currentStartupMeta.description }}（下次启动时生效）</div>
      </div>
      <n-select
        class="startup-animation-select"
        :value="themeStore.startupAnimation"
        :options="startupAnimationSelectOptions"
        @update:value="handleStartupAnimationChange" />
    </div>

    <n-collapse class="startup-preview-collapse">
      <n-collapse-item :title="`预览效果：${currentStartupMeta.label}`" name="preview">
        <StartupAnimationPreview
          :style-id="themeStore.startupAnimation"
          :default-surface="themeStore.resolvedColorScheme" />
      </n-collapse-item>
    </n-collapse>

    </SettingSection>
    <SettingSection title="应用背景" description="选择背景颜色或图片，调节图片显示效果。">
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

      <div class="setting-item single-column gradient-setting-item">
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

      <div class="setting-item single-column blur-setting-item">
        <div class="setting-info">
          <div class="setting-title">背景模糊度</div>
          <div class="setting-desc">调节背景图片的模糊程度（0-100）。</div>
        </div>
        <SettingAdjustment :value="themeStore.backgroundBlur" label="背景模糊度" @update:value="handleBlurChange" />
      </div>

      <div class="setting-item single-column blur-setting-item">
        <div class="setting-info">
          <div class="setting-title">背景亮度</div>
          <div class="setting-desc">调节背景图片的明暗程度（0-100%）。</div>
        </div>
        <SettingAdjustment :value="themeStore.backgroundBrightness" label="背景亮度" @update:value="handleBrightnessChange" />
      </div>
    </template>

    </SettingSection>

    <!-- 图片库 Modal -->
    <AppImageCenterModal
      v-model:show="showImageCenterModal"
      :current-url="themeStore.backgroundImage"
      @confirm="handleConfirmFromGallery" />
  </div>
</template>

<script setup lang="ts">
import SettingSection from "../SettingSection.vue";
import SettingAdjustment from "../SettingAdjustment.vue";
import StartupAnimationPreview from "./StartupAnimationPreview.vue";
import { computed, onMounted, ref } from "vue";
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NColorPicker,
  NIcon,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSwitch,
} from "naive-ui";
import { Upload, Check, Images } from "lucide-vue-next";
import {
  STARTUP_ANIMATION_OPTIONS,
  getStartupAnimationMeta,
  type StartupAnimationStyle,
} from "@/startup/startupAnimationOptions";
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
const startupAnimationSelectOptions = STARTUP_ANIMATION_OPTIONS.map((item) => ({
  label: item.label,
  value: item.value,
}));
const currentStartupMeta = computed(() => getStartupAnimationMeta(themeStore.startupAnimation));

const handleThemeModeChange = (value: string | number) => {
  void themeStore.setMode(value as ThemeMode);
};

const handleAccentColorChange = (value: string) => {
  void themeStore.setAccentColor(value);
};

const handleFollowSongAccentChange = (value: boolean) => {
  void themeStore.setFollowSongAccent(value);
};

const handleStartupAnimationChange = (value: string) => {
  void themeStore.setStartupAnimation(value as StartupAnimationStyle);
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


const handleBrightnessChange = (val: number) => {
  void themeStore.setBackgroundBrightness(val);
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
@use "../settingLayout.scss";
.setting-con {
  .accent-setting {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 280px;
    max-width: 100%;
    flex-wrap: wrap;
  }

  .theme-mode-group {
    flex-shrink: 0;
  }

  .background-mode-select,
  .startup-animation-select {
    width: 180px;
    flex-shrink: 0;
  }

  .startup-preview-collapse {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .gradient-direction {
    width: 180px;
    flex-shrink: 0;
  }

  .gradient-setting-item {
    align-items: flex-start;
  }

  .gradient-colors {
    width: 100%;
    max-width: 400px;
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
    max-width: 100%;
    flex-wrap: wrap;
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
    border-radius: var(--radius-control);
    overflow: hidden;
    border: 1px solid var(--border-subtle);
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

}
</style>
