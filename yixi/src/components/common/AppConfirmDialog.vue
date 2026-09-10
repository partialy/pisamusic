<template>
  <Teleport to="body">
    <Transition name="app-confirm-fade">
      <div v-if="isVisible" class="app-confirm-overlay" @click="handleOverlayClick">
        <div
          class="app-confirm-card"
          role="dialog"
          aria-modal="true"
          :style="{ background: cardBackground }"
          @click.stop>
          <div class="app-confirm-body">
            <div class="app-confirm-title">{{ mergedOptions.title || "提示" }}</div>
            <div v-if="mergedOptions.content" class="app-confirm-content">
              {{ mergedOptions.content }}
            </div>
          </div>

          <div class="app-confirm-actions">
            <button
              type="button"
              class="app-confirm-btn cancel"
              :style="{ color: mergedOptions.cancelColor || 'var(--color-text-secondary)' }"
              @click="handleCancel">
              {{ mergedOptions.cancelText || "取消" }}
            </button>
            <button
              type="button"
              class="app-confirm-btn confirm"
              :style="{ color: confirmTextColor }"
              @click="handleConfirm">
              {{ mergedOptions.confirmText || "确认" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

export interface ConfirmDialogOptions {
  title?: string;
  content?: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  cancelColor?: string;
  confirmType?: "error" | "primary" | "default";
  maskClosable?: boolean;
  background?: string;
}

const props = withDefaults(
  defineProps<{
    show?: boolean;
    title?: string;
    content?: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: string;
    cancelColor?: string;
    confirmType?: "error" | "primary" | "default";
    maskClosable?: boolean;
    background?: string;
  }>(),
  {
    show: false,
    title: "提示",
    content: "",
    confirmText: "确认",
    cancelText: "取消",
    confirmType: "error",
    maskClosable: true,
  }
);

const emit = defineEmits<{
  "update:show": [value: boolean];
  confirm: [];
  cancel: [];
}>();

const isVisible = ref(false);
const activeOptions = ref<ConfirmDialogOptions>({});
let promiseResolve: ((value: boolean) => void) | null = null;

watch(
  () => props.show,
  (val) => {
    isVisible.value = val;
  },
  { immediate: true }
);

const mergedOptions = computed<ConfirmDialogOptions>(() => {
  return {
    title: activeOptions.value.title ?? props.title,
    content: activeOptions.value.content ?? props.content,
    confirmText: activeOptions.value.confirmText ?? props.confirmText,
    cancelText: activeOptions.value.cancelText ?? props.cancelText,
    confirmColor: activeOptions.value.confirmColor ?? props.confirmColor,
    cancelColor: activeOptions.value.cancelColor ?? props.cancelColor,
    confirmType: activeOptions.value.confirmType ?? props.confirmType,
    maskClosable: activeOptions.value.maskClosable ?? props.maskClosable,
    background: activeOptions.value.background ?? props.background,
  };
});

const cardBackground = computed(() => {
  return mergedOptions.value.background || "var(--color-bg-track)";
});

const confirmTextColor = computed(() => {
  if (mergedOptions.value.confirmColor) {
    return mergedOptions.value.confirmColor;
  }
  if (mergedOptions.value.confirmType === "error") {
    return "#ff4d4f";
  }
  if (mergedOptions.value.confirmType === "primary") {
    return "var(--color-primary)";
  }
  return "var(--color-text-default)";
});

function open(options?: ConfirmDialogOptions): Promise<boolean> {
  activeOptions.value = options || {};
  isVisible.value = true;
  emit("update:show", true);

  return new Promise<boolean>((resolve) => {
    promiseResolve = resolve;
  });
}

function close() {
  isVisible.value = false;
  emit("update:show", false);
  if (promiseResolve) {
    promiseResolve(false);
    promiseResolve = null;
  }
}

function handleOverlayClick() {
  if (mergedOptions.value.maskClosable) {
    handleCancel();
  }
}

function handleCancel() {
  isVisible.value = false;
  emit("update:show", false);
  emit("cancel");
  if (promiseResolve) {
    promiseResolve(false);
    promiseResolve = null;
  }
}

function handleConfirm() {
  isVisible.value = false;
  emit("update:show", false);
  emit("confirm");
  if (promiseResolve) {
    promiseResolve(true);
    promiseResolve = null;
  }
}

defineExpose({
  open,
  close,
});
</script>

<style scoped lang="scss">
.app-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  user-select: none;
}

.app-confirm-card {
  width: 290px;
  max-width: calc(100vw - 32px);
  background: var(--color-bg-track);
  border: 1px solid var(--color-border-default, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
}

.app-confirm-body {
  padding: 24px 20px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.app-confirm-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-default, #1f2329);
  line-height: 1.4;
}

.app-confirm-content {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--color-text-secondary, #646a73);
  word-break: break-word;
}

.app-confirm-actions {
  display: flex;
  flex-direction: row;
  height: 48px;
  border-top: 1px solid var(--color-border-default, #ececec);
}

.app-confirm-btn {
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: color-mix(in srgb, var(--color-text-default) 6%, transparent);
  }

  &:active {
    background-color: color-mix(in srgb, var(--color-text-default) 12%, transparent);
  }

  &.cancel {
    border-right: 1px solid var(--color-border-default, #ececec);
  }

  &.confirm {
    font-weight: 600;
  }
}

.app-confirm-fade-enter-active,
.app-confirm-fade-leave-active {
  transition: opacity 0.2s ease;

  .app-confirm-card {
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

.app-confirm-fade-enter-from,
.app-confirm-fade-leave-to {
  opacity: 0;

  .app-confirm-card {
    transform: scale(0.93);
  }
}
</style>
