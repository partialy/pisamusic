<template>
  <div
    class="batch-segmented-actions"
    :class="{ 'always-show-label': alwaysShowLabel }"
    role="group"
    :aria-label="ariaLabel"
  >
    <template v-for="action in actions" :key="action.key">
      <n-dropdown
        v-if="action.dropdownOptions?.length"
        trigger="click"
        :options="action.dropdownOptions"
        :disabled="action.disabled"
        @select="(optionKey) => emit('dropdownSelect', action.key, String(optionKey))"
      >
        <button
          type="button"
          class="batch-segment"
          :class="{ 'is-primary': action.primary }"
          :disabled="action.disabled || action.loading"
          :title="action.label"
          :aria-label="action.label"
          :aria-busy="action.loading || undefined"
        >
          <component
            :is="action.loading && action.spinIcon !== true ? LoadingIcon : action.icon"
            :size="17"
            :stroke-width="1.8"
            class="batch-segment-icon"
            :class="{ spinning: action.loading }"
            aria-hidden="true"
          />
          <span class="batch-segment-label" aria-hidden="true">
            <span class="batch-segment-text">{{ action.label }}</span>
          </span>
        </button>
      </n-dropdown>

      <button
        v-else
        type="button"
        class="batch-segment"
        :class="{ 'is-primary': action.primary }"
        :disabled="action.disabled || action.loading"
        :title="action.label"
        :aria-label="action.label"
        :aria-busy="action.loading || undefined"
        @click="(event) => emit('action', action.key, event)"
      >
        <component
          :is="action.loading && action.spinIcon !== true ? LoadingIcon : action.icon"
          :size="17"
          :stroke-width="1.8"
          class="batch-segment-icon"
          :class="{ spinning: action.loading }"
          aria-hidden="true"
        />
        <span class="batch-segment-label" aria-hidden="true">
          <span class="batch-segment-text">{{ action.label }}</span>
        </span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import { NDropdown, type DropdownOption } from "naive-ui";
import { LoadingIcon } from "@/icons";

export interface SegmentedActionItem {
  key: string;
  label: string;
  icon: Component;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
  spinIcon?: boolean;
  dropdownOptions?: DropdownOption[];
}

withDefaults(
  defineProps<{
    actions: SegmentedActionItem[];
    alwaysShowLabel?: boolean;
    ariaLabel?: string;
  }>(),
  {
    alwaysShowLabel: false,
    ariaLabel: "批量操作",
  }
);

const emit = defineEmits<{
  action: [key: string, event: MouseEvent];
  dropdownSelect: [actionKey: string, optionKey: string];
}>();
</script>

<style scoped>
.batch-segmented-actions {
  box-sizing: border-box;
  height: var(--batch-control-height, 36px);
  display: inline-flex;
  align-items: stretch;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: var(--surface-card);
  color: var(--text-primary);
}

.batch-segment {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 100%;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: background 300ms ease, color 300ms ease;
}

.always-show-label .batch-segment {
  padding: 0 14px;
}

.batch-segment + .batch-segment {
  border-left: 1px solid var(--border-subtle);
}

.batch-segment.is-primary {
  background: var(--color-primary);
  color: var(--text-on-accent, #ffffff);
  font-weight: 600;
}

.batch-segment.is-primary + .batch-segment {
  border-left-color: transparent;
}

.batch-segment:hover:not(:disabled),
.batch-segment:focus-visible {
  color: var(--text-accent);
  background: var(--surface-control-hover);
}

.batch-segment.is-primary:hover:not(:disabled),
.batch-segment.is-primary:focus-visible {
  color: var(--text-on-accent, #ffffff);
  background: var(--color-primary-hover);
}

.batch-segment:focus-visible {
  outline: 2px solid var(--text-accent);
  outline-offset: -3px;
  border-radius: inherit;
}

.batch-segment:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.batch-segment-icon {
  flex: 0 0 auto;
  width: 17px;
  height: 17px;
  font-size: 17px;
}

.batch-segment-label {
  display: grid;
  grid-template-columns: 0fr;
  margin-left: 0;
  opacity: 0;
  font-size: 13px;
  transition: grid-template-columns 300ms ease, margin-left 300ms ease, opacity 300ms ease;
}

.always-show-label .batch-segment-label {
  grid-template-columns: 1fr;
  margin-left: 6px;
  opacity: 1;
}

.batch-segment-text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.batch-segment:hover .batch-segment-label,
.batch-segmented-actions:not(:hover) .batch-segment:focus-visible .batch-segment-label {
  grid-template-columns: 1fr;
  margin-left: 6px;
  opacity: 1;
}

.spinning {
  animation: segment-spin 1s linear infinite;
}

@keyframes segment-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .batch-segment-label,
  .batch-segment {
    transition: none;
  }

  .spinning {
    animation: none;
  }
}
</style>
