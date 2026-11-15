<template>
  <AppModal v-model:show="equalizerStore.showModal" title="均衡器" :icon="Sliders" :width="660">
    <div class="eq-content">
      <div class="eq-curve-container" :class="{ 'is-disabled': !equalizerStore.enabled }">
          <svg
            class="eq-curve-svg"
            viewBox="0 0 600 120"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="eqCurveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--color-primary, #18a058)" stop-opacity="0.35" />
                <stop offset="100%" stop-color="var(--color-primary, #18a058)" stop-opacity="0.0" />
              </linearGradient>
              <linearGradient id="eqStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="var(--color-primary, #18a058)" stop-opacity="0.8" />
                <stop offset="50%" stop-color="var(--color-primary, #18a058)" stop-opacity="1.0" />
                <stop offset="100%" stop-color="var(--color-primary, #18a058)" stop-opacity="0.8" />
              </linearGradient>
            </defs>

            <!-- 0 dB 中轴参考线 -->
            <line
              x1="0"
              y1="60"
              x2="600"
              y2="60"
              class="ref-line center-line"
            />
            <!-- +6dB / -6dB 辅助刻度线 -->
            <line x1="0" y1="30" x2="600" y2="30" class="ref-line sub-line" />
            <line x1="0" y1="90" x2="600" y2="90" class="ref-line sub-line" />

            <!-- 渐变填充区域 -->
            <path :d="curveAreaPath" class="curve-area" fill="url(#eqCurveGradient)" />

            <!-- 平滑曲线描边 -->
            <path :d="curveStrokePath" class="curve-stroke" stroke="url(#eqStrokeGradient)" />

            <!-- 频段节点圆点 -->
            <circle
              v-for="(pt, idx) in curvePoints"
              :key="idx"
              :cx="pt.x"
              :cy="pt.y"
              r="3.5"
              class="curve-node"
              :class="{ 'is-active': equalizerStore.enabled }"
            />
          </svg>

          <!-- dB 刻度指示 -->
          <div class="scale-indicators">
            <span class="scale-label top">+12dB</span>
            <span class="scale-label zero">0dB</span>
            <span class="scale-label bottom">-12dB</span>
          </div>
        </div>

      <div class="eq-control-row">
        <span class="eq-control-label">均衡器开关</span>
        <n-switch :value="equalizerStore.enabled" aria-label="均衡器开关" @update:value="equalizerStore.setEnabled" />
      </div>

      <div class="eq-control-row">
        <span class="eq-control-label">音效预设</span>
        <n-select
          class="eq-preset-select"
          size="small"
          :value="equalizerStore.currentPresetKey"
          :options="presetOptions"
          @update:value="handlePresetChange"
        />
      </div>

      <section class="eq-section">
        <div class="eq-section-title">频段调整</div>
        <div class="eq-faders-scroll">
          <div class="eq-faders-panel" :class="{ 'is-disabled': !equalizerStore.enabled }">
            <!-- 前级增益 (Preamp) 独立区域 -->
            <div class="fader-col preamp-col">
              <span class="fader-val" :class="getGainClass(equalizerStore.preamp)">
                {{ formatGain(equalizerStore.preamp) }}
              </span>
              <div class="slider-track-box">
                <n-slider
                  vertical
                  :value="equalizerStore.preamp"
                  :min="-12"
                  :max="12"
                  :step="0.5"
                  :tooltip="false"
                  :disabled="!equalizerStore.enabled"
                  class="eq-slider preamp-slider"
                  @update:value="equalizerStore.setPreampGain"
                />
                <div class="zero-tick"></div>
              </div>
              <span class="fader-label preamp-label">前级增益</span>
            </div>

            <div class="fader-divider"></div>

            <!-- 10 个频段推子 -->
            <div class="bands-faders">
              <div
                v-for="(freq, index) in equalizerStore.frequencies"
                :key="freq"
                class="fader-col band-col"
              >
                <span class="fader-val" :class="getGainClass(equalizerStore.gains[index])">
                  {{ formatGain(equalizerStore.gains[index]) }}
                </span>
                <div class="slider-track-box">
                  <n-slider
                    vertical
                    :value="equalizerStore.gains[index]"
                    :min="-12"
                    :max="12"
                    :step="0.5"
                    :tooltip="false"
                    :disabled="!equalizerStore.enabled"
                    class="eq-slider"
                    @update:value="(val: number) => equalizerStore.setBandGain(index, val)"
                  />
                  <div class="zero-tick"></div>
                </div>
                <span class="fader-label">{{ formatFreq(freq) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
    <template #footer>
      <n-button round secondary @click="equalizerStore.reset"><template #icon><n-icon :component="RotateCcw" /></template>重置</n-button>
      <n-button round @click="equalizerStore.closeModal"><template #icon><n-icon :component="X" /></template>关闭</n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton, NIcon, NSelect, NSwitch, NSlider } from "naive-ui";
import AppModal from "@/components/common/AppModal.vue";
import { Sliders, RotateCcw, X } from "lucide-vue-next";
import { useEqualizerStore } from "@/store";

const equalizerStore = useEqualizerStore();

const presetOptions = computed(() => [
  ...equalizerStore.presets.map((preset) => ({
    label: preset.name,
    value: preset.key,
  })),
  { label: "自定义", value: "custom" },
]);

function handlePresetChange(key: string) {
  if (key === "custom") {
    equalizerStore.currentPresetKey = "custom";
    return;
  }
  equalizerStore.applyPreset(key);
}

function formatGain(gain: number | undefined): string {
  const num = typeof gain === "number" ? gain : 0;
  if (num > 0) return `+${num.toFixed(1)}`;
  if (num === 0) return "0.0";
  return num.toFixed(1);
}

function getGainClass(gain: number | undefined): string {
  const num = typeof gain === "number" ? gain : 0;
  if (num > 0) return "val-positive";
  if (num < 0) return "val-negative";
  return "val-zero";
}

function formatFreq(freq: number): string {
  if (freq >= 1000) {
    return `${freq / 1000}k`;
  }
  return `${freq}`;
}

/**
 * 计算 10 个频段在 SVG 视图中的坐标点 (viewBox 0 0 600 120)
 * X 轴: 10 个等分点 (30 到 570)
 * Y 轴: +12dB -> Y: 10, 0dB -> Y: 60, -12dB -> Y: 110
 */
const curvePoints = computed(() => {
  const totalBands = equalizerStore.frequencies.length;
  const marginX = 35;
  const usableWidth = 600 - marginX * 2;
  const stepX = usableWidth / (totalBands - 1);

  return equalizerStore.frequencies.map((_, i) => {
    const gain = equalizerStore.enabled ? equalizerStore.gains[i] || 0 : 0;
    const x = marginX + i * stepX;
    // gain 范围 -12 ~ +12，映射到 Y 轴 110 ~ 10 (中心 60)
    const y = 60 - (gain / 12) * 48;
    return { x, y };
  });
});

/**
 * 利用 Catmull-Rom 样条平滑插值生成 SVG 贝塞尔曲线
 */
function getCatmullRomSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  // 在首尾补齐虚拟控制点，使得端点也平滑
  const pts = [
    { x: 0, y: points[0].y },
    ...points,
    { x: 600, y: points[points.length - 1].y },
  ];

  let path = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

const curveStrokePath = computed(() => {
  return getCatmullRomSplinePath(curvePoints.value);
});

const curveAreaPath = computed(() => {
  const strokePath = curveStrokePath.value;
  if (!strokePath) return "";
  return `${strokePath} L 600 60 L 0 60 Z`;
});
</script>

<style scoped lang="scss">
.eq-content { display: grid; gap: 16px; user-select: none; }
.eq-control-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.eq-control-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.eq-preset-select { width: 180px; }
.eq-section { display: grid; gap: 12px; min-width: 0; }
.eq-section-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.eq-faders-scroll { overflow-x: auto; }

.eq-curve-container {
  position: relative;
  width: 100%;
  height: 96px;
  border-radius: var(--radius-control);
  background: var(--surface-input);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
  transition: opacity 0.25s ease;

  &.is-disabled {
    opacity: 0.45;
  }

  .eq-curve-svg {
    width: 100%;
    height: 100%;
    display: block;

    .ref-line {
      stroke: var(--border-subtle);
      stroke-width: 1;

      &.center-line {
        stroke-dasharray: 4, 3;
        stroke: var(--border-default);
      }
    }

    .curve-stroke {
      fill: none;
      stroke-width: 2.2;
      stroke-linecap: round;
      transition: d 0.15s ease-out;
    }

    .curve-area {
      transition: d 0.15s ease-out;
    }

    .curve-node {
      fill: var(--surface-card);
      stroke: var(--color-primary, #18a058);
      stroke-width: 2;
      transition: all 0.15s ease-out;

      &.is-active {
        fill: var(--color-primary, #18a058);
      }
    }
  }

  .scale-indicators {
    position: absolute;
    right: 8px;
    top: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 6px 0;
    pointer-events: none;

    .scale-label {
      font-size: 9px;
      color: var(--text-muted);
      font-family: monospace;
      line-height: 1;
    }
  }
}

.eq-faders-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 520px;
  padding: 16px 12px;
  background: var(--surface-input);
  border-radius: var(--radius-control);
  border: 1px solid var(--border-subtle);
  transition: opacity 0.25s ease;

  &.is-disabled {
    opacity: 0.45;
  }

  .fader-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;

    .fader-val {
      font-size: 10.5px;
      font-family: monospace;
      font-weight: 600;
      line-height: 1;
      height: 12px;

      &.val-positive {
        color: var(--text-accent);
      }

      &.val-negative {
        color: #3b82f6;
      }

      &.val-zero {
        color: var(--text-muted);
      }
    }

    .slider-track-box {
      position: relative;
      height: 130px;
      display: flex;
      align-items: center;
      justify-content: center;

      .zero-tick {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 14px;
        height: 1px;
        background: var(--border-subtle);
        pointer-events: none;
      }
    }

    .fader-label {
      font-size: 11px;
      color: var(--text-secondary);
      font-weight: 500;
      line-height: 1;
    }

    &.preamp-col {
      min-width: 54px;

      .preamp-label {
        font-weight: 700;
        color: var(--text-primary);
      }
    }
  }

  .fader-divider {
    width: 1px;
    height: 150px;
    background: var(--border-subtle);
    margin: 0 4px;
  }

  .bands-faders {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 1;
    padding: 0 4px;

    .band-col {
      flex: 1;
      min-width: 38px;
    }
  }
}
</style>
