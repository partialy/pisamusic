<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    :close-on-esc="false"
    :internal-appear="true"
    transform-origin="center"
    @update:show="handleVisibleChange"
    @after-leave="emit('afterLeave')">
    <n-card
      class="direct-message-dialog"
      :bordered="false"
      :closable="false"
      role="dialog"
      aria-modal="true">
      <template #header>
        <div class="direct-message-title">提示</div>
      </template>

      <div class="direct-message-content">{{ message?.content || "" }}</div>

      <template #footer>
        <div class="direct-message-footer">
          <n-button type="primary" :disabled="confirmDisabled" @click="emit('confirmed')">
            我知道了
          </n-button>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { NButton, NCard, NModal } from "naive-ui";
import type { DirectMessageItem } from "@/types/directMessage";

defineOptions({ name: "DirectMessageDialog" });

const props = defineProps<{
  show: boolean;
  message: DirectMessageItem | null;
  unlockAt: number | null;
}>();

const emit = defineEmits<{
  confirmed: [];
  afterLeave: [];
}>();

const currentTime = ref(performance.now());
let unlockTimer: ReturnType<typeof setTimeout> | undefined;

const confirmDisabled = computed(() => {
  if (!props.message || props.unlockAt === null) return true;
  return currentTime.value < props.unlockAt;
});

function clearUnlockTimer() {
  if (unlockTimer) clearTimeout(unlockTimer);
  unlockTimer = undefined;
}

function syncUnlockTimer() {
  clearUnlockTimer();
  currentTime.value = performance.now();
  if (!props.show || props.unlockAt === null || currentTime.value >= props.unlockAt) return;
  unlockTimer = setTimeout(() => {
    currentTime.value = performance.now();
  }, Math.ceil(props.unlockAt - currentTime.value));
}

function handleVisibleChange() {
  // 只能由“我知道了”推进队列，遮罩与 ESC 不得关闭弹窗。
}

watch(() => [props.show, props.unlockAt] as const, syncUnlockTimer, { immediate: true });

onBeforeUnmount(clearUnlockTimer);
</script>

<style lang="scss" scoped>
.direct-message-dialog {
  width: min(560px, calc(100vw - 48px));
  max-height: calc(100vh - 80px);
  overflow: hidden;
  border-radius: 14px;
  background-color: var(--color-bg-default);
  color: var(--color-text-default);
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.24);
}

.direct-message-title {
  color: var(--color-text-default);
  font-size: 18px;
  font-weight: 700;
}

.direct-message-content {
  max-height: min(60vh, 560px);
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  color: var(--color-text-default);
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.direct-message-content::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.direct-message-footer {
  display: flex;
  justify-content: center;
}
</style>
