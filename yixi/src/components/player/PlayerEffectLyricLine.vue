<template>
  <span ref="rootRef" class="effect-line" :style="rootStyle">
    <canvas v-if="active && !reducedMotion" ref="canvasRef" aria-hidden="true" class="effect-canvas" :style="canvasStyle" />
    <span :class="{ 'accessible-text': canvasReady && active && !reducedMotion }">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { LyricLine } from "@/utils/common/LyricParser";
import { getLyricLineText } from "@/utils/lyricLine";
import type { PlayerEffectStyleId, PlayerLyricStyleConfigMap } from "@/lyricStyles/playerLyricConfig";
import { drawLyricStyleEffect, getLyricStyleEffectPadding, type EffectFont, type EffectLineLayout } from "@/lyricStyles/lyricStyleEffects";
import { buildWrappedLyricLayout } from "@/lyricStyles/wrappedLyricLayout";

const props = defineProps<{
  line: LyricLine;
  endTimeMs: number;
  active: boolean;
  effectStyle: PlayerEffectStyleId;
  config: PlayerLyricStyleConfigMap[PlayerEffectStyleId];
  font: EffectFont;
  textColor: string;
  centered: boolean;
  wordMode: boolean;
  timeMs: number;
  layoutRevision: number;
  reducedMotion: boolean;
}>();
const emit = defineEmits<{ layout: [] }>();
const rootRef = ref<HTMLElement>();
const canvasRef = ref<HTMLCanvasElement>();
const canvasReady = ref(false);
const layoutHeight = ref(0);
const text = computed(() => getLyricLineText(props.line));
const padding = computed(() => getLyricStyleEffectPadding(props.effectStyle, props.config, props.font.fontSize));
const activeStaticColor = computed(() => {
  const style = props.config;
  if ("sungColor" in style) return style.sungColor;
  if ("highlightStartColor" in style) return style.highlightStartColor;
  if ("colorMid" in style) return style.colorMid;
  return style.textColor;
});
const rootStyle = computed(() => ({
  color: props.active ? activeStaticColor.value : props.textColor,
  textAlign: props.centered ? "center" as const : "left" as const,
  minHeight: canvasReady.value && props.active && !props.reducedMotion ? `${layoutHeight.value}px` : undefined,
  textShadow: props.font.shadowEnabled ? "0 2px 10px rgba(0, 0, 0, 0.18)" : "none",
}));
const canvasStyle = computed(() => ({ left: `${-padding.value}px`, top: `${-padding.value}px` }));
let layout: EffectLineLayout | undefined;
let context: CanvasRenderingContext2D | null = null;
let observer: ResizeObserver | undefined;
let disposed = false;
let lastWidth = -1;

const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas || !context || !layout || !props.active || props.reducedMotion) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(ratio, 0, 0, ratio, padding.value * ratio, padding.value * ratio);
  drawLyricStyleEffect(props.effectStyle, props.config, {
    ctx: context, layout, font: props.font, positionMs: props.timeMs,
    elapsedMs: Math.max(0, props.timeMs - props.line.startTime),
    durationMs: Math.max(1, props.endTimeMs - props.line.startTime),
    wordMode: props.wordMode, viewportWidth: lastWidth, variant: "player",
  });
};

const rebuild = () => {
  if (disposed) return;
  const canvas = canvasRef.value;
  if (!props.active || props.reducedMotion || !canvas || !rootRef.value) {
    canvasReady.value = false;
    context = null;
    layout = undefined;
    return;
  }
  try { context = canvas.getContext("2d"); } catch { context = null; }
  if (!context) { canvasReady.value = false; return; }
  lastWidth = rootRef.value.clientWidth;
  if (lastWidth <= 0) { canvasReady.value = false; return; }
  const font = props.font;
  context.font = `${font.fontWeight} ${font.fontSize}px "${font.fontFamily}", sans-serif`;
  layout = buildWrappedLyricLayout(context, props.line, { maxWidth: lastWidth, fontSize: font.fontSize, centered: props.centered });
  layoutHeight.value = layout.height;
  const width = lastWidth + padding.value * 2;
  const height = layout.height + padding.value * 2;
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvasReady.value = true;
  draw();
  void nextTick(() => { if (!disposed) emit("layout"); });
};

watch(() => [props.active, props.reducedMotion, props.line, props.effectStyle, props.config, props.font, props.centered, props.layoutRevision],
  rebuild, { deep: true, flush: "post" });
watch(() => [props.timeMs, props.wordMode, props.endTimeMs], draw, { flush: "post" });
watch(() => props.active, (active) => {
  observer?.disconnect();
  if (active && rootRef.value) observer?.observe(rootRef.value);
}, { flush: "post" });
onMounted(() => {
  observer = new ResizeObserver(() => {
    if (rootRef.value?.clientWidth !== lastWidth && props.active) rebuild();
  });
  if (props.active && rootRef.value) observer.observe(rootRef.value);
  rebuild();
});
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  context = null;
  layout = undefined;
});
</script>

<style scoped>
.effect-line {
  display: block;
  position: relative;
  width: 100%;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.effect-canvas { position: absolute; pointer-events: none; }
.accessible-text {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
