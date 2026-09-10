<template>
  <n-modal
    v-model:show="innerVisible"
    transform-origin="center"
    :mask-closable="true"
    @after-leave="handleAfterLeave">
    <n-card
      class="lyric-setting-card"
      :bordered="false"
      :content-style="{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '0',
        padding: '1.25rem',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }"
      role="dialog"
      aria-modal="true">
      <!-- 头部 -->
      <div class="modal-header">
        <div class="header-title">歌词设置</div>
        <div class="header-right">
          <n-button
            quaternary
            circle
            size="small"
            title="关闭"
            @click="handleClose">
            <template #icon>
              <n-icon :size="18"><X /></n-icon>
            </template>
          </n-button>
        </div>
      </div>

      <!-- 选项卡切换 -->
      <div class="modal-tabs">
        <n-tabs v-model:value="activeTab" type="segment" animated>
          <n-tab-pane name="bg" tab="歌词背景" />
          <n-tab-pane name="effect" tab="动效排版" />
          <n-tab-pane name="style" tab="字体颜色" />
        </n-tabs>
      </div>

      <!-- 内容主体 -->
      <div class="modal-body">
        <!-- 1. 歌词背景 -->
        <div v-show="activeTab === 'bg'" class="tab-pane-content">
          <!-- 背景模式选择 -->
          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">背景显示模式</div>
              <div class="row-desc">选择歌词全屏界面的视觉风格</div>
            </div>
            <div class="row-control">
              <n-radio-group
                :value="lyricStore.setting.backgroundMode || 'default'"
                size="small"
                @update:value="handleModeChange">
                <n-radio-button value="default">默认流光</n-radio-button>
                <n-radio-button value="image">自定义图片</n-radio-button>
              </n-radio-group>
            </div>
          </div>

          <!-- 自定义图片模式的详细配置 -->
          <template v-if="lyricStore.setting.backgroundMode === 'image'">
            <div class="setting-row">
              <div class="row-info">
                <div class="row-title">当前背景图片</div>
                <div class="row-desc">从图片库挑选或直接选择最近使用的图片</div>
              </div>
              <div class="row-control image-pick-control">
                <div class="current-thumb-wrap">
                  <img
                    v-if="lyricStore.setting.backgroundImage"
                    :src="lyricStore.setting.backgroundImage"
                    class="thumb-img"
                    alt="背景预览" />
                  <div v-else class="empty-thumb">无图片</div>
                </div>

                <!-- 最近 3 张快速切换 -->
                <div class="recent-thumbs">
                  <div
                    v-for="item in imageManager.latestThreeImages.value"
                    :key="item.id"
                    class="recent-thumb-item"
                    :class="{ active: lyricStore.setting.backgroundImage === item.url }"
                    :title="item.name"
                    @click="handleSelectImage(item.url)">
                    <img :src="item.url" class="recent-img" :alt="item.name" />
                  </div>
                </div>

                <!-- 打开图片库按钮 -->
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

            <!-- 背景模糊度 -->
            <div class="setting-row">
              <div class="row-info">
                <div class="row-title">背景模糊度</div>
                <div class="row-desc">调节歌词背景的虚化程度 (0-100)</div>
              </div>
              <div class="row-control slider-control">
                <button
                  type="button"
                  class="step-btn"
                  title="减少模糊度"
                  :disabled="(lyricStore.setting.backgroundBlur ?? 0) <= 0"
                  @click="handleStepBlur(-1)">
                  <n-icon :size="14"><Minus /></n-icon>
                </button>
                <div class="slider-wrap">
                  <n-slider
                    :value="lyricStore.setting.backgroundBlur ?? 0"
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
                  :disabled="(lyricStore.setting.backgroundBlur ?? 0) >= 100"
                  @click="handleStepBlur(1)">
                  <n-icon :size="14"><Plus /></n-icon>
                </button>
                <span class="val-text">{{ lyricStore.setting.backgroundBlur ?? 0 }}%</span>
              </div>
            </div>

            <!-- 背景亮度 -->
            <div class="setting-row">
              <div class="row-info">
                <div class="row-title">背景亮度</div>
                <div class="row-desc">调节背景图片的明暗程度 (0-100%)</div>
              </div>
              <div class="row-control slider-control">
                <button
                  type="button"
                  class="step-btn"
                  title="降低亮度"
                  :disabled="(lyricStore.setting.backgroundBrightness ?? 100) <= 0"
                  @click="handleStepBrightness(-1)">
                  <n-icon :size="14"><Minus /></n-icon>
                </button>
                <div class="slider-wrap">
                  <n-slider
                    :value="lyricStore.setting.backgroundBrightness ?? 100"
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
                  :disabled="(lyricStore.setting.backgroundBrightness ?? 100) >= 100"
                  @click="handleStepBrightness(1)">
                  <n-icon :size="14"><Plus /></n-icon>
                </button>
                <span class="val-text">{{ lyricStore.setting.backgroundBrightness ?? 100 }}%</span>
              </div>
            </div>
          </template>

          <!-- 恢复默认操作 -->
          <div class="reset-row">
            <n-button
              secondary
              round
              size="small"
              @click="handleResetDefault">
              <template #icon>
                <n-icon :size="14"><RotateCcw /></n-icon>
              </template>
              恢复默认背景（专辑流光）
            </n-button>
          </div>
        </div>

        <!-- 2. 动效与排版 -->
        <div v-show="activeTab === 'effect'" class="tab-pane-content">
          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">使用 AM Lyric</div>
              <div class="row-desc">启用类似 Apple Music 的细腻动效渲染</div>
            </div>
            <div class="row-control">
              <n-switch v-model:value="lyricStore.setting.useAMLyric" />
            </div>
          </div>

          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">逐字歌词</div>
              <div class="row-desc">优先匹配逐字逐句的卡拉OK动效 (KRC/YRC)</div>
            </div>
            <div class="row-control">
              <n-switch v-model:value="lyricStore.setting.useKRC" />
            </div>
          </div>

          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">水平纯净居中</div>
              <div class="row-desc">歌词在视图中居中呈现</div>
            </div>
            <div class="row-control">
              <n-switch v-model:value="lyricStore.setting.pureLyricMode" />
            </div>
          </div>

          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">对齐位置</div>
              <div class="row-desc">当前播放歌词行在垂直方向的位置 (0.5 为正中)</div>
            </div>
            <div class="row-control">
              <n-input-number
                v-model:value="lyricStore.setting.alignPosition"
                :min="0.1"
                :max="0.9"
                :step="0.1"
                size="small"
                style="width: 110px" />
            </div>
          </div>

          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">当前行放大</div>
              <div class="row-desc">正在播放的歌词行获得平滑缩放增强</div>
            </div>
            <div class="row-control">
              <n-switch v-model:value="lyricStore.setting.useAMScale" />
            </div>
          </div>

          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">背景行模糊</div>
              <div class="row-desc">弱化未播放歌词行，聚焦当前唱词</div>
            </div>
            <div class="row-control">
              <n-switch v-model:value="lyricStore.setting.useAMBlur" />
            </div>
          </div>
        </div>

        <!-- 3. 字体与颜色 -->
        <div v-show="activeTab === 'style'" class="tab-pane-content">
          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">字体大小</div>
              <div class="row-desc">歌词主文字像素大小 (16-60px)</div>
            </div>
            <div class="row-control">
              <n-input-number
                v-model:value="lyricStore.setting.lyricFontSize"
                :min="16"
                :max="60"
                size="small"
                style="width: 110px" />
            </div>
          </div>

          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">字体系列</div>
              <div class="row-desc">歌词呈现采用的字体</div>
            </div>
            <div class="row-control">
              <n-select
                v-model:value="lyricStore.setting.lyricFont"
                :options="fontOptions"
                size="small"
                style="width: 180px" />
            </div>
          </div>

          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">字体加粗</div>
              <div class="row-desc">增强文字粗细，提高在复杂背景下的辨识度</div>
            </div>
            <div class="row-control">
              <n-switch v-model:value="lyricStore.setting.lyricFontWeight" />
            </div>
          </div>

          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">字体投影</div>
              <div class="row-desc">添加文字外发光暗影，抗背景干扰</div>
            </div>
            <div class="row-control">
              <n-switch v-model:value="lyricStore.setting.lyricFontShadow" />
            </div>
          </div>

          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">字体透明度</div>
              <div class="row-desc">歌词行默认不透明度 (0.1 - 1.0)</div>
            </div>
            <div class="row-control">
              <n-input-number
                v-model:value="lyricStore.setting.lyricFontOpacity"
                :min="0.1"
                :max="1"
                :step="0.1"
                size="small"
                style="width: 110px" />
            </div>
          </div>

          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">字体颜色</div>
              <div class="row-desc">普通歌词行色彩</div>
            </div>
            <div class="row-control">
              <n-color-picker
                v-model:value="lyricStore.setting.lyricFontColor"
                size="small"
                :show-alpha="false"
                :modes="['hex']"
                style="width: 130px" />
            </div>
          </div>

          <div class="setting-row">
            <div class="row-info">
              <div class="row-title">当前行颜色</div>
              <div class="row-desc">正在播放行的高亮色彩（非 AM Lyric 模式）</div>
            </div>
            <div class="row-control">
              <n-color-picker
                v-model:value="lyricStore.setting.currentLyricColor"
                size="small"
                :show-alpha="false"
                :modes="['hex']"
                style="width: 130px" />
            </div>
          </div>
        </div>
      </div>

      <!-- 图片库选择弹窗 -->
      <AppImageCenterModal
        v-model:show="showImageCenterModal"
        :current-url="lyricStore.setting.backgroundImage || ''"
        @confirm="handleConfirmFromImageCenter" />
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import {
  NButton,
  NCard,
  NColorPicker,
  NIcon,
  NInputNumber,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSwitch,
  NTabPane,
  NTabs,
} from "naive-ui";
import { Images, Minus, Plus, RotateCcw, X } from "lucide-vue-next";
import { useLyricStore } from "@/store/lyricStore";
import { useImageManager } from "@/composables/useImageManager";
import AppImageCenterModal from "@/components/common/AppImageCenterModal.vue";

const props = withDefaults(
  defineProps<{
    show?: boolean;
  }>(),
  {
    show: false,
  }
);

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "close"): void;
}>();

const lyricStore = useLyricStore();
const imageManager = useImageManager();

const innerVisible = ref(props.show);
const activeTab = ref<"bg" | "effect" | "style">("bg");
const showImageCenterModal = ref(false);

watch(
  () => props.show,
  (val) => {
    innerVisible.value = val;
    if (val) {
      void imageManager.loadImages();
    }
  }
);

watch(innerVisible, (val) => {
  emit("update:show", val);
});

// 监听所有设置变动并持久化
watch(
  () => lyricStore.setting,
  () => {
    lyricStore.saveSetting();
  },
  { deep: true }
);

watch(
  () => lyricStore.setting.useKRC,
  () => {
    void lyricStore.sendToLyricWindow();
  }
);

function handleModeChange(mode: "default" | "image") {
  lyricStore.setting.backgroundMode = mode;
  // 若切换为图片模式但尚未选过图片，自动将最新一张图作为默认
  if (mode === "image" && !lyricStore.setting.backgroundImage) {
    const firstImg = imageManager.allImages.value[0]?.url;
    if (firstImg) {
      lyricStore.setting.backgroundImage = firstImg;
    }
  }
}

function handleSelectImage(url: string) {
  lyricStore.setting.backgroundMode = "image";
  lyricStore.setting.backgroundImage = url;
}

function handleConfirmFromImageCenter(url: string) {
  lyricStore.setting.backgroundMode = "image";
  lyricStore.setting.backgroundImage = url;
}

function handleBlurChange(val: number) {
  lyricStore.setting.backgroundBlur = val;
}

function handleStepBlur(delta: number) {
  const current = lyricStore.setting.backgroundBlur ?? 0;
  lyricStore.setting.backgroundBlur = Math.max(0, Math.min(100, current + delta));
}

function handleBrightnessChange(val: number) {
  lyricStore.setting.backgroundBrightness = val;
}

function handleStepBrightness(delta: number) {
  const current = lyricStore.setting.backgroundBrightness ?? 100;
  lyricStore.setting.backgroundBrightness = Math.max(0, Math.min(100, current + delta));
}

function handleResetDefault() {
  lyricStore.resetBackgroundToDefault();
  window.$message?.success("已恢复为默认歌词背景");
}

function handleClose() {
  innerVisible.value = false;
  emit("close");
}

function handleAfterLeave() {
  // 可处理清理逻辑
}

const fontOptions = [
  { label: "默认系统字体", value: "Microsoft YaHei" },
  { label: "微软雅黑", value: "Microsoft YaHei" },
  { label: "苹方 (PingFang SC)", value: "PingFang SC" },
  { label: "思源黑体", value: "Source Han Sans SC" },
  { label: "思源宋体", value: "Source Han Serif SC" },
  { label: "黑体 (SimHei)", value: "SimHei" },
  { label: "楷体 (KaiTi)", value: "KaiTi" },
  { label: "等线 (DengXian)", value: "DengXian" },
  { label: "幼圆 (YouYuan)", value: "YouYuan" },
  { label: "Arial", value: "Arial" },
  { label: "Times New Roman", value: "Times New Roman" },
];
</script>

<style lang="scss" scoped>
:global(.lyric-setting-card.n-card) {
  width: 740px;
  max-width: calc(100vw - 32px);
  height: 550px;
  max-height: 85vh;
  border-radius: 20px;
  background: rgba(72, 79, 93, 0.76) !important;
  backdrop-filter: blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:global(.lyric-setting-card.n-card > .n-card__content) {
  background: transparent !important;
}

.modal-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
  min-height: 36px;

  .header-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 16px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    user-select: none;
    pointer-events: none;
  }

  .header-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    z-index: 1;

    :deep(.n-button) {
      color: rgba(255, 255, 255, 0.75);
      &:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.12);
      }
    }
  }
}

.modal-tabs {
  padding: 0.75rem 0 0.5rem;
  flex-shrink: 0;

  :deep(.n-tabs.n-tabs--segment-type) {
    --n-tab-color-segment: rgba(255, 255, 255, 0.22) !important;
    --n-tab-text-color: rgba(255, 255, 255, 0.72) !important;
    --n-tab-text-color-hover: #ffffff !important;
    --n-tab-text-color-active: #ffffff !important;
    --n-tab-text-color-disabled: rgba(255, 255, 255, 0.35) !important;
    --n-tab-border-radius: 8px !important;
    --n-color-segment: rgba(0, 0, 0, 0.25) !important;
  }

  :deep(.n-tabs.n-tabs--segment-type .n-tabs-rail) {
    background-color: rgba(0, 0, 0, 0.25) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    border-radius: 10px !important;
    padding: 3px !important;
  }

  :deep(.n-tabs.n-tabs--segment-type .n-tabs-capsule),
  :deep(.n-tabs.n-tabs--segment-type .n-tabs-capsule .n-tabs-capsule__bar) {
    background-color: rgba(255, 255, 255, 0.22) !important;
    border-radius: 8px !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
  }

  :deep(.n-tabs.n-tabs--segment-type .n-tabs-pad) {
    background: transparent !important;
  }

  :deep(.n-tabs.n-tabs--segment-type .n-tabs-tab) {
    color: rgba(255, 255, 255, 0.72) !important;
    font-weight: 500 !important;
    transition: all 0.2s ease !important;
    border-radius: 8px !important;

    &:hover {
      color: #ffffff !important;
    }

    &.n-tabs-tab--active {
      color: #ffffff !important;
      font-weight: 600 !important;
      background-color: transparent !important;
    }
  }
}

.modal-body {
  flex: 1;
  min-height: 0;
  overflow-x: hidden !important;
  overflow-y: auto;
  padding: 0.5rem 8px 0.5rem 0;
  user-select: none;
  box-sizing: border-box;

  &::-webkit-scrollbar {
    width: 6px;
    height: 0;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;

    &:hover {
      background: rgba(255, 255, 255, 0.35);
    }
  }
}

.tab-pane-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  transition: all 0.18s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.25);
    border-color: rgba(255, 255, 255, 0.16);
  }

  .row-info {
    flex: 1 1 auto;
    min-width: 0;

    .row-title {
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.94);
      line-height: 1.4;
    }

    .row-desc {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.4;
      margin-top: 2px;
    }
  }

  .row-control {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
}

:deep(.n-radio-button) {
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 0.14);
}

:deep(.n-radio-button.n-radio-button--checked) {
  background: var(--color-primary) !important;
  color: #ffffff !important;
  border-color: var(--color-primary) !important;
}

:deep(.n-button--secondary-type) {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.16);
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }
}

:deep(.n-input),
:deep(.n-input-number),
:deep(.n-select .n-base-selection) {
  background: rgba(0, 0, 0, 0.22) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
}

:deep(.n-color-picker) {
  width: 130px !important;
  border-radius: 8px !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  background: rgba(255, 255, 255, 0.08) !important;
  box-sizing: border-box;
}

:deep(.n-color-picker-trigger) {
  border: none !important;
  height: 28px !important;
  box-sizing: border-box;
}

:deep(.n-color-picker-trigger__value) {
  font-size: 12px !important;
  font-weight: 500 !important;
}

:deep(.n-input__input-el) {
  color: #ffffff !important;
}

.image-pick-control {
  gap: 12px;

  .current-thumb-wrap {
    width: 52px;
    height: 36px;
    border-radius: 8px;
    overflow: hidden;
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.25);
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
      color: rgba(255, 255, 255, 0.5);
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
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 40%, transparent);
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
  gap: 8px;

  .slider-wrap {
    width: 160px;
  }

  .step-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.88);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
      border-color: var(--color-primary);
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  }

  .val-text {
    width: 44px;
    text-align: right;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.75);
  }
}

.reset-row {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
}
</style>
