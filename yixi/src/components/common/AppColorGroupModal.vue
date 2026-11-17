<template>
  <AppModal
    :show="show"
    :title="title"
    :icon="Palette"
    :width="500"
    @update:show="handleVisibleChange"
  >
    <div class="color-group-modal-content">
      <div class="section-container">
        <div class="section-title-row">
          <span class="section-title">颜色配置</span>
          <span class="section-count">{{ draftItems.length }}/{{ maxCount }}</span>
        </div>

        <div class="color-tags-container">
          <div
            v-for="item in draftItems"
            :key="item.id"
            class="color-tag-pill"
            :class="{ 'is-focused': focusedItemId === item.id }"
          >
            <div class="tag-color-dot" title="选择颜色">
              <n-color-picker
                :value="item.value"
                :show-alpha="false"
                :modes="['hex']"
                :render-label="() => ''"
                @update:value="(color) => handleItemPickerChange(item, color)"
              />
            </div>

            <input
              v-model="item.draft"
              type="text"
              class="tag-hex-input"
              maxlength="7"
              spellcheck="false"
              :aria-label="`颜色 ${item.id} 的 16 进制色值`"
              @focus="focusedItemId = item.id"
              @blur="handleItemInputBlur(item)"
              @keydown.enter="handleInputEnter"
            />

            <button
              type="button"
              class="tag-delete-btn"
              :disabled="!allowEditCount || draftItems.length <= minCount"
              :title="
                !allowEditCount
                  ? '当前不支持删除颜色'
                  : draftItems.length <= minCount
                    ? `至少保留 ${minCount} 个颜色`
                    : '删除此颜色'
              "
              @click="handleRemoveItem(item.id)"
            >
              &times;
            </button>
          </div>

          <n-popover
            v-if="allowEditCount && draftItems.length < maxCount"
            v-model:show="showAddPopover"
            trigger="click"
            placement="bottom"
            :show-arrow="true"
          >
            <template #trigger>
              <button type="button" class="add-color-chip">
                <span class="plus-icon">+</span> 添加颜色
              </button>
            </template>

            <div class="add-popover-content">
              <div class="popover-title">添加颜色</div>
              <div class="popover-form">
                <div class="popover-color-pill" :class="{ 'is-focused': newColorFocused }">
                  <div class="tag-color-dot" title="选择新颜色">
                    <n-color-picker
                      :value="newColorValue"
                      :show-alpha="false"
                      :modes="['hex']"
                      :render-label="() => ''"
                      @update:value="handleNewPickerChange"
                    />
                  </div>
                  <input
                    v-model="newColorDraft"
                    type="text"
                    class="tag-hex-input"
                    maxlength="7"
                    spellcheck="false"
                    aria-label="新增颜色 16 进制色值"
                    @focus="newColorFocused = true"
                    @blur="handleNewInputBlur"
                    @keydown.enter="handleInputEnter"
                  />
                </div>
                <n-button size="small" type="primary" @click="handleAddConfirm">
                  添加
                </n-button>
              </div>
            </div>
          </n-popover>
        </div>
      </div>
    </div>

    <template #footer>
      <n-button round @click="handleCancel">取消</n-button>
      <n-button round type="primary" @click="handleConfirm">确认</n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NButton, NColorPicker, NPopover } from "naive-ui";
import { Palette } from "lucide-vue-next";
import AppModal from "@/components/common/AppModal.vue";
import { parseHexColor, type ColorGroupItem } from "@/utils/colorHex";

interface DraftColorItem extends ColorGroupItem {
  draft: string;
}

const props = withDefaults(
  defineProps<{
    show: boolean;
    title?: string;
    items: ColorGroupItem[];
    minCount: number;
    maxCount: number;
    allowEditCount?: boolean;
  }>(),
  {
    title: "编辑颜色",
    allowEditCount: true,
  }
);

const emit = defineEmits<{
  "update:show": [value: boolean];
  confirm: [before: ColorGroupItem[], after: ColorGroupItem[]];
  cancel: [before: ColorGroupItem[]];
}>();

const beforeSnapshot = ref<ColorGroupItem[]>([]);
const draftItems = ref<DraftColorItem[]>([]);
const focusedItemId = ref<number | null>(null);

const showAddPopover = ref(false);
const newColorValue = ref("#000000");
const newColorDraft = ref("#000000");
const newColorFocused = ref(false);

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      initDraftState();
    } else {
      showAddPopover.value = false;
      focusedItemId.value = null;
      newColorFocused.value = false;
    }
  }
);

function initDraftState() {
  const snapshot = props.items.map((item) => ({
    id: item.id,
    value: parseHexColor(item.value) ?? "#000000",
  }));
  beforeSnapshot.value = snapshot;
  draftItems.value = snapshot.map((item) => ({
    id: item.id,
    value: item.value,
    draft: item.value,
  }));
  newColorValue.value = "#000000";
  newColorDraft.value = "#000000";
  showAddPopover.value = false;
}

function handleVisibleChange(visible: boolean) {
  if (!visible) {
    handleCancel();
  } else {
    emit("update:show", true);
  }
}

function handleItemPickerChange(item: DraftColorItem, nextColor: string) {
  const parsed = parseHexColor(nextColor);
  if (!parsed) return;
  item.value = parsed;
  item.draft = parsed;
}

function handleItemInputBlur(item: DraftColorItem): boolean {
  focusedItemId.value = null;
  const parsed = parseHexColor(item.draft);
  if (!parsed) {
    window.$message?.error("输入值不合法");
    item.draft = item.value;
    return false;
  }
  item.value = parsed;
  item.draft = parsed;
  return true;
}

function handleNewPickerChange(nextColor: string) {
  const parsed = parseHexColor(nextColor);
  if (!parsed) return;
  newColorValue.value = parsed;
  newColorDraft.value = parsed;
}

function handleNewInputBlur(): boolean {
  newColorFocused.value = false;
  const parsed = parseHexColor(newColorDraft.value);
  if (!parsed) {
    window.$message?.error("输入值不合法");
    newColorDraft.value = newColorValue.value;
    return false;
  }
  newColorValue.value = parsed;
  newColorDraft.value = parsed;
  return true;
}

function handleInputEnter(event: KeyboardEvent) {
  (event.target as HTMLInputElement | null)?.blur();
}

function handleRemoveItem(id: number) {
  if (!props.allowEditCount || draftItems.value.length <= props.minCount) return;
  draftItems.value = draftItems.value.filter((item) => item.id !== id);
}

function handleAddConfirm() {
  if (!props.allowEditCount || draftItems.value.length >= props.maxCount) return;
  if (!handleNewInputBlur()) return;
  const maxId = draftItems.value.reduce((acc, item) => Math.max(acc, item.id), -1);
  const color = newColorValue.value;
  draftItems.value.push({
    id: maxId + 1,
    value: color,
    draft: color,
  });
  newColorValue.value = "#000000";
  newColorDraft.value = "#000000";
  showAddPopover.value = false;
}

function handleCancel() {
  const before = beforeSnapshot.value.map((item) => ({ ...item }));
  emit("cancel", before);
  emit("update:show", false);
}

function handleConfirm() {
  for (const item of draftItems.value) {
    if (!handleItemInputBlur(item)) {
      return;
    }
  }
  const before = beforeSnapshot.value.map((item) => ({ ...item }));
  const after = draftItems.value.map((item) => ({ id: item.id, value: item.value }));
  emit("confirm", before, after);
  emit("update:show", false);
}
</script>

<style scoped lang="scss">
.color-group-modal-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .section-count {
    font-size: 12px;
    color: var(--text-secondary);
  }
}

.color-tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-tag-pill,
.popover-color-pill {
  box-sizing: border-box;
  height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 8px 0 6px;
  border-radius: var(--radius-pill);
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  transition: border-color 0.2s ease, background-color 0.2s ease;

  &:hover {
    border-color: var(--border-default);
    background: var(--surface-control-hover);
  }

  &.is-focused {
    border-color: var(--text-accent);
  }
}

.tag-color-dot {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  border-radius: 50%;
  transition: transform 0.16s ease;

  &:hover {
    transform: scale(1.08);
  }

  :deep(.n-color-picker) {
    display: block;
    width: 22px;
    height: 22px;
    min-width: 22px;
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

.tag-hex-input {
  width: 66px;
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

.tag-delete-btn {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 15px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;

  &:hover:not(:disabled) {
    color: #ef4444;
    background: var(--surface-hover);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.add-color-chip {
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 1px dashed var(--border-subtle);
  background: var(--surface-card);
  color: var(--text-secondary);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  .plus-icon {
    font-weight: 700;
    margin-right: 4px;
  }

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
    background: var(--surface-control-hover);
  }
}

.add-popover-content {
  padding: 4px 2px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .popover-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .popover-form {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
