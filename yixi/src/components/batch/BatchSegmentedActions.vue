<template>
  <div class="batch-segmented-actions" role="group" aria-label="批量操作">
    <button v-for="action in actions" :key="action.key" type="button" class="batch-segment"
      :disabled="action.disabled || action.loading" :title="action.label" :aria-label="action.label"
      :aria-busy="action.loading || undefined" @click="emit('action', action.key)">
      <component :is="action.icon" :size="17" :stroke-width="1.8" class="batch-segment-icon" :class="{ spinning: action.loading }" aria-hidden="true" />
      <span class="batch-segment-label" aria-hidden="true"><span class="batch-segment-text">{{ action.label }}</span></span>
    </button>
  </div>
</template>
<script setup lang="ts">
import type { Component } from "vue";
defineProps<{ actions: { key: string; label: string; icon: Component; disabled?: boolean; loading?: boolean }[] }>();
const emit = defineEmits<{ action: [key: string] }>();
</script>
<style scoped>
.batch-segmented-actions { box-sizing: border-box; height: var(--batch-control-height, 36px); display: inline-flex; align-items: stretch; flex-shrink: 0; overflow: hidden; border: 1px solid var(--border-subtle); border-radius: var(--radius-pill); background: var(--surface-card); color: var(--text-primary); }
.batch-segment { display: inline-flex; align-items: center; justify-content: center; min-width: 38px; height: 100%; padding: 0 10px; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; transition: background 300ms ease, color 300ms ease; }
.batch-segment + .batch-segment { border-left: 1px solid var(--border-subtle); }
.batch-segment:hover:not(:disabled), .batch-segment:focus-visible { color: var(--text-accent); background: var(--surface-control-hover); }
.batch-segment:focus-visible { outline: 2px solid var(--text-accent); outline-offset: -3px; border-radius: inherit; }
.batch-segment:disabled { opacity: .4; cursor: not-allowed; }
.batch-segment-icon { flex: 0 0 auto; }
.batch-segment-label { display: grid; grid-template-columns: 0fr; margin-left: 0; opacity: 0; font-size: 13px; transition: grid-template-columns 300ms ease, margin-left 300ms ease, opacity 300ms ease; }
.batch-segment-text { min-width: 0; overflow: hidden; white-space: nowrap; }
.batch-segment:hover .batch-segment-label, .batch-segmented-actions:not(:hover) .batch-segment:focus-visible .batch-segment-label { grid-template-columns: 1fr; margin-left: 6px; opacity: 1; }
.spinning { animation: segment-spin 1s linear infinite; }
@keyframes segment-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .batch-segment-label, .batch-segment { transition: none; } .spinning { animation: none; } }
</style>
