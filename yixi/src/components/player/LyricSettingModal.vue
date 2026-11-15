<template>
  <AppModal :show="innerVisible" title="播放页设置" :icon="Settings2" :width="720" @update:show="value => !value && handleClose()" @after-leave="handleAfterLeave">
    <div class="lyric-settings">
      <n-tabs v-model:value="activeTab" type="segment" animated class="setting-tabs">
        <n-tab-pane name="bg" tab="歌词背景" />
        <n-tab-pane name="effect" tab="动效排版" />
        <n-tab-pane name="style" tab="字体颜色" />
      </n-tabs>
      <div class="settings-panels">
        <div v-show="activeTab === 'bg'" class="settings-stack">
          <SettingSection title="背景显示" description="调整全屏播放界面的背景。">
            <template #actions><n-button secondary round size="small" @click="handleResetDefault"><template #icon><n-icon :component="RotateCcw" /></template>恢复默认</n-button></template>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">显示模式</div><p class="row-desc">选择流光或自定义图片背景。</p></div>
            <div class="row-control"><n-select :value="lyricStore.setting.backgroundMode || 'default'" :options="backgroundOptions" class="select-control" @update:value="handleModeChange" /></div>
          </div>
          <div v-if="lyricStore.setting.backgroundMode === 'image'" class="setting-row image-row">
            <div class="row-info"><div class="row-title">背景图片</div><p class="row-desc">选择图片库或最近使用的图片。</p></div>
            <div class="row-control image-pick-control">
              <div class="current-thumb-wrap">
                <img v-if="lyricStore.setting.backgroundImage" :src="lyricStore.setting.backgroundImage" alt="当前背景" />
                <span v-else>无图片</span>
              </div>
              <div class="recent-thumbs">
                <button v-for="item in imageManager.latestThreeImages.value" :key="item.id" type="button" class="recent-thumb-item" :class="{ active: lyricStore.setting.backgroundImage === item.url }" :title="item.name" :aria-label="`使用背景：${item.name}`" @click="handleSelectImage(item.url)">
                  <img :src="item.url" :alt="item.name" />
                </button>
              </div>
              <n-button secondary round @click="showImageCenterModal = true"><template #icon><n-icon :component="Images" /></template>图片库</n-button>
            </div>
          </div>
          </SettingSection>
          <SettingSection v-if="lyricStore.setting.backgroundMode === 'image'" title="背景调节" description="保持图片内容与歌词之间的清晰层次。">
          <div class="setting-row">
            <div class="row-info"><div class="row-title">模糊度</div><p class="row-desc">柔化背景细节，减少视觉干扰。</p></div>
            <div class="row-control"><SettingAdjustment :value="lyricStore.setting.backgroundBlur ?? 0" label="背景模糊度" @update:value="handleBlurChange" /></div>
          </div>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">亮度</div><p class="row-desc">调整背景图片的明暗程度。</p></div>
            <div class="row-control"><SettingAdjustment :value="lyricStore.setting.backgroundBrightness ?? 100" label="背景亮度" @update:value="handleBrightnessChange" /></div>
          </div>
          </SettingSection>
        </div>
        <div v-show="activeTab === 'effect'" class="settings-stack">
          <SettingSection title="歌词渲染" description="管理歌词动画与当前行效果。">
          <div class="setting-row">
            <div class="row-info"><div class="row-title">AM Lyric</div><p class="row-desc">使用 Apple Music 风格的歌词渲染动效。</p></div>
            <div class="row-control"><n-switch v-model:value="lyricStore.setting.useAMLyric" aria-label="AM Lyric" /></div>
          </div>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">逐字歌词</div><p class="row-desc">优先使用 KRC / YRC 的逐字时间信息。</p></div>
            <div class="row-control"><n-switch v-model:value="lyricStore.setting.useKRC" aria-label="逐字歌词" /></div>
          </div>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">当前行放大</div><p class="row-desc">平滑放大正在播放的歌词行。</p></div>
            <div class="row-control"><n-switch v-model:value="lyricStore.setting.useAMScale" aria-label="当前行放大" /></div>
          </div>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">背景行模糊</div><p class="row-desc">弱化非当前歌词行，聚焦正在播放的唱词。</p></div>
            <div class="row-control"><n-switch v-model:value="lyricStore.setting.useAMBlur" aria-label="背景行模糊" /></div>
          </div>
          </SettingSection>
          <SettingSection title="播放排版" description="调整封面显隐和歌词位置。">
          <div class="setting-row">
            <div class="row-info"><div class="row-title">沉浸式播放</div><p class="row-desc">控制面板隐藏时，同时隐藏封面和歌曲信息。</p></div>
            <div class="row-control"><n-switch v-model:value="lyricStore.setting.immersiveMode" aria-label="沉浸式播放" /></div>
          </div>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">水平居中</div><p class="row-desc">歌词在播放视图中水平居中。</p></div>
            <div class="row-control"><n-switch v-model:value="lyricStore.setting.pureLyricMode" aria-label="水平居中" /></div>
          </div>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">垂直对齐</div><p class="row-desc">当前歌词行在视图中的位置，0.5 为正中。</p></div>
            <div class="row-control"><n-input-number v-model:value="lyricStore.setting.alignPosition" :min="0.1" :max="0.9" :step="0.1" class="number-control" /></div>
          </div>
          </SettingSection>
        </div>
        <div v-show="activeTab === 'style'" class="settings-stack">
          <SettingSection title="字体样式" description="调整字体、大小和文字层次。">
          <div class="setting-row">
            <div class="row-info"><div class="row-title">字体大小</div><p class="row-desc">歌词主文字大小，范围 16–60px。</p></div>
            <div class="row-control"><n-input-number v-model:value="lyricStore.setting.lyricFontSize" :min="16" :max="60" class="number-control" /></div>
          </div>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">字体系列</div><p class="row-desc">选择歌词使用的字体。</p></div>
            <div class="row-control"><n-select v-model:value="lyricStore.setting.lyricFont" :options="fontOptions" class="select-control" /></div>
          </div>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">字体加粗</div><p class="row-desc">提高歌词文字的辨识度。</p></div>
            <div class="row-control"><n-switch v-model:value="lyricStore.setting.lyricFontWeight" aria-label="字体加粗" /></div>
          </div>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">文字投影</div><p class="row-desc">在复杂背景上增加文字的层次。</p></div>
            <div class="row-control"><n-switch v-model:value="lyricStore.setting.lyricFontShadow" aria-label="文字投影" /></div>
          </div>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">字体透明度</div><p class="row-desc">普通歌词行的不透明度，范围 0.1–1。</p></div>
            <div class="row-control"><n-input-number v-model:value="lyricStore.setting.lyricFontOpacity" :min="0.1" :max="1" :step="0.1" class="number-control" /></div>
          </div>
          </SettingSection>
          <SettingSection title="歌词颜色" description="可手动选择颜色，或从当前歌词背景取色。">
          <div class="setting-row">
            <div class="row-info"><div class="row-title">字体颜色</div><p class="row-desc">普通歌词行的文字颜色。</p></div>
            <div class="row-control"><n-color-picker v-model:value="lyricStore.setting.lyricFontColor" :show-alpha="false" placement="top-end" :modes="['hex']" class="color-control" />
              <n-button secondary round :loading="extractingTarget === 'font'" @click="handleExtractColor('font')"><template #icon><n-icon :component="Pipette" /></template>背景取色</n-button></div>
          </div>
          <div class="setting-row">
            <div class="row-info"><div class="row-title">当前行颜色</div><p class="row-desc">非 AM Lyric 模式下当前行的高亮颜色。</p></div>
            <div class="row-control"><n-color-picker v-model:value="lyricStore.setting.currentLyricColor" :show-alpha="false" placement="top-end" :modes="['hex']" class="color-control" />
              <n-button secondary round :loading="extractingTarget === 'current'" @click="handleExtractColor('current')"><template #icon><n-icon :component="Pipette" /></template>背景取色</n-button></div>
          </div>
          </SettingSection>
        </div>
      </div>
    </div>
  </AppModal>
  <AppImageCenterModal v-model:show="showImageCenterModal" :current-url="lyricStore.setting.backgroundImage || ''" @confirm="handleConfirmFromImageCenter" />
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import {
  NButton,
  NColorPicker,
  NIcon,
  NInputNumber,
  NSelect,
  NSwitch,
  NTabPane,
  NTabs,
  useMessage,
} from "naive-ui";
import { Images, Pipette, RotateCcw, Settings2 } from "lucide-vue-next";
import { useLyricStore } from "@/store/lyricStore";
import { useThemeStore } from "@/store/theme";
import { extractDominantColorFromUrl } from "@/utils/imageColor";
import { useImageManager } from "@/composables/useImageManager";
import AppModal from "@/components/common/AppModal.vue";
import SettingSection from "@/components/setting/SettingSection.vue";
import SettingAdjustment from "@/components/setting/SettingAdjustment.vue";
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
const themeStore = useThemeStore();
const imageManager = useImageManager();
const message = useMessage();

const extractingTarget = ref<"font" | "current" | null>(null);

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

function resolveImageUrl(url: string): string {
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("file://")
  ) {
    return url;
  }
  if (/^[a-zA-Z]:[\\/]/.test(url)) {
    return url;
  }
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

function getActiveBackgroundImage(): string {
  // 严格从歌词背景图片中取色：优先歌词自定义背景，其次全局主题背景图片，绝不取封面
  if (lyricStore.setting.backgroundImage) {
    return lyricStore.setting.backgroundImage;
  }
  if (themeStore.backgroundImage) {
    return themeStore.backgroundImage;
  }
  return "";
}

async function handleExtractColor(target: "font" | "current") {
  const rawUrl = getActiveBackgroundImage();
  if (!rawUrl) {
    message.warning("未检测到歌词背景图片，请先在【歌词背景】中选择图片");
    return;
  }
  const imageUrl = resolveImageUrl(rawUrl);
  extractingTarget.value = target;
  try {
    const color = await extractDominantColorFromUrl(imageUrl);
    if (color) {
      if (target === "font") {
        lyricStore.setting.lyricFontColor = color;
      } else {
        lyricStore.setting.currentLyricColor = color;
      }
      lyricStore.saveSetting();
      message.success(`已从歌词背景提取主色：${color}`);
    } else {
      message.warning("未能从背景图片中提取到合适颜色");
    }
  } catch (err) {
    console.error("提取歌词背景主色失败", err);
    message.error("提取歌词背景颜色失败");
  } finally {
    extractingTarget.value = null;
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

function handleBrightnessChange(val: number) {
  lyricStore.setting.backgroundBrightness = val;
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

const backgroundOptions = [
  { label: "默认流光", value: "default" },
  { label: "自定义图片", value: "image" },
];

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

<style scoped lang="scss">
.lyric-settings { display: grid; gap: 16px; min-width: 0; }
.setting-tabs :deep(.n-tabs-pane-wrapper) { display: none; }
.settings-panels { height: min(460px, calc(100vh - 260px)); min-height: 100px; overflow-y: auto; padding-right: 4px; }
.settings-stack { display: grid; gap: 16px; }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 0; border-bottom: 1px solid var(--border-subtle); min-width: 0; }
.setting-row:last-child { border-bottom: 0; padding-bottom: 0; }
.row-info { flex: 1; min-width: 0; }
.row-title { color: var(--text-primary); font-size: 14px; font-weight: 600; line-height: 1.5; }
.row-desc { margin: 4px 0 0; color: var(--text-secondary); font-size: 12px; line-height: 1.6; }
.row-control { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-shrink: 0; max-width: 100%; }
.select-control { width: 190px; }
.number-control { width: 120px; }
.color-control { width: 120px; }
.image-row { align-items: flex-start; flex-wrap: wrap; }
.image-pick-control { flex-wrap: wrap; }
.current-thumb-wrap { display: grid; place-items: center; width: 60px; height: 44px; border: 1px solid var(--border-subtle); border-radius: 12px; overflow: hidden; color: var(--text-secondary); background: var(--surface-input); font-size: 12px; }
.current-thumb-wrap img, .recent-thumb-item img { width: 100%; height: 100%; object-fit: cover; }
.recent-thumbs { display: flex; align-items: center; gap: 8px; }
.recent-thumb-item { width: 44px; height: 34px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 12px; background: var(--surface-input); cursor: pointer; }
.recent-thumb-item:hover, .recent-thumb-item:focus-visible { border-color: var(--text-accent); }
.recent-thumb-item.active { border-color: var(--text-accent); }
@media (max-width: 680px) { .setting-row { flex-wrap: wrap; gap: 12px; } .row-control { margin-left: auto; } }
</style>
