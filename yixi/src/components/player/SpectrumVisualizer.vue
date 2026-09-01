<!-- SpectrumVisualizer.vue -->
<!-- 高颜值细条音频频谱仪：支持封面提取主色调自适应渐变、高密度细条、物理缓降峰值点与柔和边缘羽化 -->
<template>
  <div ref="containerRef" class="spectrum-visualizer-container">
    <canvas ref="canvasRef" class="spectrum-canvas" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { storeToRefs } from "pinia";
import { useAudioStore, useThemeStore } from "@/store";
import { audioAnalyser } from "@/utils/audioAnalyser";
import { getColorFromUrl } from "@/utils/common";

const props = withDefaults(
  defineProps<{
    coverUrl?: string;
    barCount?: number;
    barGap?: number;
    maxHeight?: number;
    enablePeaks?: boolean;
  }>(),
  {
    coverUrl: "",
    barCount: 88,
    barGap: 2.5,
    maxHeight: 46,
    enablePeaks: true,
  }
);

const containerRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();

const audioStore = useAudioStore();
const themeStore = useThemeStore();
const { isPlaying, currentSong } = storeToRefs(audioStore);
const { accentColor } = storeToRefs(themeStore);

// 提取自封面的主题主色
const extractedCoverColor = ref<string>("");

const activeColor = computed(() => {
  return extractedCoverColor.value || accentColor.value || "#2897ff";
});

let animationFrameId: number | null = null;
let resizeObserver: ResizeObserver | null = null;

// 记录当前高度与峰值高度数组
const currentHeights: number[] = [];
const peakHeights: number[] = [];
const peakHoldTimes: number[] = [];

const PEAK_GRAVITY = 0.65;
const PEAK_HOLD_FRAMES = 10;
const DECAY_RATE = 0.88;

/**
 * 监听封面变更，实时从封面提取主色调
 */
watch(
  () => props.coverUrl,
  async (url) => {
    if (!url) {
      extractedCoverColor.value = "";
      return;
    }
    try {
      const color = await getColorFromUrl(url);
      if (color) {
        extractedCoverColor.value = color;
      }
    } catch {
      extractedCoverColor.value = "";
    }
  },
  { immediate: true }
);

/**
 * 调整 Canvas 物理像素分辨率（HiDPI 锐利渲染）
 */
const updateCanvasSize = () => {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height) || props.maxHeight;

  if (width <= 0 || height <= 0) return;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
};

/**
 * 绘制单帧高密度细条频谱
 */
const drawFrame = () => {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = container.clientWidth;
  const height = container.clientHeight || props.maxHeight;
  if (width <= 0 || height <= 0) {
    animationFrameId = requestAnimationFrame(drawFrame);
    return;
  }

  ctx.clearRect(0, 0, width, height);

  const freqData = audioAnalyser.getFrequencyData();
  const count = props.barCount;
  const gap = props.barGap;
  const totalBarWidth = (width - (count - 1) * gap) / count;
  const barWidth = Math.max(1.8, totalBarWidth);

  while (currentHeights.length < count) {
    currentHeights.push(0);
    peakHeights.push(0);
    peakHoldTimes.push(0);
  }

  const baseColor = activeColor.value;

  // 垂直渐变色
  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, `${baseColor}15`);
  gradient.addColorStop(0.35, `${baseColor}70`);
  gradient.addColorStop(0.8, `${baseColor}dd`);
  gradient.addColorStop(1, "#ffffff");

  let hasMotion = false;
  const freqLength = freqData ? freqData.length : 0;

  const center = (count - 1) / 2;

  for (let i = 0; i < count; i++) {
    let targetHeight = 0;

    if (isPlaying.value && freqData && freqLength > 0) {
      // 归一化中心距离：中心为 0（低频基底），向左右两端扩散到 1（高频泛音）
      const normalizedDist = Math.abs(i - center) / center;

      // 对数频段映射（中心低频饱满有力，两侧向高频自然递减过渡）
      const freqIndex = Math.min(
        freqLength - 1,
        Math.floor(Math.pow(normalizedDist, 1.45) * (freqLength * 0.78))
      );

      // 取邻近频点平滑加权，减少相邻细条的毛刺抖动
      const prevVal = freqData[Math.max(0, freqIndex - 1)] || 0;
      const curVal = freqData[freqIndex] || 0;
      const nextVal = freqData[Math.min(freqLength - 1, freqIndex + 1)] || 0;
      const rawValue = curVal * 0.6 + (prevVal + nextVal) * 0.2;

      // 动态增益：中心低音下潜强劲，中段人声乐器饱满，两端高音轻盈灵动
      const boost = 1.05 + Math.sin(normalizedDist * Math.PI) * 0.28;
      targetHeight = Math.min(height - 4, ((rawValue * boost) / 255) * (height - 6));
    }

    // 动态阻尼与弹性衰减
    if (targetHeight > currentHeights[i]) {
      currentHeights[i] = currentHeights[i] * 0.25 + targetHeight * 0.75;
    } else {
      currentHeights[i] = currentHeights[i] * DECAY_RATE;
    }

    if (currentHeights[i] < 1.5) {
      currentHeights[i] = 1.5; // 待机呼吸基线
    } else {
      hasMotion = true;
    }

    const curH = Math.min(height - 4, Math.max(1.5, currentHeights[i]));

    // 峰值小方块下落计算
    if (props.enablePeaks) {
      if (curH >= peakHeights[i]) {
        peakHeights[i] = curH;
        peakHoldTimes[i] = PEAK_HOLD_FRAMES;
      } else if (peakHoldTimes[i] > 0) {
        peakHoldTimes[i]--;
      } else {
        peakHeights[i] = Math.max(1.5, peakHeights[i] - PEAK_GRAVITY);
      }
      if (peakHeights[i] > 2) {
        hasMotion = true;
      }
    }

    const x = i * (barWidth + gap);
    const y = height - curH;

    // 绘制细柱条（带微圆角与顶部光晕）
    ctx.save();
    ctx.fillStyle = gradient;
    if (curH > 8) {
      ctx.shadowColor = `${baseColor}66`;
      ctx.shadowBlur = 4;
    }
    ctx.beginPath();
    const radius = Math.min(barWidth / 2, 1.5);
    ctx.roundRect(x, y, barWidth, curH, [radius, radius, 0, 0]);
    ctx.fill();
    ctx.restore();

    // 绘制峰值点 (Peak Dots)
    if (props.enablePeaks && peakHeights[i] > curH + 2) {
      const peakY = height - peakHeights[i];
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.roundRect(x, peakY, barWidth, 1.5, [1, 1, 1, 1]);
      ctx.fill();
      ctx.restore();
    }
  }

  // 暂停后所有能量衰减归零，停止 requestAnimationFrame 节省能耗
  if (!isPlaying.value && !hasMotion) {
    animationFrameId = null;
    return;
  }

  animationFrameId = requestAnimationFrame(drawFrame);
};

const startLoop = () => {
  if (animationFrameId !== null) return;
  animationFrameId = requestAnimationFrame(drawFrame);
};

const stopLoop = () => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

watch(
  () => isPlaying.value,
  (playing) => {
    if (playing) {
      void audioAnalyser.resume();
      startLoop();
    } else {
      startLoop();
    }
  },
  { immediate: true }
);

watch(
  () => currentSong.value?.id,
  () => {
    // 切歌时启动动画更新
    startLoop();
  }
);

onMounted(() => {
  updateCanvasSize();
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    resizeObserver.observe(containerRef.value);
  }
  startLoop();
});

onBeforeUnmount(() => {
  stopLoop();
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
</script>

<style lang="scss" scoped>
.spectrum-visualizer-container {
  width: 100%;
  height: 46px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: none;
  user-select: none;
  overflow: visible;
  /* 左右两端平滑渐变羽化，消除生硬截断感 */
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0%,
    rgba(0, 0, 0, 0.85) 3%,
    black 8%,
    black 92%,
    rgba(0, 0, 0, 0.85) 97%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to right,
    transparent 0%,
    rgba(0, 0, 0, 0.85) 3%,
    black 8%,
    black 92%,
    rgba(0, 0, 0, 0.85) 97%,
    transparent 100%
  );

  .spectrum-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
}
</style>
