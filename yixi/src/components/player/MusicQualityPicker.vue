<template>
  <n-popover
    v-model:show="showPopover"
    :disabled="disabled || !options.length"
    :placement="placement"
    :z-index="zIndex"
    trigger="click"
    show-arrow
    style="padding: 6px; border-radius: 12px; min-width: 160px; overflow: hidden;"
    class="music-quality-popover"
  >
    <template #trigger>
      <slot />
    </template>
    <div
      class="quality-options-list"
      role="listbox"
    >
      <div
        v-for="option in options"
        :key="option.key"
        class="quality-option-item"
        :class="{
          'is-active': option.key === modelValue,
          'is-disabled': !option.enabled,
        }"
        :aria-disabled="!option.enabled"
        role="option"
        :aria-selected="option.key === modelValue"
        @click="handleSelect(option)"
      >
        <span class="option-label" :title="option.label">{{ option.label }}</span>
        <span v-if="!option.enabled" class="access-badge">{{ option.badge || "需登录" }}</span>
      </div>
    </div>
  </n-popover>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NPopover } from "naive-ui";
import type { QualityAccessOption } from "@/musicQuality/musicQualityPolicy";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    options: QualityAccessOption[];
    placement?: "top" | "bottom" | "top-start" | "top-end" | "bottom-start" | "bottom-end";
    disabled?: boolean;
    zIndex?: number;
  }>(),
  {
    modelValue: "",
    placement: "top",
    disabled: false,
    zIndex: 3500,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", qualityKey: string): void;
  (e: "login-required"): void;
  (e: "unlock-required"): void;
}>();

const showPopover = ref(false);

function handleSelect(option: QualityAccessOption) {
  showPopover.value = false;
  if (!option.enabled) {
    if (option.unlockRequired) {
      emit("unlock-required");
    } else {
      emit("login-required");
    }
    return;
  }
  emit("update:modelValue", option.key);
}
</script>

<style scoped lang="scss">
.quality-options-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  user-select: none;
  max-height: 200px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;

  /* 细滚动条 */
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--color-text-secondary) 25%, transparent);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--color-text-secondary) 45%, transparent);
  }
}

.quality-option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
  color: var(--color-text-default);

  &:hover {
    background-color: var(--color-bg-hover, rgba(0, 0, 0, 0.06));
  }

  &.is-active {
    color: var(--color-primary);
    font-weight: 700;
  }

  &.is-disabled {
    color: var(--color-text-muted, #888888);

    &:hover {
      background-color: var(--color-bg-hover, rgba(0, 0, 0, 0.06));
    }
  }

  .option-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .access-badge {
    flex-shrink: 0;
    padding: 2px 7px;
    border-radius: 999px;
    background-color: rgba(32, 128, 240, 0.14);
    color: #2080f0;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0;
  }
}
</style>

<style lang="scss">
.music-quality-popover {
  border: 1px solid var(--color-border-default) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}
</style>
