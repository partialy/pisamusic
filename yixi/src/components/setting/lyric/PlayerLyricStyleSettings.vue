<template>
  <SettingSection>
    <LyricSettingRow title="歌词样式" :description="currentStyle.description">
      <n-select :value="setting.style" :options="styleOptions"
        @update:value="value => lyric.updateSetting({ style: value })" />
    </LyricSettingRow>
    <n-collapse :key="setting.style" class="style-parameters">
      <n-collapse-item :title="`${currentStyle.label}参数`" :name="setting.style">
        <LyricStyleParams v-if="isPlayerEffectStyle(setting.style)"
          :style-id="setting.style" :styles="effectStyles" @patch-style="patchEffect" @reset-style="resetStyle" />
        <template v-else>
          <LyricSettingRow title="文字颜色" :description="setting.style === 'amlyric' ? 'AMLyric 的基准文字颜色。' : '普通歌词行和逐字歌词未唱部分的颜色。'">
            <n-color-picker :value="setting.styles[setting.style].textColor" show-alpha :modes="colorModes"
              @update:value="value => patchColor('textColor', value)" />
            <n-button secondary circle title="从背景提取文字颜色" aria-label="从背景提取文字颜色"
              :loading="extractingTarget === 'textColor'" :disabled="extractingTarget !== null"
              @click="extractColor('textColor')"><template #icon><Pipette :size="16" /></template></n-button>
          </LyricSettingRow>
          <LyricSettingRow v-if="setting.style === 'default'" title="当前行颜色" description="当前行和逐字歌词已唱部分的高亮色。">
            <n-color-picker :value="setting.styles.default.highlightColor" show-alpha :modes="colorModes"
              @update:value="value => patchColor('highlightColor', value)" />
            <n-button secondary circle title="从背景提取当前行颜色" aria-label="从背景提取当前行颜色"
              :loading="extractingTarget === 'highlightColor'" :disabled="extractingTarget !== null"
              @click="extractColor('highlightColor')"><template #icon><Pipette :size="16" /></template></n-button>
          </LyricSettingRow>
          <template v-if="setting.style === 'amlyric'">
            <LyricSettingRow v-for="effect in amEffects" :key="effect.key" :title="effect.title" :description="effect.description">
              <n-switch :value="setting.styles.amlyric[effect.key]" :aria-label="effect.title"
                @update:value="value => lyric.updateStyleSetting('amlyric', { [effect.key]: value })" />
            </LyricSettingRow>
          </template>
          <div class="style-params-footer">
            <n-button secondary size="small" @click="resetStyle">恢复当前样式默认参数</n-button>
          </div>
        </template>
      </n-collapse-item>
    </n-collapse>
  </SettingSection>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { storeToRefs } from "pinia";
import { NButton, NCollapse, NCollapseItem, NColorPicker, NSelect, NSwitch, useMessage } from "naive-ui";
import { Pipette } from "lucide-vue-next";
import { useLyricStore } from "@/store/lyricStore";
import { useThemeStore } from "@/store/theme";
import { getDefaultDesktopLyricStyleSettings } from "@/desktopLyric/desktopLyricDefaults";
import { isPlayerEffectStyle, PLAYER_LYRIC_STYLE_OPTIONS } from "@/lyricStyles/playerLyricConfig";
import type { DesktopLyricStyleId, DesktopLyricStyleConfigMap } from "@/types/desktopLyric";
import { extractDominantColorFromUrl } from "@/utils/imageColor";
import SettingSection from "../SettingSection.vue";
import LyricSettingRow from "./LyricSettingRow.vue";
import LyricStyleParams from "./LyricStyleParams.vue";

type ColorTarget = "textColor" | "highlightColor";
const lyric = useLyricStore();
const theme = useThemeStore();
const { setting } = storeToRefs(lyric);
const message = useMessage();
const styleOptions = PLAYER_LYRIC_STYLE_OPTIONS.map(({ label, value }) => ({ label, value }));
const currentStyle = computed(() => PLAYER_LYRIC_STYLE_OPTIONS.find(item => item.value === setting.value.style)!);
const effectStyles = computed(() => ({
  ...getDefaultDesktopLyricStyleSettings(),
  typewriter: setting.value.styles.typewriter, ink: setting.value.styles.ink,
  bounce: setting.value.styles.bounce, spotlight: setting.value.styles.spotlight, neon: setting.value.styles.neon,
}));
const colorModes: Array<"hex" | "rgb" | "hsl"> = ["hex", "rgb", "hsl"];
const extractingTarget = ref<ColorTarget | null>(null);
const amEffects = [
  { key: "spring", title: "弹簧滚动", description: "使用物理弹簧动画；关闭后使用普通过渡。" },
  { key: "scale", title: "当前行放大", description: "轻微放大正在播放的歌词行。" },
  { key: "blur", title: "背景行模糊", description: "弱化非当前歌词行，突出正在播放的唱词。" },
  { key: "hidePassedLines", title: "隐藏已唱歌词", description: "保留当前行和后续歌词。" },
] as const;
let disposed = false;
onBeforeUnmount(() => { disposed = true; });

function patchEffect(style: DesktopLyricStyleId, patch: Partial<DesktopLyricStyleConfigMap[DesktopLyricStyleId]>) {
  if (isPlayerEffectStyle(style)) lyric.updateStyleSetting(style, patch);
}

function patchColor(target: ColorTarget, value: string) {
  if (target === "highlightColor") lyric.updateStyleSetting("default", { highlightColor: value });
  else if (setting.value.style === "default" || setting.value.style === "amlyric") {
    lyric.updateStyleSetting(setting.value.style, { textColor: value });
  }
}

function resetStyle() {
  lyric.resetStyleSetting(setting.value.style);
  message.success(`已恢复「${currentStyle.value.label}」默认参数`);
}

function activeBackgroundImage() {
  return setting.value.background.image.url || theme.backgroundImage || "";
}

async function extractColor(target: ColorTarget) {
  const background = activeBackgroundImage();
  if (!background) { message.warning("请先选择歌词背景图片"); return; }
  const style = setting.value.style;
  if (style !== "default" && style !== "amlyric") return;
  const previousColor = target === "highlightColor" ? setting.value.styles.default.highlightColor : setting.value.styles[style].textColor;
  extractingTarget.value = target;
  try {
    const url = /^(https?:|data:|file:)/i.test(background) || /^[a-zA-Z]:[\\/]/.test(background)
      ? background : new URL(background, window.location.href).href;
    const color = await extractDominantColorFromUrl(url);
    const currentColor = target === "highlightColor" ? setting.value.styles.default.highlightColor : setting.value.styles[style].textColor;
    if (disposed || style !== setting.value.style || background !== activeBackgroundImage() || previousColor !== currentColor) return;
    if (!color) { message.warning("未能从背景图片中提取到颜色"); return; }
    patchColor(target, color);
    message.success(`已从背景提取颜色：${color}`);
  } catch {
    if (!disposed) message.error("提取背景颜色失败，请重试");
  } finally { extractingTarget.value = null; }
}
</script>

<style scoped lang="scss">
.style-parameters { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
.style-params-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
