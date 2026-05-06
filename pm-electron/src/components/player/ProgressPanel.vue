<template>
  <div class="progress-panel">
    <n-slider
      class="slider"
      v-model:value="currentTime"
      v-on:update-value="handleDrag"
      :tooltip="false"
      :step="0.1"
      :min="0"
      :max="duration">
      <template #thumb>
        <n-image
          class="rail-img"
          preview-disabled
          :src="logo"
          style="width: 16px; height: 16px; border-radius: 50%" />
      </template>
    </n-slider>
    <div class="time-info">
      <span class="time">{{ formatDuration(currentTime) }}</span>
      <span class="duration">{{ formatDuration(duration) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAudioStore } from "@/store";
import { formatDuration } from "@/utils/common";
import { NSlider, NImage } from "naive-ui";
import { storeToRefs } from "pinia";
import logo from "@/assets/logo-circle.png";
const player = useAudioStore();
const { currentTime, duration } = storeToRefs(player);

const handleDrag = (time: number) => {
  player.seek(time);
};
</script>

<style lang="scss" scoped>
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.progress-panel {
  width: 100%;
  height: 60px;
  position: relative;
  padding-top: 1rem;

  :deep(.n-slider .n-slider-rail .n-slider-rail__fill) {
    background-color: var(--color-primary);
  }

  .slider {
    position: absolute;
    top: 0;
    left: 0;

    .rail-img {
      will-change: auto;
      animation: rotate 12s linear infinite;
    }
  }

  .time-info {
    color: #999;
    font-size: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .time {
      margin-left: 10px;
    }

    .duration {
      margin-right: 10px;
    }
  }
}
</style>
