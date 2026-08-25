<template>
  <n-popover
    v-model:show="showPopover"
    :disabled="disabled"
    :placement="placement"
    :z-index="zIndex"
    trigger="click"
    show-arrow
    style="padding: 6px; border-radius: 12px; min-width: 140px; overflow: hidden;"
    class="play-mode-popover"
  >
    <template #trigger>
      <slot />
    </template>
    <div
      class="play-mode-options-list"
      role="listbox"
      @wheel.prevent.stop
    >
      <div
        v-for="option in resolvedOptions"
        :key="option.key"
        class="play-mode-option-item"
        :class="{
          'is-active': option.key === modelValue,
        }"
        role="option"
        :aria-selected="option.key === modelValue"
        @click="handleSelect(option.key)"
      >
        <div class="option-content">
          <n-icon v-if="option.icon" :component="option.icon" class="option-icon" size="18" />
          <span class="option-label" :title="option.label">{{ option.label }}</span>
        </div>
      </div>
    </div>
  </n-popover>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import { NPopover, NIcon } from "naive-ui";
import type { RepeatMode } from "@/store/audio";
import {
  ListRandomIcon,
  ListRepeatOffIcon,
  ListRepeatOneIcon,
  ListScrollIcon,
} from "@/icons";

export interface PlayModeOption {
  label: string;
  key: RepeatMode;
  icon: Component;
}

const DEFAULT_OPTIONS: PlayModeOption[] = [
  { label: "列表循环", key: "all", icon: ListScrollIcon },
  { label: "随机播放", key: "random", icon: ListRandomIcon },
  { label: "单曲循环", key: "single", icon: ListRepeatOneIcon },
  { label: "顺序播放", key: "none", icon: ListRepeatOffIcon },
];

const props = withDefaults(
  defineProps<{
    modelValue?: RepeatMode;
    options?: PlayModeOption[];
    placement?: "top" | "bottom" | "top-start" | "top-end" | "bottom-start" | "bottom-end";
    disabled?: boolean;
    zIndex?: number;
  }>(),
  {
    modelValue: "all",
    options: undefined,
    placement: "top",
    disabled: false,
    zIndex: 3500,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", mode: RepeatMode): void;
  (e: "select", mode: RepeatMode): void;
}>();

const showPopover = ref(false);
const resolvedOptions = computed<PlayModeOption[]>(() => props.options || DEFAULT_OPTIONS);

function handleSelect(mode: RepeatMode) {
  showPopover.value = false;
  emit("update:modelValue", mode);
  emit("select", mode);
}
</script>

<style scoped lang="scss">
.play-mode-options-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  user-select: none;
  overflow: hidden;
  overscroll-behavior: contain;
}

.play-mode-option-item {
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

  .option-content {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .option-icon {
    flex-shrink: 0;
    font-size: 18px;
  }

  .option-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>

<style lang="scss">
.play-mode-popover {
  overflow: hidden !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;

  &::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
}
</style>
