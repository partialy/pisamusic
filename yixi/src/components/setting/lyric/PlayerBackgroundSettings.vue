<template>
  <SettingSection title="播放界面背景" description="选择封面流光或自定义图片背景。">
    <template #actions>
      <n-button secondary size="small" @click="resetBackground">
        <template #icon><RotateCcw :size="14" /></template>恢复默认背景
      </n-button>
    </template>
    <LyricSettingRow title="背景模式">
      <n-select :value="setting.backgroundMode" :options="backgroundOptions" @update:value="changeMode" />
    </LyricSettingRow>
    <template v-if="setting.backgroundMode === 'image'">
      <LyricSettingRow title="背景图片" description="从图片库或最近使用的图片中选择。" wide>
        <div class="current-image">
          <img v-if="setting.backgroundImage" :src="setting.backgroundImage" alt="当前播放背景" />
          <span v-else>无图片</span>
        </div>
        <div class="recent-images">
          <button v-for="image in latestThreeImages" :key="image.id" type="button"
            :class="{ active: image.url === setting.backgroundImage }" :title="image.name"
            :aria-label="`使用背景：${image.name}`" @click="selectImage(image.url)">
            <img :src="image.url" :alt="image.name" />
          </button>
        </div>
        <n-button secondary size="small" @click="showImageCenter = true">
          <template #icon><Images :size="16" /></template>图片库
        </n-button>
      </LyricSettingRow>
      <LyricSettingRow title="背景模糊度" description="柔化图片细节，减少歌词阅读干扰。" wide>
        <SettingAdjustment :value="setting.backgroundBlur" label="播放背景模糊度"
          v-bind="ranges.backgroundBlur" @update:value="value => lyric.updateSetting({ backgroundBlur: value })" />
      </LyricSettingRow>
      <LyricSettingRow title="背景亮度" wide>
        <SettingAdjustment :value="setting.backgroundBrightness" label="播放背景亮度"
          v-bind="ranges.backgroundBrightness" @update:value="value => lyric.updateSetting({ backgroundBrightness: value })" />
      </LyricSettingRow>
    </template>
    <n-collapse v-else class="advanced-settings">
      <n-collapse-item title="流光进阶调节" name="background">
        <LyricSettingRow title="流动速度" description="0 为停止流动，数值越大流动越快。">
          <n-input-number :value="setting.backgroundFlowSpeed" v-bind="ranges.backgroundFlowSpeed"
            @update:value="value => lyric.updateSetting({ backgroundFlowSpeed: value ?? defaults.backgroundFlowSpeed })" />
        </LyricSettingRow>
        <LyricSettingRow title="动画帧率" description="较高帧率会增加图形资源占用。">
          <n-select :value="setting.backgroundFps" :options="fpsOptions"
            @update:value="value => lyric.updateSetting({ backgroundFps: value })" />
        </LyricSettingRow>
        <LyricSettingRow title="渲染清晰度" description="降低渲染比例可以减少图形资源占用。">
          <n-select :value="setting.backgroundRenderScale" :options="scaleOptions"
            @update:value="value => lyric.updateSetting({ backgroundRenderScale: value })" />
        </LyricSettingRow>
      </n-collapse-item>
    </n-collapse>
  </SettingSection>
  <AppImageCenterModal v-model:show="showImageCenter" :current-url="setting.backgroundImage" @confirm="selectImage" />
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { NButton, NCollapse, NCollapseItem, NInputNumber, NSelect, useMessage } from "naive-ui";
import { Images, RotateCcw } from "lucide-vue-next";
import { useLyricStore } from "@/store/lyricStore";
import { getDefaultLyricSetting, LYRIC_SETTING_RANGES as ranges } from "@/utils/lyricSettings";
import { useImageManager } from "@/composables/useImageManager";
import AppImageCenterModal from "@/components/common/AppImageCenterModal.vue";
import SettingSection from "../SettingSection.vue";
import SettingAdjustment from "../SettingAdjustment.vue";
import LyricSettingRow from "./LyricSettingRow.vue";

const lyric = useLyricStore();
const { setting } = storeToRefs(lyric);
const defaults = getDefaultLyricSetting();
const imageManager = useImageManager();
const { latestThreeImages } = imageManager;
const showImageCenter = ref(false);
const message = useMessage();
const backgroundOptions = [{ label: "封面流光", value: "default" }, { label: "自定义图片", value: "image" }];
const fpsOptions = [30, 60, 120].map(value => ({ label: `${value} FPS`, value }));
const scaleOptions = [0.25, 0.5, 0.75, 1].map(value => ({ label: `${value * 100}%`, value }));

onMounted(() => { void imageManager.loadImages(); });

async function changeMode(mode: "default" | "image") {
  lyric.updateSetting({ backgroundMode: mode });
  if (mode !== "image" || setting.value.backgroundImage) return;
  await imageManager.loadImages();
  if (setting.value.backgroundMode === "image" && !setting.value.backgroundImage) {
    const image = imageManager.allImages.value[0];
    if (image) lyric.updateSetting({ backgroundImage: image.url });
  }
}

function selectImage(url: string) {
  lyric.updateSetting({ backgroundMode: "image", backgroundImage: url });
}

function resetBackground() {
  lyric.resetBackgroundToDefault();
  message.success("已恢复默认播放背景");
}
</script>

<style scoped lang="scss">
.current-image { display: grid; place-items: center; width: 60px; height: 44px; overflow: hidden; border: 1px solid var(--border-subtle); border-radius: var(--radius-control); background: var(--surface-input); font-size: 11px; color: var(--text-secondary); flex-shrink: 0; }
.current-image img, .recent-images img { width: 100%; height: 100%; object-fit: cover; }
.recent-images { display: flex; align-items: center; gap: 6px; }
.recent-images button { display: block; width: 38px; height: 32px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: var(--radius-control); background: var(--surface-input); cursor: pointer; }
.recent-images button:hover, .recent-images button.active { border-color: var(--text-accent); }
.recent-images button:focus-visible { outline: 2px solid var(--text-accent); outline-offset: 2px; }
.advanced-settings { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
</style>
