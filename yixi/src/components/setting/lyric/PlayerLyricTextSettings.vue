<template>
  <SettingSection title="字体与颜色" description="调整两种歌词模式通用的文字样式。">
    <LyricSettingRow title="字体大小" description="范围 12–60px。">
      <n-input-number :value="setting.lyricFontSize" v-bind="ranges.fontSize"
        @update:value="value => lyric.updateSetting({ lyricFontSize: value ?? defaults.lyricFontSize })" />
    </LyricSettingRow>
    <LyricSettingRow title="字体系列" description="未安装的字体由系统自动回退。">
      <n-select :value="setting.lyricFont" :options="fontOptions"
        @update:value="value => lyric.updateSetting({ lyricFont: value })" />
    </LyricSettingRow>
    <LyricSettingRow title="字体加粗">
      <n-switch :value="setting.lyricFontWeight" aria-label="歌词字体加粗"
        @update:value="value => lyric.updateSetting({ lyricFontWeight: value })" />
    </LyricSettingRow>
    <LyricSettingRow title="文字阴影" description="在复杂背景上增强文字辨识度。">
      <n-switch :value="setting.lyricFontShadow" aria-label="歌词文字阴影"
        @update:value="value => lyric.updateSetting({ lyricFontShadow: value })" />
    </LyricSettingRow>
    <LyricSettingRow title="文字不透明度" description="调整整体歌词文字，同时保留当前行与其他行的明暗层次。" wide>
      <SettingAdjustment :value="Math.round(setting.lyricFontOpacity * 100)" label="歌词文字不透明度"
        :min="ranges.opacity.min * 100" :max="ranges.opacity.max * 100"
        @update:value="value => lyric.updateSetting({ lyricFontOpacity: value / 100 })" />
    </LyricSettingRow>
    <LyricSettingRow title="文字颜色" :description="setting.useAMLyric ? 'AM 歌词的基准文字颜色。' : '普通歌词行和逐字歌词未唱部分的颜色。'">
      <n-color-picker :value="setting.lyricFontColor" :show-alpha="true" :modes="colorModes"
        @update:value="value => lyric.updateSetting({ lyricFontColor: value })" />
      <n-button secondary circle title="从背景提取文字颜色" aria-label="从背景提取文字颜色"
        :loading="extractingTarget === 'lyricFontColor'" :disabled="extractingTarget !== null"
        @click="extractColor('lyricFontColor')"><template #icon><Pipette :size="16" /></template></n-button>
    </LyricSettingRow>
    <LyricSettingRow v-if="!setting.useAMLyric" title="当前行颜色" description="普通歌词当前行和逐字歌词已唱部分的高亮色。">
      <n-color-picker :value="setting.currentLyricColor" :show-alpha="true" :modes="colorModes"
        @update:value="value => lyric.updateSetting({ currentLyricColor: value })" />
      <n-button secondary circle title="从背景提取当前行颜色" aria-label="从背景提取当前行颜色"
        :loading="extractingTarget === 'currentLyricColor'" :disabled="extractingTarget !== null"
        @click="extractColor('currentLyricColor')"><template #icon><Pipette :size="16" /></template></n-button>
    </LyricSettingRow>
  </SettingSection>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { storeToRefs } from "pinia";
import { NButton, NColorPicker, NInputNumber, NSelect, NSwitch, useMessage } from "naive-ui";
import { Pipette } from "lucide-vue-next";
import { useLyricStore } from "@/store/lyricStore";
import { useThemeStore } from "@/store/theme";
import { getDefaultLyricSetting, LYRIC_SETTING_RANGES as ranges } from "@/utils/lyricSettings";
import { extractDominantColorFromUrl } from "@/utils/imageColor";
import SettingSection from "../SettingSection.vue";
import SettingAdjustment from "../SettingAdjustment.vue";
import LyricSettingRow from "./LyricSettingRow.vue";
import { getLyricFontOptions } from "./lyricSettingOptions";

type ColorTarget = "lyricFontColor" | "currentLyricColor";
const lyric = useLyricStore();
const theme = useThemeStore();
const { setting } = storeToRefs(lyric);
const defaults = getDefaultLyricSetting();
const fontOptions = computed(() => getLyricFontOptions(setting.value.lyricFont));
const colorModes: Array<"hex" | "rgb" | "hsl"> = ["hex", "rgb", "hsl"];
const extractingTarget = ref<ColorTarget | null>(null);
const message = useMessage();
let disposed = false;
onBeforeUnmount(() => { disposed = true; });

function activeBackgroundImage() {
  return setting.value.background.image.url || theme.backgroundImage || "";
}

function resolveImageUrl(url: string) {
  if (/^(https?:|data:|file:)/i.test(url) || /^[a-zA-Z]:[\\/]/.test(url)) return url;
  return new URL(url, window.location.href).href;
}

async function extractColor(target: ColorTarget) {
  const background = activeBackgroundImage();
  if (!background) {
    message.warning("请先选择歌词背景图片");
    return;
  }
  const previousColor = setting.value[target];
  extractingTarget.value = target;
  try {
    const color = await extractDominantColorFromUrl(resolveImageUrl(background));
    // 取色期间更换背景、手动编辑或离开面板时，保留用户较新的选择。
    if (disposed || background !== activeBackgroundImage() || previousColor !== setting.value[target]) return;
    if (!color) { message.warning("未能从背景图片中提取到颜色"); return; }
    lyric.updateSetting({ [target]: color });
    message.success(`已从背景提取颜色：${color}`);
  } catch {
    if (!disposed) message.error("提取背景颜色失败，请重试");
  } finally {
    extractingTarget.value = null;
  }
}
</script>
