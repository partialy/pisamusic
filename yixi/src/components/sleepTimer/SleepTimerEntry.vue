<template>
  <div class="sleep-timer-entry-wrapper">
    <n-tooltip trigger="hover" placement="bottom">
      <template #trigger>
        <!-- 定时进行中：胶囊形状按钮 (主色) -->
        <button
          v-if="sleepTimerStore.isActive"
          type="button"
          class="sleep-timer-pill"
          :class="{ 'waiting-song': sleepTimerStore.isWaitingForSongEnd }"
          @click="openModal"
        >
          <n-icon :component="SleepTimerIcon" :size="16" class="pill-icon" />
          <span class="pill-time">{{ sleepTimerStore.formattedRemaining }}</span>
        </button>

        <!-- 未开启定时：仅显示圆形图标按钮 -->
        <n-button
          v-else
          secondary
          class="sleep-timer-btn left-btn"
          @click="openModal"
        >
          <template #icon>
            <n-icon :component="SleepTimerIcon" :size="20" />
          </template>
        </n-button>
      </template>
      <span>{{ tooltipText }}</span>
    </n-tooltip>

    <!-- 配置弹窗 -->
    <SleepTimerModal v-model:show="showModal" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NIcon, NTooltip } from "naive-ui";
import { SleepTimerIcon } from "@/icons";
import { useSleepTimerStore } from "@/store";
import SleepTimerModal from "./SleepTimerModal.vue";

defineOptions({ name: "SleepTimerEntry" });

const sleepTimerStore = useSleepTimerStore();
const showModal = ref(false);

const tooltipText = computed(() => {
  if (sleepTimerStore.isWaitingForSongEnd) {
    return "定时倒计时已结束，将在当前歌曲播完后停止（点击查看）";
  }
  if (sleepTimerStore.enabled) {
    return `定时关闭中：剩余 ${sleepTimerStore.formattedRemainingFull}（点击查看）`;
  }
  return "定时关闭";
});

function openModal() {
  showModal.value = true;
}
</script>

<style scoped lang="scss">
.sleep-timer-entry-wrapper {
  display: inline-flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.sleep-timer-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: transparent;
  -webkit-app-region: no-drag;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: var(--color-primary);
  }
}

/* 主色胶囊按钮 */
.sleep-timer-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-default));
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 15%, transparent);

  &:hover {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 18%, var(--color-bg-default));
    transform: translateY(-1px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 25%, transparent);
  }

  .pill-icon {
    flex-shrink: 0;
  }

  .pill-time {
    line-height: 1;
    letter-spacing: 0.3px;
  }

  &.waiting-song {
    border-color: #f59e0b;
    background: color-mix(in srgb, #f59e0b 14%, var(--color-bg-default));
    color: #d97706;
    animation: pill-glow 2s infinite ease-in-out;
  }
}

@keyframes pill-glow {
  0%, 100% {
    box-shadow: 0 0 4px rgba(245, 158, 11, 0.2);
  }
  50% {
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.45);
  }
}
</style>
