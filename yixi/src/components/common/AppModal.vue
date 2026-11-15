<template>
  <n-modal
    v-bind="appModalProps"
    :show="show"
    :style="{ width: `min(${width}px, calc(100vw - 32px))` }"
    :closable="closable && !closeDisabled"
    :mask-closable="maskClosable && !closeDisabled"
    :close-on-esc="closeOnEsc && !closeDisabled"
    @update:show="updateShow"
    @after-leave="emit('afterLeave')">
    <template #header><slot name="header"><component :is="renderModalTitle(title, icon)" /></slot></template>
    <slot />
    <template v-if="$slots.footer" #footer><div class="app-modal-actions"><slot name="footer" /></div></template>
  </n-modal>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import { NModal } from "naive-ui";
import { appModalProps, renderModalTitle } from "@/utils/appModal";
const props = withDefaults(defineProps<{
  show: boolean;
  title: string;
  icon?: Component;
  width?: number;
  closeDisabled?: boolean;
  closable?: boolean;
  maskClosable?: boolean;
  closeOnEsc?: boolean;
}>(), { width: 440, closeDisabled: false, closable: true, maskClosable: false, closeOnEsc: true });
const emit = defineEmits<{ (event: "update:show", value: boolean): void; (event: "afterLeave"): void }>();
function updateShow(value: boolean) {
  if (!props.closeDisabled) emit("update:show", value);
}
</script>
