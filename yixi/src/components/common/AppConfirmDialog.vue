<template>
  <AppDialog :show="isVisible" :options="dialogOptions"
    @positive="handleConfirm" @negative="handleCancel" @dismiss="handleCancel" @close="handleCancel" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { DialogOptions } from "naive-ui";
import { useThemeStore } from "@/store";
import AppDialog from "./AppDialog.vue";

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
const props = withDefaults(defineProps<ConfirmDialogOptions & { show?: boolean }>(), {
  show: false, title: "提示", content: "", confirmText: "确认", cancelText: "取消",
  confirmType: "error", maskClosable: false,
});
const emit = defineEmits<{ "update:show": [value: boolean]; confirm: []; cancel: [] }>();
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.surfaceScheme === "dark");
const isVisible = ref(false);
const activeOptions = ref<ConfirmDialogOptions>({});
let promiseResolve: ((value: boolean) => void) | null = null;
watch(() => props.show, (show) => {
  isVisible.value = show;
  if (!show) settle(false);
}, { immediate: true });
const mergedOptions = computed(() => ({ ...props, ...activeOptions.value }));
const dialogOptions = computed<DialogOptions>(() => {
  const options = mergedOptions.value;
  return {
    title: options.title,
    content: options.content,
    positiveText: options.confirmText,
    negativeText: options.cancelText,
    type: options.confirmType === "error" ? "error" : "info",
    maskClosable: options.maskClosable,
    style: options.background ? { background: options.background } : undefined,
    positiveButtonProps: { type: options.confirmType || "primary", color: options.confirmColor },
    negativeButtonProps: { type: "default", style: options.cancelColor ? { color: options.cancelColor } : undefined },
  };
});
function settle(value: boolean) {
  const resolve = promiseResolve;
  promiseResolve = null;
  resolve?.(value);
}
function open(options?: ConfirmDialogOptions): Promise<boolean> {
  settle(false);
  activeOptions.value = options || {};
  isVisible.value = true;
  emit("update:show", true);
  return new Promise((resolve) => { promiseResolve = resolve; });
}
function close() {
  isVisible.value = false;
  emit("update:show", false);
  settle(false);
}
function handleCancel() {
  close();
  emit("cancel");
}
function handleConfirm() {
  isVisible.value = false;
  emit("update:show", false);
  emit("confirm");
  settle(true);
}
onBeforeUnmount(() => settle(false));
defineExpose({ open, close, isDark });
</script>
