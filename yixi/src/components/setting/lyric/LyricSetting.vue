<template>
  <div class="lyric-setting">
    <section class="setting-card">
      <div class="section-header">
        <div>
          <h3>歌词界面背景</h3>
          <p>设置全屏主播放器界面的背景风格与效果。</p>
        </div>
        <n-button
          secondary
          round
          size="small"
          @click="handleResetDefault">
          <template #icon>
            <n-icon :size="14"><RotateCcw /></n-icon>
          </template>
          恢复默认
        </n-button>
      </div>

      <div class="setting-grid">
        <div class="setting-item wide">
          <div class="item-info">
            <div class="item-title">背景显示模式</div>
            <div class="item-desc">切换默认专辑流光或自定义图片背景。</div>
          </div>
          <div class="setting-control switch-control">
            <n-radio-group
              :value="setting.backgroundMode || 'default'"
              size="small"
              @update:value="handleModeChange">
              <n-radio-button value="default">默认流光</n-radio-button>
              <n-radio-button value="image">自定义图片</n-radio-button>
            </n-radio-group>
          </div>
        </div>

        <template v-if="setting.backgroundMode === 'image'">
          <div class="setting-item wide">
            <div class="item-info">
              <div class="item-title">当前背景图片</div>
              <div class="item-desc">选择自定义背景图片，或从图片库中挑选。</div>
            </div>
            <div class="setting-control image-pick-control wide-control">
              <div class="current-thumb-wrap">
                <img
                  v-if="setting.backgroundImage"
                  :src="setting.backgroundImage"
                  class="thumb-img"
                  alt="背景预览" />
                <div v-else class="empty-thumb">无图片</div>
              </div>
              <div class="recent-thumbs">
                <div
                  v-for="item in imageManager.latestThreeImages.value"
                  :key="item.id"
                  class="recent-thumb-item"
                  :class="{ active: setting.backgroundImage === item.url }"
                  :title="item.name"
                  @click="handleSelectImage(item.url)">
                  <img :src="item.url" class="recent-img" :alt="item.name" />
                </div>
              </div>
              <n-button
                secondary
                round
                size="small"
                type="primary"
                @click="showImageCenterModal = true">
                <template #icon>
                  <n-icon :size="16"><Images /></n-icon>
                </template>
                图片库
              </n-button>
            </div>
          </div>

          <div class="setting-item wide">
            <div class="item-info">
              <div class="item-title">背景模糊度</div>
              <div class="item-desc">调节歌词背景虚化程度（0-100）。</div>
            </div>
            <div class="setting-control slider-control">
              <button
                type="button"
                class="step-btn"
                title="减少模糊度"
                :disabled="(setting.backgroundBlur ?? 0) <= 0"
                @click="handleStepBlur(-1)">
                <n-icon :size="14"><Minus /></n-icon>
              </button>
              <div class="slider-wrap">
                <n-slider
                  :value="setting.backgroundBlur ?? 0"
                  :min="0"
                  :max="100"
                  :step="1"
                  :tooltip="false"
                  @update:value="handleBlurChange" />
              </div>
              <button
                type="button"
                class="step-btn"
                title="增加模糊度"
                :disabled="(setting.backgroundBlur ?? 0) >= 100"
                @click="handleStepBlur(1)">
                <n-icon :size="14"><Plus /></n-icon>
              </button>
              <span class="val-text">{{ setting.backgroundBlur ?? 0 }}%</span>
            </div>
          </div>

          <div class="setting-item wide">
            <div class="item-info">
              <div class="item-title">背景亮度</div>
              <div class="item-desc">调节背景图片的明暗程度（0-100%）。</div>
            </div>
            <div class="setting-control slider-control">
              <button
                type="button"
                class="step-btn"
                title="降低亮度"
                :disabled="(setting.backgroundBrightness ?? 100) <= 0"
                @click="handleStepBrightness(-1)">
                <n-icon :size="14"><Minus /></n-icon>
              </button>
              <div class="slider-wrap">
                <n-slider
                  :value="setting.backgroundBrightness ?? 100"
                  :min="0"
                  :max="100"
                  :step="1"
                  :tooltip="false"
                  @update:value="handleBrightnessChange" />
              </div>
              <button
                type="button"
                class="step-btn"
                title="提高亮度"
                :disabled="(setting.backgroundBrightness ?? 100) >= 100"
                @click="handleStepBrightness(1)">
                <n-icon :size="14"><Plus /></n-icon>
              </button>
              <span class="val-text">{{ setting.backgroundBrightness ?? 100 }}%</span>
            </div>
          </div>
        </template>
      </div>
    </section>

    <section class="setting-card">
      <div class="section-header">
        <div>
          <h3>窗口歌词</h3>
          <p>控制主播放器里的歌词渲染效果。</p>
        </div>
      </div>

      <div class="setting-grid">
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">使用 AM Lyric</div>
            <div class="item-desc">启用更细腻的歌词动效渲染。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.useAMLyric" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">逐字歌词</div>
            <div class="item-desc">优先使用 KRC 逐字歌词数据。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.useKRC" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">水平居中</div>
            <div class="item-desc">歌词以纯净居中模式显示。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.pureLyricMode" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">对齐位置</div>
            <div class="item-desc">0.5 表示垂直居中。</div>
          </div>
          <div class="setting-control">
            <n-input-number v-model:value="setting.alignPosition" :min="0" :max="1" :step="0.1" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">放大效果</div>
            <div class="item-desc">当前歌词行获得轻微缩放。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.useAMScale" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">模糊效果</div>
            <div class="item-desc">弱化非当前歌词行。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.useAMBlur" />
          </div>
        </div>
      </div>
    </section>

    <section class="setting-card">
      <div class="section-header">
        <div>
          <h3>窗口歌词文字</h3>
          <p>调整主播放器歌词的字体、颜色和透明度。</p>
        </div>
      </div>

      <div class="setting-grid">
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体大小</div>
            <div class="item-desc">主播放器歌词字号。</div>
          </div>
          <div class="setting-control">
            <n-input-number v-model:value="setting.lyricFontSize" :min="12" :max="60" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体样式</div>
            <div class="item-desc">选择歌词显示字体。</div>
          </div>
          <div class="setting-control">
            <n-select v-model:value="setting.lyricFont" :options="fontFamily" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体颜色</div>
            <div class="item-desc">普通歌词行颜色。</div>
          </div>
          <div class="setting-control">
            <n-color-picker v-model:value="setting.lyricFontColor" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">当前行颜色</div>
            <div class="item-desc">非 AM Lyric 模式下生效。</div>
          </div>
          <div class="setting-control">
            <n-color-picker v-model:value="setting.currentLyricColor" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体加粗</div>
            <div class="item-desc">增强歌词可读性。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.lyricFontWeight" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体阴影</div>
            <div class="item-desc">在复杂封面背景下更清晰。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.lyricFontShadow" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体透明度</div>
            <div class="item-desc">范围 0.01 到 1。</div>
          </div>
          <div class="setting-control">
            <n-input-number v-model:value="setting.lyricFontOpacity" :step="0.1" :min="0.01" :max="1" />
          </div>
        </div>
      </div>
    </section>

    <section class="setting-card">
      <div class="section-header">
        <div>
          <h3>桌面歌词</h3>
          <p>独立桌面歌词窗口的显示与文字设置。</p>
        </div>
      </div>

      <div class="setting-grid">
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">启用桌面歌词</div>
            <div class="item-desc">打开独立桌面歌词窗口。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="desktop" @update:value="handleOpenDesktopLyric" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">覆盖任务栏</div>
            <div class="item-desc">开启后歌词窗口可拖动到任务栏区域。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="desktopLyric.overlayTaskbar" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">锁定桌面歌词</div>
            <div class="item-desc">锁定后鼠标可穿透歌词窗口，关闭后可拖动和显示控制栏。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="desktopLyric.locked" @update:value="handleDesktopLyricLock" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">窗口宽度</div>
            <div class="item-desc">桌面歌词窗口宽度，范围 500~1600。</div>
          </div>
          <div class="setting-control">
            <n-input-number v-model:value="desktopLyric.width" :min="500" :max="1600" :step="10" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">窗口高度</div>
            <div class="item-desc">桌面歌词窗口高度，范围 100~200。</div>
          </div>
          <div class="setting-control">
            <n-input-number v-model:value="desktopLyric.height" :min="100" :max="200" :step="10" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体颜色</div>
            <div class="item-desc">未播放歌词颜色。</div>
          </div>
          <div class="setting-control">
            <n-color-picker v-model:value="desktopLyric.textColor" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">已播放颜色</div>
            <div class="item-desc">已唱过部分的高亮色。</div>
          </div>
          <div class="setting-control">
            <n-color-picker v-model:value="desktopLyric.highlightColor" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体粗细</div>
            <div class="item-desc">范围 500 到 700。</div>
          </div>
          <div class="setting-control">
            <n-input-number v-model:value="desktopLyric.fontWeight" :step="100" :min="500" :max="700" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体大小</div>
            <div class="item-desc">桌面歌词字号。</div>
          </div>
          <div class="setting-control">
            <n-input-number
              v-model:value="desktopLyric.fontSize"
              :min="10"
              :max="64" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体样式</div>
            <div class="item-desc">桌面歌词字体。</div>
          </div>
          <div class="setting-control">
            <n-select
              v-model:value="desktopLyric.fontFamily"
              :options="fontFamily"
              value-field="value"
              label-field="label" />
          </div>
        </div>
      </div>
    </section>

    <!-- 图片库 Modal -->
    <AppImageCenterModal
      v-model:show="showImageCenterModal"
      :current-url="setting.backgroundImage || ''"
      @confirm="handleConfirmFromImageCenter" />
  </div>
</template>

<script setup lang="ts">
import {
  NButton,
  NColorPicker,
  NIcon,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSwitch,
} from "naive-ui";
import { Images, Minus, Plus, RotateCcw } from "lucide-vue-next";
import { useLyricStore } from "@/store/lyricStore";
import { useImageManager } from "@/composables/useImageManager";
import AppImageCenterModal from "@/components/common/AppImageCenterModal.vue";
import { storeToRefs } from "pinia";
import { onMounted, onUnmounted, ref, watch } from "vue";
import electronAPI from "@/utils/electron";
import { debounce } from "@/utils/common";

const lyric = useLyricStore();
const { setting, desktop, desktopLyric } = storeToRefs(lyric);
const imageManager = useImageManager();
const showImageCenterModal = ref(false);

function handleModeChange(mode: "default" | "image") {
  setting.value.backgroundMode = mode;
  if (mode === "image" && !setting.value.backgroundImage) {
    const first = imageManager.allImages.value[0]?.url;
    if (first) {
      setting.value.backgroundImage = first;
    }
  }
}

function handleSelectImage(url: string) {
  setting.value.backgroundMode = "image";
  setting.value.backgroundImage = url;
}

function handleConfirmFromImageCenter(url: string) {
  setting.value.backgroundMode = "image";
  setting.value.backgroundImage = url;
}

function handleBlurChange(val: number) {
  setting.value.backgroundBlur = val;
}

function handleStepBlur(delta: number) {
  const current = setting.value.backgroundBlur ?? 0;
  setting.value.backgroundBlur = Math.max(0, Math.min(100, current + delta));
}

function handleBrightnessChange(val: number) {
  setting.value.backgroundBrightness = val;
}

function handleStepBrightness(delta: number) {
  const current = setting.value.backgroundBrightness ?? 100;
  setting.value.backgroundBrightness = Math.max(0, Math.min(100, current + delta));
}

function handleResetDefault() {
  lyric.resetBackgroundToDefault();
  window.$message?.success("已恢复为默认歌词背景");
}

let unsubscribeBounds: (() => void) | null = null;
onMounted(() => {
  unsubscribeBounds = electronAPI.onBoundsChanged((bounds) => {
    lyric.syncBounds(bounds);
  });
});
onUnmounted(() => {
  unsubscribeBounds?.();
});

const fontFamily = [
  { key: 1, label: "微软雅黑", value: "Microsoft YaHei" },
  { key: 2, label: "黑体", value: "SimHei" },
  { key: 3, label: "宋体", value: "SimSun" },
  { key: 4, label: "楷体", value: "KaiTi" },
  { key: 5, label: "仿宋", value: "FangSong" },
  { key: 6, label: "隶书", value: "LiSu" },
  { key: 7, label: "幼圆", value: "YouYuan" },
  { key: 8, label: "等线", value: "DengXian" },
  { key: 9, label: "苹方", value: "PingFang SC" },
  { key: 10, label: "思源黑体", value: "Source Han Sans SC" },
  { key: 11, label: "思源宋体", value: "Source Han Serif SC" },
  { key: 12, label: "华文细黑", value: "STXihei" },
  { key: 13, label: "华文楷体", value: "STKaiti" },
  { key: 14, label: "华文宋体", value: "STSong" },
  { key: 15, label: "华文仿宋", value: "STFangsong" },
  { key: 16, label: "华文隶书", value: "STLiti" },
  { key: 17, label: "华文彩云", value: "STCaiyun" },
  { key: 18, label: "华文琥珀", value: "STHupo" },
  { key: 19, label: "华文行楷", value: "STXingkai" },
  { key: 20, label: "华文新魏", value: "STXinwei" },
  { key: 21, label: "Arial", value: "Arial" },
  { key: 22, label: "Times New Roman", value: "Times New Roman" },
  { key: 23, label: "Georgia", value: "Georgia" },
];

watch(
  () => setting.value,
  () => {
    lyric.saveSetting();
  },
  { deep: true }
);

watch(
  () => setting.value.useKRC,
  () => {
    void lyric.sendToLyricWindow();
  }
);

watch(
  () => desktopLyric.value,
  debounce(async () => {
    await lyric.saveDesktopLyricSetting();
    await lyric.sendConfig();
    electronAPI.lockLyric(desktopLyric.value.locked);
  }, 500),
  { deep: true }
);

const handleOpenDesktopLyric = async (value: boolean) => {
  if (value) {
    await electronAPI.openLyricWindow();
    lyric.sendToLyricWindow();
  } else {
    await electronAPI.closeLyricWindow();
  }
  lyric.setDesktop(value);
};

const handleDesktopLyricLock = (value: boolean) => {
  lyric.setDesktopLocked(value);
};
</script>

<style lang="scss" scoped>
.lyric-setting {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 20px;
}

.setting-card {
  padding: 18px;
  border: 1px solid var(--color-border-default);
  border-radius: 12px;
  // background: var(--color-card-bg);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;

  h3 {
    margin: 0;
    color: var(--color-text-default);
    font-size: 16px;
    font-weight: 700;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-text-secondary);
    font-size: 12px;
  }
}

.setting-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.setting-item {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 14px;
  border-radius: 10px;
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--color-setting-hover);
  }

  &.wide {
    grid-column: span 2;
  }
}

.item-info {
  flex: 1 1 auto;
  min-width: 0;
  padding-right: 12px;
}

.item-title {
  color: var(--color-text-default);
  font-size: 14px;
  font-weight: 600;
}

.item-desc {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.setting-control {
  width: 150px;
  flex-shrink: 0;
}

.switch-control {
  width: auto;
  min-width: 46px;
  display: flex;
  justify-content: flex-end;
}

.wide-control {
  width: min(420px, 42vw);
}

.image-pick-control {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;

  .current-thumb-wrap {
    width: 52px;
    height: 36px;
    border-radius: 8px;
    overflow: hidden;
    border: 1.5px solid var(--color-border-default);
    background: rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;

    .thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .empty-thumb {
      font-size: 11px;
      color: var(--color-text-secondary);
    }
  }

  .recent-thumbs {
    display: flex;
    align-items: center;
    gap: 6px;

    .recent-thumb-item {
      width: 38px;
      height: 28px;
      border-radius: 6px;
      overflow: hidden;
      border: 2px solid transparent;
      cursor: pointer;
      opacity: 0.78;
      transition: all 0.15s ease;

      &:hover {
        opacity: 1;
        transform: scale(1.06);
      }

      &.active {
        opacity: 1;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent);
      }

      .recent-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  }
}

.slider-control {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;

  .slider-wrap {
    width: 180px;
  }

  .step-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid var(--color-border-default);
    background: color-mix(in srgb, var(--color-bg-default) 90%, transparent);
    color: var(--color-text-default);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
  }

  .val-text {
    width: 44px;
    text-align: right;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-secondary);
  }
}

:deep(.setting-control .n-input-number),
:deep(.setting-control .n-select),
:deep(.setting-control .n-color-picker) {
  width: 100%;
}

@media (max-width: 1180px) {
  .setting-grid {
    grid-template-columns: 1fr;
  }

  .setting-item.wide {
    grid-column: auto;
  }

  .wide-control {
    width: min(360px, 44vw);
  }
}
</style>
