<template>
  <div class="setting-adjustment">
    <button type="button" :title="`减少${label}`" :aria-label="`减少${label}`" :disabled="value <= min" @click="update(value - step)"><Minus :size="14" /></button>
    <n-slider class="adjustment-track" :value="value" :min="min" :max="max" :step="step" :tooltip="false" :aria-label="label" @update:value="update" />
    <button type="button" :title="`增加${label}`" :aria-label="`增加${label}`" :disabled="value >= max" @click="update(value + step)"><Plus :size="14" /></button>
    <span class="adjustment-value">{{ value }}{{ suffix }}</span>
  </div>
</template>
<script setup lang="ts">
import { NSlider } from "naive-ui";
import { Minus, Plus } from "lucide-vue-next";
const props = withDefaults(defineProps<{ value: number; label: string; min?: number; max?: number; step?: number; suffix?: string }>(), { min: 0, max: 100, step: 1, suffix: "%" });
const emit = defineEmits<{ "update:value": [value: number] }>();
function update(value: number) { emit("update:value", Math.max(props.min, Math.min(props.max, value))); }
</script>
<style scoped lang="scss">
.setting-adjustment { display: flex; align-items: center; gap: 10px; width: 320px; max-width: 100%; min-width: 0; }
button { display: grid; place-items: center; flex: 0 0 28px; width: 28px; height: 28px; padding: 0; border-radius: 50%; border: 1px solid var(--border-subtle); background: var(--surface-input); color: var(--text-primary); cursor: pointer; }
button:hover:not(:disabled) { background: var(--surface-control-hover); color: var(--text-accent); }
button:focus-visible { outline: 2px solid var(--text-accent); outline-offset: 2px; }
button:disabled { opacity: .35; cursor: not-allowed; }
.adjustment-track { flex: 1 1 0; min-width: 0; }
.adjustment-value { flex: 0 0 44px; width: 44px; text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; color: var(--text-secondary); }
</style>
