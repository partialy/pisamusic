<template>
  <AppModal :show="internalVisible" :title="title" :mask-closable="closeOnClickModal" @update:show="handleVisibleChange">
    <slot name="all-content">
      <slot name="content"><div class="dialog-text">{{ text }}</div></slot>
    </slot>
    <template v-if="showDefaultButtons && !$slots['all-content']" #footer>
      <n-button round @click="handleCancel">{{ cancelText }}</n-button>
      <n-button round type="primary" @click="handleConfirm">{{ confirmText }}</n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NButton } from "naive-ui";
import AppModal from "./AppModal.vue";

// 兼容旧入口；新增弹窗直接使用 AppModal 或 AppDialog。
const props = withDefaults(defineProps<{
  visible?: boolean;
  title?: string;
  text?: string;
  cancelText?: string;
  confirmText?: string;
  showDefaultButtons?: boolean;
  closeOnClickModal?: boolean;
}>(), { visible: false, title: "提示", text: "", cancelText: "取消", confirmText: "确定", showDefaultButtons: true, closeOnClickModal: false });
const emit = defineEmits<{
  "update:visible": [visible: boolean];
  confirm: [];
  cancel: [];
}>();
const internalVisible = ref(props.visible);
watch(() => props.visible, value => { internalVisible.value = value; });
function openDialog() { internalVisible.value = true; emit("update:visible", true); }
function closeDialog() { internalVisible.value = false; emit("update:visible", false); }
function handleCancel() { closeDialog(); emit("cancel"); }
function handleConfirm() { emit("confirm"); closeDialog(); }
function handleVisibleChange(value: boolean) { if (!value) handleCancel(); }
defineExpose({ openDialog, closeDialog, open: openDialog, close: closeDialog });
</script>

<style scoped>
.dialog-text { color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; }
</style>
