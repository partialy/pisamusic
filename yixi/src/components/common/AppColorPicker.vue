<template>
  <!-- 单颜色模式：圆形色块 + 可选 16 进制输入框 -->
  <div
    v-if="singleColor"
    class="app-color-pill single-mode"
    :class="{ 'is-focused': isFocused, 'icon-only': !showInput, 'is-disabled': disabled }"
  >
    <div class="color-dot-picker" title="选择颜色">
      <n-color-picker
        :value="singleValue"
        :show-alpha="false"
        :modes="['hex']"
        :disabled="disabled"
        :render-label="() => ''"
        @update:value="handleSinglePickerChange"
      />
    </div>
    <input
      v-if="showInput"
      ref="singleInputRef"
      v-model="draftHex"
      type="text"
      class="hex-input"
      :class="{ 'is-readonly': !inputEditable }"
      :disabled="disabled"
      :readonly="!inputEditable"
      maxlength="7"
      spellcheck="false"
      aria-label="16 进制色值"
      @focus="handleSingleFocus"
      @blur="handleSingleBlur"
      @keydown.enter="handleSingleEnter"
    />
  </div>

  <!-- 多颜色模式：药丸排列圆形色块 + 超出展示 +N + 弹窗编辑 -->
  <div v-else class="app-color-pill-wrapper">
    <button
      type="button"
      class="app-color-pill multi-mode"
      :class="{ 'is-disabled': disabled }"
      :disabled="disabled"
      :title="title"
      @click="openGroupModal"
    >
      <span
        v-for="item in visibleGroupItems"
        :key="item.id"
        class="multi-color-dot"
        :style="{ backgroundColor: item.value }"
      />
      <span v-if="overflowCount > 0" class="multi-overflow-dot">
        +{{ overflowCount }}
      </span>
    </button>

    <AppColorGroupModal
      v-model:show="showGroupModal"
      :title="title"
      :items="groupItems"
      :min-count="bounds.min"
      :max-count="bounds.max"
      :allow-edit-count="allowEditCount"
      @confirm="handleGroupConfirm"
      @cancel="handleGroupCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NColorPicker } from "naive-ui";
import AppColorGroupModal from "@/components/common/AppColorGroupModal.vue";
import {
  parseHexColor,
  resolveColorGroupBounds,
  type ColorGroupItem,
} from "@/utils/colorHex";

const props = withDefaults(
  defineProps<{
    singleColor?: boolean;
    value: string | ColorGroupItem[];
    inputEditable?: boolean;
    showInput?: boolean;
    title?: string;
    maxCount?: number;
    minCount?: number;
    allowEditCount?: boolean;
    maxDisplayCount?: number;
    disabled?: boolean;
  }>(),
  {
    singleColor: true,
    inputEditable: true,
    showInput: true,
    title: "编辑颜色",
    maxCount: 2,
    minCount: 2,
    allowEditCount: true,
    maxDisplayCount: 3,
    disabled: false,
  }
);

const emit = defineEmits<{
  "update:value": [value: any];
  confirm: [before: ColorGroupItem[], after: ColorGroupItem[]];
  cancel: [before: ColorGroupItem[]];
}>();

const singleInputRef = ref<HTMLInputElement | null>(null);
const isFocused = ref(false);
const showGroupModal = ref(false);

const singleValue = computed(() => {
  if (typeof props.value === "string") {
    return parseHexColor(props.value) ?? "#000000";
  }
  return "#000000";
});

const draftHex = ref(singleValue.value);

watch(singleValue, (nextValue) => {
  if (!isFocused.value) {
    draftHex.value = nextValue;
  }
});

const groupItems = computed<ColorGroupItem[]>(() => {
  if (!Array.isArray(props.value)) return [];
  return props.value.map((item, idx) => ({
    id: typeof item?.id === "number" ? item.id : idx,
    value: parseHexColor(item?.value ?? "") ?? "#000000",
  }));
});

const bounds = computed(() => resolveColorGroupBounds(props.maxCount, props.minCount));

const normalizedMaxDisplay = computed(() =>
  typeof props.maxDisplayCount === "number" &&
  Number.isInteger(props.maxDisplayCount) &&
  props.maxDisplayCount >= 1
    ? props.maxDisplayCount
    : 3
);

const visibleGroupItems = computed(() =>
  groupItems.value.slice(0, normalizedMaxDisplay.value)
);

const overflowCount = computed(() =>
  Math.max(0, groupItems.value.length - normalizedMaxDisplay.value)
);

function handleSinglePickerChange(nextColor: string) {
  const parsed = parseHexColor(nextColor);
  if (!parsed) return;
  draftHex.value = parsed;
  emit("update:value", parsed);
}

function handleSingleFocus() {
  if (!props.inputEditable) return;
  isFocused.value = true;
}

function handleSingleEnter() {
  singleInputRef.value?.blur();
}

function handleSingleBlur() {
  isFocused.value = false;
  if (!props.inputEditable) return;
  const parsed = parseHexColor(draftHex.value);
  if (!parsed) {
    window.$message?.error("输入值不合法");
    draftHex.value = singleValue.value;
    return;
  }
  draftHex.value = parsed;
  if (parsed !== singleValue.value.toLowerCase()) {
    emit("update:value", parsed);
  }
}

function openGroupModal() {
  if (props.disabled) return;
  showGroupModal.value = true;
}

function handleGroupConfirm(before: ColorGroupItem[], after: ColorGroupItem[]) {
  emit("update:value", after);
  emit("confirm", before, after);
}

function handleGroupCancel(before: ColorGroupItem[]) {
  emit("cancel", before);
}
</script>

<style scoped lang="scss">
.app-color-pill-wrapper {
  display: inline-flex;
  align-items: center;
}

.app-color-pill {
  box-sizing: border-box;
  height: 36px;
  display: inline-flex;
  align-items: center;
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

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;

    &:hover {
      border-color: var(--border-subtle);
      background: var(--surface-input);
    }

    .color-dot-picker:hover {
      transform: none;
    }

    .hex-input {
      cursor: not-allowed;
    }
  }

  &.single-mode {
    gap: 8px;
    padding: 0 12px 0 6px;

    &.icon-only {
      padding: 0 6px;
      gap: 0;
    }
  }

  &.multi-mode {
    gap: 6px;
    padding: 0 8px;
    cursor: pointer;
    font: inherit;
    color: var(--text-primary);
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

  &.is-readonly {
    cursor: default;
    color: var(--text-secondary);
  }
}

.multi-color-dot {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  box-sizing: border-box;
  transition: transform 0.16s ease;

  .multi-mode:hover & {
    transform: scale(1.04);
  }
}

.multi-overflow-dot {
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  box-sizing: border-box;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
