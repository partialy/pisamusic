<template>
  <div class="accent-pill-input" :class="{ 'is-focused': isFocused }">
    <div class="color-dot-picker" title="选择主题色">
      <n-color-picker
        :value="value"
        :show-alpha="false"
        :modes="['hex']"
        :render-label="() => ''"
        @update:value="handlePickerChange"
      />
    </div>
    <input
      ref="inputRef"
      v-model="draftHex"
      type="text"
      class="hex-input"
      maxlength="7"
      spellcheck="false"
      aria-label="主题色 16 进制色值"
      @focus="isFocused = true"
      @blur="handleBlur"
      @keydown.enter="handleEnter"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NColorPicker } from "naive-ui";

const props = defineProps<{
  value: string;
}>();

const emit = defineEmits<{
  "update:value": [value: string];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const draftHex = ref(props.value);
const isFocused = ref(false);

watch(
  () => props.value,
  (nextValue) => {
    if (!isFocused.value) {
      draftHex.value = nextValue;
    }
  }
);

function handlePickerChange(nextColor: string) {
  const normalized = parseHexColor(nextColor);
  if (!normalized) return;
  draftHex.value = normalized;
  emit("update:value", normalized);
}

function handleEnter() {
  inputRef.value?.blur();
}

function handleBlur() {
  isFocused.value = false;
  const parsed = parseHexColor(draftHex.value);
  if (!parsed) {
    window.$message?.error("输入值不合法");
    draftHex.value = props.value;
    return;
  }
  draftHex.value = parsed;
  if (parsed !== props.value.toLowerCase()) {
    emit("update:value", parsed);
  }
}

function parseHexColor(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}
</script>

<style scoped lang="scss">
.accent-pill-input {
  box-sizing: border-box;
  height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px 0 6px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-input);
  transition: border-color 0.2s ease, background-color 0.2s ease;

  &:hover {
    border-color: var(--border-default);
    background: var(--surface-input-hover);
  }

  &.is-focused {
    border-color: var(--text-accent);
  }
}

.color-dot-picker {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  border-radius: 50%;
  transition: transform 0.16s ease;

  &:hover {
    transform: scale(1.08);
  }

  :deep(.n-color-picker) {
    display: block;
    width: 24px;
    height: 24px;
    min-width: 24px;
    border-radius: 50%;
    overflow: hidden;
  }

  :deep(.n-color-picker__fill),
  :deep(.n-color-picker-checkboard),
  :deep(.n-color-picker__fill > div) {
    border-radius: 50%;
  }

  :deep(.n-color-picker__value) {
    display: none;
  }
}

.hex-input {
  width: 72px;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  padding: 0;
}
</style>
