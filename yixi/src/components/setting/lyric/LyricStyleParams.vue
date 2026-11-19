<template>
  <div class="style-params">
    <!-- 默认（经典歌词）：收纳原通用外不通用的颜色与动效 -->
    <template v-if="styleId === 'default'">
      <LyricSettingRow title="未播放颜色">
        <n-color-picker
          :value="styles.default.textColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('default', { textColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="高亮颜色" description="逐字歌词已经唱过部分的颜色。">
        <n-color-picker
          :value="styles.default.highlightColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('default', { highlightColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="歌词动效" description="控制平滑滚动与换行过渡。">
        <n-switch
          :value="styles.default.animationEnabled"
          aria-label="歌词动效"
          @update:value="(v) => emitPatch('default', { animationEnabled: v }, true)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="逐字放大" description="正在唱的字轻微放大，仅有逐字时间信息时生效。">
        <n-switch
          :value="styles.default.wordScaleEnabled"
          aria-label="歌词逐字放大"
          @update:value="(v) => emitPatch('default', { wordScaleEnabled: v }, true)"
        />
      </LyricSettingRow>
    </template>

    <!-- 打字机逐现 -->
    <template v-else-if="styleId === 'typewriter'">
      <LyricSettingRow title="文字颜色">
        <n-color-picker
          :value="styles.typewriter.textColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('typewriter', { textColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="高光与光标颜色" description="最新敲出字符与尾随光标的发光颜色。">
        <n-color-picker
          :value="styles.typewriter.latestGlowColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('typewriter', { latestGlowColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow
        title="逐行显示时长"
        description="仅逐行歌词生效，控制整行字匀速敲出的总耗时。"
        wide
      >
        <SettingAdjustment
          :value="msToSec(styles.typewriter.lineRevealDurationMs)"
          label="打字机逐行显示时长"
          :min="limits.typewriterRevealMs.min / 1000"
          :max="limits.typewriterRevealMs.max / 1000"
          :step="limits.typewriterRevealMs.step / 1000"
          suffix="s"
          @update:value="(v) => emitPatch('typewriter', { lineRevealDurationMs: secToMs(v) }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="显示尾随光标" description="打字过程中在行尾显示呼吸竖线光标。">
        <n-switch
          :value="styles.typewriter.showCursor"
          aria-label="显示打字机尾随光标"
          @update:value="(v) => emitPatch('typewriter', { showCursor: v }, true)"
        />
      </LyricSettingRow>
    </template>

    <!-- 水墨流光 -->
    <template v-else-if="styleId === 'ink'">
      <LyricSettingRow title="未唱颜色">
        <n-color-picker
          :value="styles.ink.unlitColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('ink', { unlitColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="流光主色">
        <n-color-picker
          :value="styles.ink.highlightStartColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('ink', { highlightStartColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="扫光前沿色">
        <n-color-picker
          :value="styles.ink.highlightTipColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('ink', { highlightTipColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="羽化过渡宽度" description="控制已唱与未唱交界处的渐变柔和宽度。" wide>
        <SettingAdjustment
          :value="styles.ink.featherWidth"
          label="水墨羽化宽度"
          :min="limits.inkFeatherWidth.min"
          :max="limits.inkFeatherWidth.max"
          :step="limits.inkFeatherWidth.step"
          suffix="px"
          @update:value="(v) => emitPatch('ink', { featherWidth: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="微浮高度" description="逐字歌词正在唱字符的柔和上浮偏移。" wide>
        <SettingAdjustment
          :value="styles.ink.liftOffset"
          label="字符上浮高度"
          :min="limits.inkLiftOffset.min"
          :max="limits.inkLiftOffset.max"
          :step="limits.inkLiftOffset.step"
          suffix="px"
          @update:value="(v) => emitPatch('ink', { liftOffset: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="逐行扫亮时长" description="仅逐行歌词生效，整行水墨扫过时长。" wide>
        <SettingAdjustment
          :value="msToSec(styles.ink.lineSweepDurationMs)"
          label="水墨逐行扫亮时长"
          :min="limits.inkSweepMs.min / 1000"
          :max="limits.inkSweepMs.max / 1000"
          :step="limits.inkSweepMs.step / 1000"
          suffix="s"
          @update:value="(v) => emitPatch('ink', { lineSweepDurationMs: secToMs(v) }, false)"
        />
      </LyricSettingRow>
    </template>

    <!-- 律动弹跳 -->
    <template v-else-if="styleId === 'bounce'">
      <LyricSettingRow title="未唱颜色">
        <n-color-picker
          :value="styles.bounce.unlitColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('bounce', { unlitColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="已唱颜色">
        <n-color-picker
          :value="styles.bounce.sungColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('bounce', { sungColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="弹跳高亮色">
        <n-color-picker
          :value="styles.bounce.activeColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('bounce', { activeColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="跃起高度" wide>
        <SettingAdjustment
          :value="styles.bounce.jumpHeight"
          label="字符跃起高度"
          :min="limits.bounceJumpHeight.min"
          :max="limits.bounceJumpHeight.max"
          :step="limits.bounceJumpHeight.step"
          suffix="px"
          @update:value="(v) => emitPatch('bounce', { jumpHeight: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="跃起放大倍率" wide>
        <SettingAdjustment
          :value="styles.bounce.jumpScale"
          label="字符跃起放大倍率"
          :min="limits.bounceJumpScale.min"
          :max="limits.bounceJumpScale.max"
          :step="limits.bounceJumpScale.step"
          suffix="x"
          @update:value="(v) => emitPatch('bounce', { jumpScale: v }, false)"
        />
      </LyricSettingRow>
    </template>

    <!-- 聚光灯聚焦 -->
    <template v-else-if="styleId === 'spotlight'">
      <LyricSettingRow title="未唱颜色">
        <n-color-picker
          :value="styles.spotlight.unlitColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('spotlight', { unlitColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="已唱颜色">
        <n-color-picker
          :value="styles.spotlight.sungColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('spotlight', { sungColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="聚光文字颜色">
        <n-color-picker
          :value="styles.spotlight.activeColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('spotlight', { activeColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="聚光光晕颜色">
        <n-color-picker
          :value="styles.spotlight.glowColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('spotlight', { glowColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="柔焦模糊强度" description="切句入场与退场时的模糊过渡程度。" wide>
        <SettingAdjustment
          :value="styles.spotlight.blurIntensity"
          label="切句柔焦强度"
          :min="limits.spotlightBlur.min"
          :max="limits.spotlightBlur.max"
          :step="limits.spotlightBlur.step"
          suffix="px"
          @update:value="(v) => emitPatch('spotlight', { blurIntensity: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="聚焦放大倍率" wide>
        <SettingAdjustment
          :value="styles.spotlight.activeScale"
          label="聚焦放大倍率"
          :min="limits.spotlightScale.min"
          :max="limits.spotlightScale.max"
          :step="limits.spotlightScale.step"
          suffix="x"
          @update:value="(v) => emitPatch('spotlight', { activeScale: v }, false)"
        />
      </LyricSettingRow>
    </template>

    <!-- 流彩星尘霓虹 -->
    <template v-else-if="styleId === 'neon'">
      <LyricSettingRow title="未唱颜色">
        <n-color-picker
          :value="styles.neon.unlitColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('neon', { unlitColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="流彩颜色一">
        <n-color-picker
          :value="styles.neon.colorStart"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('neon', { colorStart: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="流彩颜色二">
        <n-color-picker
          :value="styles.neon.colorMid"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('neon', { colorMid: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="流彩颜色三">
        <n-color-picker
          :value="styles.neon.colorEnd"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('neon', { colorEnd: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="逐行点亮时长" description="仅逐行歌词生效，切句后点亮整行流彩的耗时。" wide>
        <SettingAdjustment
          :value="msToSec(styles.neon.lineRevealDurationMs)"
          label="霓虹逐行点亮时长"
          :min="limits.neonRevealMs.min / 1000"
          :max="limits.neonRevealMs.max / 1000"
          :step="limits.neonRevealMs.step / 1000"
          suffix="s"
          @update:value="(v) => emitPatch('neon', { lineRevealDurationMs: secToMs(v) }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="流彩流动速度" description="0 为静止渐变，越大流动越快。" wide>
        <SettingAdjustment
          :value="styles.neon.flowSpeed"
          label="霓虹流彩速度"
          :min="limits.neonFlowSpeed.min"
          :max="limits.neonFlowSpeed.max"
          :step="limits.neonFlowSpeed.step"
          suffix="x"
          @update:value="(v) => emitPatch('neon', { flowSpeed: v }, false)"
        />
      </LyricSettingRow>
    </template>

    <!-- 海浪翻滚 -->
    <template v-else-if="styleId === 'ocean'">
      <LyricSettingRow title="未唱颜色">
        <n-color-picker
          :value="styles.ocean.unlitColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('ocean', { unlitColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="已唱颜色">
        <n-color-picker
          :value="styles.ocean.sungColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('ocean', { sungColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="波峰高亮色" description="浪尖主字及浪花的高亮颜色。">
        <n-color-picker
          :value="styles.ocean.crestColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('ocean', { crestColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="波纹与光晕颜色">
        <n-color-picker
          :value="styles.ocean.glowColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('ocean', { glowColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="主字跃起高度" description="波峰中心字体的最高上浮高度，紧邻左右两字自动保持一半高度。" wide>
        <SettingAdjustment
          :value="styles.ocean.jumpHeight"
          label="海浪主字跃起高度"
          :min="limits.oceanJumpHeight.min"
          :max="limits.oceanJumpHeight.max"
          :step="limits.oceanJumpHeight.step"
          suffix="px"
          @update:value="(v) => emitPatch('ocean', { jumpHeight: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="显示底部线条" description="在每行歌词下方绘制同步起伏的海浪波纹线与浪花微粒。">
        <n-switch
          :value="styles.ocean.showWaveLine"
          aria-label="显示海浪底部线条"
          @update:value="(v) => emitPatch('ocean', { showWaveLine: v }, true)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="左右摇晃" description="翻滚时左右微倾摇晃；关闭后仅保留上下跃起。">
        <n-switch
          :value="styles.ocean.swayEnabled"
          aria-label="海浪左右摇晃"
          @update:value="(v) => emitPatch('ocean', { swayEnabled: v }, true)"
        />
      </LyricSettingRow>
    </template>

    <!-- 粒子聚散星尘 -->
    <template v-else-if="styleId === 'particle'">
      <LyricSettingRow title="未唱颜色">
        <n-color-picker
          :value="styles.particle.unlitColor"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('particle', { unlitColor: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="粒子渐起始色">
        <n-color-picker
          :value="styles.particle.colorStart"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('particle', { colorStart: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="粒子渐终止色">
        <n-color-picker
          :value="styles.particle.colorEnd"
          :show-alpha="true"
          :modes="colorModes"
          @update:value="(v) => emitPatch('particle', { colorEnd: v }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="入场聚合时长" wide>
        <SettingAdjustment
          :value="msToSec(styles.particle.gatherDurationMs)"
          label="粒子聚合时长"
          :min="limits.particleGatherMs.min / 1000"
          :max="limits.particleGatherMs.max / 1000"
          :step="limits.particleGatherMs.step / 1000"
          suffix="s"
          @update:value="(v) => emitPatch('particle', { gatherDurationMs: secToMs(v) }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="退场涣散时长" wide>
        <SettingAdjustment
          :value="msToSec(styles.particle.disperseDurationMs)"
          label="粒子涣散时长"
          :min="limits.particleDisperseMs.min / 1000"
          :max="limits.particleDisperseMs.max / 1000"
          :step="limits.particleDisperseMs.step / 1000"
          suffix="s"
          @update:value="(v) => emitPatch('particle', { disperseDurationMs: secToMs(v) }, false)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="粒子精细度" description="更精细会生成更多采样微粒，视觉更细腻。">
        <n-select
          :value="styles.particle.particleDensity"
          :options="densityOptions"
          @update:value="(v) => emitPatch('particle', { particleDensity: v }, true)"
        />
      </LyricSettingRow>
      <LyricSettingRow title="演唱飘散星尘" description="在当前演唱位置上方飘起少量微星尘。">
        <n-switch
          :value="styles.particle.showAmbientSparks"
          aria-label="演唱飘散星尘"
          @update:value="(v) => emitPatch('particle', { showAmbientSparks: v }, true)"
        />
      </LyricSettingRow>
    </template>

    <div class="style-params-footer">
      <n-button secondary size="small" @click="emit('reset-style', styleId)">
        恢复当前样式默认参数
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NColorPicker, NSelect, NSwitch } from "naive-ui";
import { DESKTOP_LYRIC_STYLE_LIMITS as limits } from "@/desktopLyric/desktopLyricDefaults";
import type {
  DesktopLyricStyleConfigMap,
  DesktopLyricStyleId,
} from "@/types/desktopLyric";
import SettingAdjustment from "../SettingAdjustment.vue";
import LyricSettingRow from "./LyricSettingRow.vue";

defineProps<{
  styleId: DesktopLyricStyleId;
  styles: DesktopLyricStyleConfigMap;
}>();

const emit = defineEmits<{
  "patch-style": [
    styleId: DesktopLyricStyleId,
    patch: Partial<DesktopLyricStyleConfigMap[DesktopLyricStyleId]>,
    immediate: boolean,
  ];
  "reset-style": [styleId: DesktopLyricStyleId];
}>();

const colorModes: Array<"hex" | "rgb" | "hsl"> = ["hex", "rgb", "hsl"];
const densityOptions = [
  { label: "细腻", value: "fine" },
  { label: "均衡", value: "balanced" },
  { label: "轻量", value: "light" },
];

function msToSec(ms: number): number {
  return Number((ms / 1000).toFixed(2));
}

function secToMs(sec: number): number {
  return Math.round(sec * 1000);
}

function emitPatch<K extends DesktopLyricStyleId>(
  id: K,
  patch: Partial<DesktopLyricStyleConfigMap[K]>,
  immediate: boolean,
) {
  emit("patch-style", id, patch, immediate);
}
</script>

<style scoped lang="scss">
.style-params-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
</style>
