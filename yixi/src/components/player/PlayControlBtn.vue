<template>
  <div class="btn-con">
    <n-button circle quaternary class="side-btn" @click="player.prev" :disabled="loading">
      <template #icon>
        <n-icon class="icon" :component="PrevIcon" :color="sideIconColor" size="24px"></n-icon>
      </template>
    </n-button>
    <n-button
      class="play-btn"
      circle
      tertiary
      @click="player.togglePlay"
      style="width: 48px; height: 48px"
      :loading="loading"
    >
      <template #icon>
        <n-icon class="icon" v-if="!isPlaying" :component="PlayAnim" :color="sideIconColor" size="36px"></n-icon>
        <n-icon class="icon" v-else :component="PauseAnim" :color="sideIconColor" size="36px"></n-icon>
      </template>
    </n-button>
    <n-button circle quaternary class="side-btn" @click="player.next" :disabled="loading">
      <template #icon>
        <n-icon class="icon" :component="NextIcon" :color="sideIconColor" size="24px"></n-icon>
      </template>
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { NButton, NIcon } from "naive-ui";
import { PrevIcon, PlayAnim, NextIcon, PauseAnim } from "@/icons";
import { useAudioStore } from "@/store";
import { storeToRefs } from "pinia";
import { computed } from "vue";
const player = useAudioStore();
const { isPlaying, loading } = storeToRefs(player);

const props = defineProps<{
  color?: string;
}>();

const sideIconColor = computed(() => props.color ?? "var(--color-text-secondary)");
</script>

<style lang="scss" scoped>
@keyframes scaleBack {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(0.8);
  }

  100% {
    transform: scale(1);
  }
}

.btn-con {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
}

:deep(.side-btn) {
  color: var(--color-text-secondary);

  &:hover {
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }
}

:deep(.play-btn) {
  // background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  // box-shadow: 0 8px 22px color-mix(in srgb, var(--color-primary) 18%, transparent);
  &:hover {
    background: color-mix(in srgb, var(--color-primary) 18%, transparent);
  }
}

.icon {
  &:hover {
    animation: scaleBack 0.3s ease-in-out;
  }
}
</style>
