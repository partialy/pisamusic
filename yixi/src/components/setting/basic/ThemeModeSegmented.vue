<template>
  <div class="theme-mode-segmented" role="radiogroup" aria-label="主题模式">
    <button
      v-for="item in options"
      :key="item.value"
      type="button"
      role="radio"
      class="theme-mode-segment"
      :class="{ 'is-active': modelValue === item.value }"
      :aria-checked="modelValue === item.value"
      :title="item.label"
      :aria-label="item.label"
      @click="emit('update:modelValue', item.value)"
    >
      <component :is="item.icon" :size="17" :stroke-width="1.8" class="segment-icon" aria-hidden="true" />
      <span class="segment-label" aria-hidden="true">
        <span class="segment-text">{{ item.label }}</span>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Monitor, Moon, Sun } from "lucide-vue-next";
import type { ThemeMode } from "@/store/theme";

defineProps<{
  modelValue: ThemeMode;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ThemeMode];
}>();

const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
];
</script>

<style scoped>
.theme-mode-segmented {
  box-sizing: border-box;
  height: 36px;
  display: inline-flex;
  align-items: stretch;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: var(--surface-card);
  color: var(--text-primary);
}

.theme-mode-segment {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 100%;
  padding: 0 11px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background 300ms ease, color 300ms ease;
}

.theme-mode-segment + .theme-mode-segment {
  border-left: 1px solid var(--border-subtle);
}

.theme-mode-segment:hover,
.theme-mode-segment:focus-visible {
  color: var(--text-accent);
  background: var(--surface-control-hover);
}

.theme-mode-segment.is-active {
  color: var(--text-accent);
  background: var(--surface-control-active);
  font-weight: 600;
}

.theme-mode-segment:focus-visible {
  outline: 2px solid var(--text-accent);
  outline-offset: -3px;
  border-radius: inherit;
}

.segment-icon {
  flex: 0 0 auto;
}

.segment-label {
  display: grid;
  grid-template-columns: 0fr;
  margin-left: 0;
  opacity: 0;
  font-size: 13px;
  transition: grid-template-columns 300ms ease, margin-left 300ms ease, opacity 300ms ease;
}

.segment-text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.theme-mode-segment:hover .segment-label,
.theme-mode-segmented:not(:hover) .theme-mode-segment:focus-visible .segment-label {
  grid-template-columns: 1fr;
  margin-left: 6px;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .segment-label,
  .theme-mode-segment {
    transition: none;
  }
}
</style>
