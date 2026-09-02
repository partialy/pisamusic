<template>
  <n-modal
    v-model:show="equalizerStore.showModal"
    transform-origin="center"
    class="equalizer-modal"
  >
    <n-card class="equalizer-card" :bordered="false" role="dialog" aria-modal="true">
      <!-- 头部：标题、状态开关、操作按钮 -->
      <div class="eq-header">
        <div class="header-left">
          <div class="title-icon-box" :class="{ 'is-active': equalizerStore.enabled }">
            <Sliders :size="18" />
          </div>
          <div class="title-info">
            <span class="main-title">均衡器</span>
            <span class="status-tag" :class="{ 'is-active': equalizerStore.enabled }">
              {{ equalizerStore.enabled ? "已开启" : "已旁路 (关闭)" }}
            </span>
          </div>
          <n-switch
            :value="equalizerStore.enabled"
            size="small"
            class="eq-switch"
            @update:value="equalizerStore.setEnabled"
          />
        </div>

        <div class="header-right">
          <button
            type="button"
            class="header-action-btn"
            title="重置为默认平坦"
            @click="equalizerStore.reset"
          >
            <RotateCcw :size="14" />
            <span>重置</span>
          </button>
          <button
            type="button"
            class="header-close-btn"
            title="关闭"
            @click="equalizerStore.closeModal"
          >
            <X :size="16" />
          </button>
        </div>
      </div>

      <!-- 动态频响曲线图 (SVG 贝塞尔平滑曲线) -->
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

      <!-- 预设选择胶囊栏 -->
      <div class="eq-presets-wrapper">
        <div class="presets-scroll">
          <button
            v-for="preset in equalizerStore.presets"
            :key="preset.key"
            type="button"
            class="preset-pill"
            :class="{ active: equalizerStore.currentPresetKey === preset.key }"
            @click="equalizerStore.applyPreset(preset.key)"
          >
            {{ preset.name }}
          </button>
          <button
            type="button"
            class="preset-pill"
            :class="{ active: equalizerStore.currentPresetKey === 'custom' }"
            @click="equalizerStore.currentPresetKey = 'custom'"
          >
            自定义
          </button>
        </div>
      </div>

      <!-- 垂直推子矩阵 -->
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
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NModal, NCard, NSwitch, NSlider } from "naive-ui";
import { Sliders, RotateCcw, X } from "lucide-vue-next";
import { useEqualizerStore } from "@/store";

const equalizerStore = useEqualizerStore();

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
:global(.equalizer-modal) {
  width: auto !important;
}

:global(.equalizer-card.n-card) {
  width: 660px;
  max-width: calc(100vw - 32px);
  border-radius: 20px;
  background: color-mix(in srgb, var(--color-bg-default) 92%, transparent) !important;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
  border: 1px solid color-mix(in srgb, var(--color-text-secondary) 15%, transparent);
  padding: 8px 12px 16px 12px;
  user-select: none;
}

.eq-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .title-icon-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--color-text-secondary) 12%, transparent);
      color: var(--color-text-secondary);
      transition: all 0.25s ease;

      &.is-active {
        background: color-mix(in srgb, var(--color-primary) 18%, transparent);
        color: var(--color-primary);
      }
    }

    .title-info {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .main-title {
        font-size: 15px;
        font-weight: 700;
        color: var(--color-text-default);
        line-height: 1.2;
      }

      .status-tag {
        font-size: 11px;
        color: var(--color-text-secondary);
        opacity: 0.8;

        &.is-active {
          color: var(--color-primary);
          font-weight: 600;
          opacity: 1;
        }
      }
    }

    .eq-switch {
      margin-left: 6px;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .header-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 8px;
      border: none;
      background: color-mix(in srgb, var(--color-text-secondary) 10%, transparent);
      color: var(--color-text-secondary);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.18s ease;

      &:hover {
        background: color-mix(in srgb, var(--color-primary) 15%, transparent);
        color: var(--color-primary);
      }
    }

    .header-close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all 0.18s ease;

      &:hover {
        background: color-mix(in srgb, var(--color-text-secondary) 15%, transparent);
        color: var(--color-text-default);
      }
    }
  }
}

.eq-curve-container {
  position: relative;
  width: 100%;
  height: 96px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-bg-default) 50%, #00000018);
  border: 1px solid color-mix(in srgb, var(--color-text-secondary) 12%, transparent);
  overflow: hidden;
  margin-bottom: 14px;
  transition: opacity 0.25s ease;

  &.is-disabled {
    opacity: 0.45;
  }

  .eq-curve-svg {
    width: 100%;
    height: 100%;
    display: block;

    .ref-line {
      stroke: color-mix(in srgb, var(--color-text-secondary) 15%, transparent);
      stroke-width: 1;

      &.center-line {
        stroke-dasharray: 4, 3;
        stroke: color-mix(in srgb, var(--color-text-secondary) 25%, transparent);
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
      fill: var(--color-bg-default);
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
      color: var(--color-text-secondary);
      opacity: 0.6;
      font-family: monospace;
      line-height: 1;
    }
  }
}

.eq-presets-wrapper {
  margin-bottom: 14px;
  overflow-x: auto;
  padding-bottom: 2px;

  &::-webkit-scrollbar {
    display: none;
  }

  .presets-scroll {
    display: flex;
    align-items: center;
    gap: 6px;
    width: max-content;

    .preset-pill {
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--color-text-secondary) 15%, transparent);
      background: color-mix(in srgb, var(--color-text-secondary) 6%, transparent);
      color: var(--color-text-secondary);
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.18s ease;

      &:hover {
        border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
        color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      }

      &.active {
        border-color: var(--color-primary);
        background: var(--color-primary);
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 35%, transparent);
      }
    }
  }
}

.eq-faders-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 4px 4px 4px;
  background: color-mix(in srgb, var(--color-bg-default) 40%, #0000000d);
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--color-text-secondary) 10%, transparent);
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
        color: var(--color-primary);
      }

      &.val-negative {
        color: #3b82f6;
      }

      &.val-zero {
        color: var(--color-text-secondary);
        opacity: 0.7;
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
        background: color-mix(in srgb, var(--color-text-secondary) 30%, transparent);
        pointer-events: none;
      }
    }

    .fader-label {
      font-size: 11px;
      color: var(--color-text-secondary);
      font-weight: 500;
      line-height: 1;
    }

    &.preamp-col {
      min-width: 54px;

      .preamp-label {
        font-weight: 700;
        color: var(--color-text-default);
      }
    }
  }

  .fader-divider {
    width: 1px;
    height: 150px;
    background: color-mix(in srgb, var(--color-text-secondary) 15%, transparent);
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
