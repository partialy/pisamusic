<template>
  <div class="startup-preview-card">
    <div class="preview-bar">
      <span class="preview-meta">
        {{ meta.label }} · {{ meta.cardless ? "无卡片悬浮形态" : "圆角卡片形态" }}（520×280 比例）
      </span>
      <div class="preview-bg-switch" role="group" aria-label="预览背景明暗">
        <button
          type="button"
          class="bg-chip"
          :class="{ 'is-active': previewSurface === 'light' }"
          @click="manualSurface = 'light'"
        >
          浅色背景
        </button>
        <button
          type="button"
          class="bg-chip"
          :class="{ 'is-active': previewSurface === 'dark' }"
          @click="manualSurface = 'dark'"
        >
          深色背景
        </button>
      </div>
    </div>

    <div
      ref="viewportRef"
      class="preview-viewport"
      :class="`is-${previewSurface}`"
      :style="{ height: `${Math.round(280 * stageScale + 32)}px` }"
    >
      <div
        class="preview-scale-box"
        :style="{ transform: `scale(${stageScale})` }"
      >
        <div
          ref="stageHostRef"
          class="startup-stage-host"
          :data-surface="previewSurface"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import appLogoUrl from "@/assets/pisamusic_icon_1024.png";
import "@/startup/startupAnimations.css";
import {
  getStartupAnimationMeta,
  type StartupAnimationStyle,
} from "@/startup/startupAnimationOptions";
import { mountStartupLoadingStage } from "@/startup/startupAnimationTemplates";

const props = defineProps<{
  styleId: StartupAnimationStyle;
  defaultSurface: "light" | "dark";
}>();

const viewportRef = ref<HTMLElement | null>(null);
const stageHostRef = ref<HTMLElement | null>(null);
const manualSurface = ref<"light" | "dark" | null>(null);
const stageScale = ref(0.92);

const previewSurface = computed(() => manualSurface.value ?? props.defaultSurface);
const meta = computed(() => getStartupAnimationMeta(props.styleId));

let resizeObserver: ResizeObserver | null = null;

function updateScale() {
  const viewport = viewportRef.value;
  if (!viewport) return;
  const availableW = Math.max(240, viewport.clientWidth - 28);
  stageScale.value = Math.min(1, Number((availableW / 520).toFixed(3)));
}

function renderStage() {
  const host = stageHostRef.value;
  if (!host) return;
  mountStartupLoadingStage(host, {
    style: props.styleId,
    logoUrl: appLogoUrl,
    showCloseButton: true,
    onCloseClick: () => {
      window.$message?.info("预览模式：正式启动时点击此处可停止启动并退出应用");
    },
  });
}

watch(
  () => props.defaultSurface,
  () => {
    manualSurface.value = null;
  },
);

watch(() => props.styleId, renderStage);

onMounted(() => {
  updateScale();
  renderStage();
  if (typeof ResizeObserver !== "undefined" && viewportRef.value) {
    resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(viewportRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<style scoped lang="scss">
.startup-preview-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.preview-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

.preview-bg-switch {
  display: inline-flex;
  padding: 2px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-input);
  gap: 2px;
}

.bg-chip {
  height: 24px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.bg-chip.is-active {
  background: var(--color-primary);
  color: #ffffff;
}

.preview-viewport {
  position: relative;
  width: 100%;
  min-height: 180px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-control);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: background 0.25s ease;

  &.is-light {
    background:
      linear-gradient(135deg, rgba(235, 244, 251, 0.96), rgba(226, 236, 246, 0.96)),
      repeating-linear-gradient(
        45deg,
        rgba(148, 163, 184, 0.08) 0,
        rgba(148, 163, 184, 0.08) 12px,
        transparent 12px,
        transparent 24px
      );
  }

  &.is-dark {
    background:
      linear-gradient(135deg, rgba(13, 22, 38, 0.96), rgba(23, 34, 56, 0.96)),
      repeating-linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.03) 0,
        rgba(255, 255, 255, 0.03) 12px,
        transparent 12px,
        transparent 24px
      );
  }
}

.preview-scale-box {
  width: 520px;
  height: 280px;
  flex-shrink: 0;
  transform-origin: center center;
}
</style>
