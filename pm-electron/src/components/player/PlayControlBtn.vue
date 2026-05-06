<template>
  <div class="btn-con">
    <n-button circle quaternary @click="player.prev" :disabled="loading">
      <template #icon>
        <n-icon class="icon" :component="PrevIcon" :color="props.color ?? '#000'" size="24px"></n-icon>
      </template>
    </n-button>
    <n-button
      circle
      tertiary
      @click="player.togglePlay"
      style="width: 48px; height: 48px"
      :loading="loading"
    >
      <template #icon>
        <n-icon class="icon" v-if="!isPlaying" :component="PlayAnim" :color="props.color ?? '#000'" size="36px"></n-icon>
        <n-icon class="icon" v-else :component="PauseAnim" :color="props.color ?? '#000'" size="36px"></n-icon>
      </template>
    </n-button>
    <n-button circle quaternary @click="player.next" :disabled="loading">
      <template #icon>
        <n-icon class="icon" :component="NextIcon" :color="props.color ?? '#000'" size="24px"></n-icon>
      </template>
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { NButton, NIcon } from "naive-ui";
import { PrevIcon, PlayAnim, NextIcon, PauseAnim } from "@/icons";
import { useAudioStore } from "@/store";
import { storeToRefs } from "pinia";
const player = useAudioStore();
const { isPlaying, loading } = storeToRefs(player);

const props = defineProps<{
  color?: string;
}>();
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

.icon {
  &:hover {
    animation: scaleBack 0.3s ease-in-out;
  }
}
</style>
