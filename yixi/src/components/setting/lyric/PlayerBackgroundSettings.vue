<template>
  <SettingSection title="播放界面背景" description="选择背景模式，展开后调整该模式的独立参数。">
    <template #actions><n-button secondary size="small" @click="lyric.resetBackgroundToDefault">恢复默认背景</n-button></template>
    <LyricSettingRow title="播放队列自动收起" description="开启后，播放页控制面板收起 1 秒后自动收起播放队列侧栏。">
      <n-switch :value="lyric.setting.autoCollapsePlayQueue" aria-label="播放队列自动收起"
        @update:value="value => lyric.updateSetting({ autoCollapsePlayQueue: value })" />
    </LyricSettingRow>
    <LyricSettingRow title="背景模式">
      <n-select :value="background.mode" :options="modeOptions" @update:value="changeMode" />
    </LyricSettingRow>
    <n-collapse :key="background.mode" class="background-parameters">
      <n-collapse-item :title="`${modeLabel}参数`" :name="background.mode">
        <template v-if="background.mode === 'image'">
          <LyricSettingRow title="背景图片" description="选择当前图片或打开图片库。" wide>
            <div class="image-controls">
              <img v-if="background.image.url" :src="background.image.url" alt="当前背景" class="current-image" />
              <button v-for="image in latestThreeImages" :key="image.id" type="button" :title="image.name"
                :class="{ selected: background.image.url === image.url }" @click="selectImage(image.url)">
                <img :src="image.url" :alt="image.name" />
              </button>
              <n-button secondary size="small" @click="showImageCenter = true">图片库</n-button>
            </div>
          </LyricSettingRow>
          <LyricSettingRow title="模糊度" wide><SettingAdjustment :value="background.image.blur" label="图片模糊度" @update:value="value => updateImage({ blur: value })" /></LyricSettingRow>
          <LyricSettingRow title="亮度" wide><SettingAdjustment :value="background.image.brightness" label="图片亮度" @update:value="value => updateImage({ brightness: value })" /></LyricSettingRow>
          <LyricSettingRow title="遮罩强度" wide><SettingAdjustment :value="background.image.mask" :max="80" label="图片遮罩强度" @update:value="value => updateImage({ mask: value })" /></LyricSettingRow>
        </template>
        <template v-else>
          <LyricSettingRow title="流动速度" :description="background.mode === 'dynamic' ? '0 为停止流动。' : '以 1 倍为基准调整运动速度。'">
            <n-input-number :value="motion.speed" :min="background.mode === 'dynamic' ? 0 : 0.5" :max="background.mode === 'dynamic' ? 4 : 2" :step="0.1" @update:value="value => updateMotion({ speed: value ?? defaultMotion.speed })" />
          </LyricSettingRow>
          <template v-if="background.mode === 'flow'">
            <LyricSettingRow v-for="control in flowControls" :key="control.key" :title="control.title" wide>
              <SettingAdjustment :value="background.flow[control.key]" :label="control.title" @update:value="value => lyric.updateBackgroundSetting({ flow: { [control.key]: value } })" />
            </LyricSettingRow>
            <LyricSettingRow title="色彩风格"><n-select :value="background.flow.colorMode" :options="colorOptions" @update:value="value => lyric.updateBackgroundSetting({ flow: { colorMode: value } })" /></LyricSettingRow>
          </template>
          <template v-else>
            <LyricSettingRow title="亮度" wide><SettingAdjustment :value="background.dynamic.brightness" label="动态背景亮度" @update:value="value => lyric.updateBackgroundSetting({ dynamic: { brightness: value } })" /></LyricSettingRow>
            <LyricSettingRow title="遮罩强度" wide><SettingAdjustment :value="background.dynamic.mask" :max="80" label="动态背景遮罩强度" @update:value="value => lyric.updateBackgroundSetting({ dynamic: { mask: value } })" /></LyricSettingRow>
          </template>
          <LyricSettingRow title="动画帧率" description="较高帧率会增加图形资源占用。"><n-select :value="motion.fps" :options="fpsOptions" @update:value="value => updateMotion({ fps: value })" /></LyricSettingRow>
          <LyricSettingRow title="渲染清晰度"><n-select :value="motion.scale" :options="scaleOptions" @update:value="value => updateMotion({ scale: value })" /></LyricSettingRow>
          <LyricSettingRow title="暂停时继续动画" description="关闭时暂停音乐会保留当前画面，恢复播放后继续。"><n-switch :value="motion.continueWhenPaused" aria-label="暂停时继续背景动画" @update:value="value => updateMotion({ continueWhenPaused: value })" /></LyricSettingRow>
        </template>
      </n-collapse-item>
    </n-collapse>
  </SettingSection>
  <AppImageCenterModal v-model:show="showImageCenter" :current-url="background.image.url" @confirm="selectImage" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { NButton, NCollapse, NCollapseItem, NInputNumber, NSelect, NSwitch } from "naive-ui";
import { useLyricStore } from "@/store/lyricStore";
import { getDefaultBackgroundConfig, type PlayerBackgroundConfig } from "@/playerBackground/backgroundConfig";
import { useImageManager } from "@/composables/useImageManager";
import AppImageCenterModal from "@/components/common/AppImageCenterModal.vue";
import SettingSection from "../SettingSection.vue";
import SettingAdjustment from "../SettingAdjustment.vue";
import LyricSettingRow from "./LyricSettingRow.vue";

const lyric = useLyricStore();
const background = computed(() => lyric.setting.background);
const motion = computed(() => background.value.mode === "dynamic" ? background.value.dynamic : background.value.flow);
const defaults = getDefaultBackgroundConfig();
const defaultMotion = computed(() => background.value.mode === "dynamic" ? defaults.dynamic : defaults.flow);
const modeOptions = [{ label: "图片", value: "image" }, { label: "动态背景", value: "dynamic" }, { label: "封面流光", value: "flow" }];
const modeLabel = computed(() => modeOptions.find(option => option.value === background.value.mode)?.label);
const colorOptions = [{ label: "跟随封面", value: "cover" }, { label: "柔和", value: "soft" }, { label: "鲜艳", value: "vivid" }];
const fpsOptions = [30, 60, 120].map(value => ({ label: `${value} FPS`, value }));
const scaleOptions = [0.25, 0.5, 0.75, 1].map(value => ({ label: `${value * 100}%`, value }));
const flowControls = [{ key: "amplitude", title: "运动幅度" }, { key: "intensity", title: "流光强度" }, { key: "brightness", title: "亮度" }, { key: "saturation", title: "饱和度" }] as const;
const imageManager = useImageManager();
const { latestThreeImages } = imageManager;
const showImageCenter = ref(false);
onMounted(() => { void imageManager.loadImages(); });

function updateImage(patch: Partial<PlayerBackgroundConfig["image"]>) { lyric.updateBackgroundSetting({ image: patch }); }
function updateMotion(patch: Partial<PlayerBackgroundConfig["dynamic"]>) {
  if (background.value.mode === "dynamic") lyric.updateBackgroundSetting({ dynamic: patch });
  else lyric.updateBackgroundSetting({ flow: patch });
}
async function changeMode(mode: PlayerBackgroundConfig["mode"]) {
  lyric.updateBackgroundSetting({ mode });
  if (mode !== "image" || background.value.image.url) return;
  await imageManager.loadImages();
  if (background.value.mode === "image" && !background.value.image.url && imageManager.allImages.value[0]) updateImage({ url: imageManager.allImages.value[0].url });
}
function selectImage(url: string) { lyric.updateBackgroundSetting({ mode: "image", image: { url } }); }
</script>

<style scoped lang="scss">
.background-parameters { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
.image-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.image-controls > button:not(.n-button) { padding: 0; width: 38px; height: 32px; border: 2px solid transparent; background: var(--surface-input); border-radius: var(--radius-control); overflow: hidden; cursor: pointer; }
.image-controls > button:not(.n-button).selected, .image-controls > button:not(.n-button):hover { border-color: var(--text-accent); }
.image-controls > button:not(.n-button):focus-visible { outline: 2px solid var(--text-accent); outline-offset: 2px; }
.image-controls img { width: 100%; height: 100%; object-fit: cover; }
.image-controls .current-image { width: 60px; height: 44px; border-radius: var(--radius-control); }
</style>
