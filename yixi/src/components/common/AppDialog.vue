<template>
  <AppModal
    :show="show"
    title="提示"
    :width="440"
    :class="options.class"
    :style="options.style"
    :close-disabled="busy || !!options.loading"
    :closable="options.closable !== false"
    :mask-closable="options.maskClosable === true"
    :close-on-esc="options.closeOnEsc !== false"
    :auto-focus="options.autoFocus !== false"
    :block-scroll="options.blockScroll !== false"
    :z-index="options.zIndex"
    @update:show="emit('dismiss')"
    @close="handleClose"
    @mask-click="options.onMaskClick?.($event)"
    @esc="options.onEsc?.()"
    @after-enter="options.onAfterEnter?.()"
    @after-leave="emit('afterLeave')">
    <template #header>
      <div class="app-modal-title">
        <n-icon v-if="options.showIcon !== false" :size="20">
          <RenderContent v-if="options.icon" :content="options.icon" />
          <component :is="dialogIcon" v-else />
        </n-icon>
        <RenderContent :content="options.title || '提示'" />
      </div>
    </template>
    <slot><div class="app-dialog-content" :class="options.contentClass" :style="options.contentStyle"><RenderContent :content="options.content" /></div></slot>
    <template v-if="$slots.footer || options.action || options.positiveText || options.negativeText" #footer>
      <slot name="footer">
        <RenderContent v-if="options.action" :content="options.action" />
        <template v-else>
          <n-button v-if="options.negativeText" v-bind="options.negativeButtonProps" :render-icon="options.negativeButtonProps?.renderIcon || renderCancelIcon" round :disabled="busy || !!options.loading || options.negativeButtonProps?.disabled" @click="emit('negative', $event)">{{ options.negativeText }}</n-button>
          <n-button v-if="options.positiveText" v-bind="options.positiveButtonProps" :render-icon="options.positiveButtonProps?.renderIcon || renderConfirmIcon" round :type="buttonType" :loading="busy || !!options.loading" @click="emit('positive', $event)">{{ options.positiveText }}</n-button>
        </template>
      </slot>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, type PropType, type VNodeChild } from "vue";
import { NButton, NIcon, type DialogOptions } from "naive-ui";
import { Check, Info, TriangleAlert, CircleAlert, CircleCheck, Trash2, X } from "lucide-vue-next";
import AppModal from "./AppModal.vue";

const props = withDefaults(defineProps<{ show: boolean; options: DialogOptions; busy?: boolean }>(), { busy: false });
const emit = defineEmits<{
  positive: [event: MouseEvent]; negative: [event: MouseEvent];
  dismiss: []; close: []; afterLeave: [];
}>();
const dialogIcon = computed(() => ({ warning: TriangleAlert, error: CircleAlert, success: CircleCheck, info: Info, default: Info }[props.options.type || "default"]));
const buttonType = computed(() => props.options.positiveButtonProps?.type || (props.options.type === "error" ? "error" : "primary"));
const renderCancelIcon = () => h(NIcon, { component: X });
const renderConfirmIcon = () => h(NIcon, { component: props.options.type === "error" ? Trash2 : Check });
function handleClose() {
  emit("close");
  // 由调用方决定异步关闭结果，阻止 Modal 自行隐藏。
  return false;
}
const RenderContent = defineComponent({
  props: { content: [String, Function] as PropType<string | (() => VNodeChild)> },
  setup: (props) => () => typeof props.content === "function" ? props.content() : props.content,
});
</script>

<style scoped>
.app-dialog-content { color: var(--text-secondary); line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
