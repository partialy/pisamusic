<template>
  <n-modal
    v-model:show="innerVisible"
    transform-origin="center"
    :mask-closable="true"
    @after-leave="handleAfterLeave">
    <n-card
      class="image-center-card"
      :bordered="false"
      :content-style="{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '0',
        padding: '1rem',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }"
      role="dialog"
      aria-modal="true">
      <!-- 头部操作区 -->
      <div class="modal-header">
        <div class="header-left">
          <n-button
            secondary
            circle
            size="small"
            type="primary"
            title="添加图片"
            :loading="adding"
            @click="handlePickAndAdd">
            <template #icon>
              <n-icon :size="16"><Plus /></n-icon>
            </template>
          </n-button>

          <span
            class="btn-wrap"
            :title="checkedIds.length ? `删除 (${checkedIds.length})` : '删除图片'">
            <n-button
              secondary
              circle
              size="small"
              type="error"
              :disabled="!checkedIds.length"
              @click="handleRequestDelete">
              <template #icon>
                <n-icon :size="15"><Trash2 /></n-icon>
              </template>
            </n-button>
          </span>
        </div>

        <div class="header-title">图片库</div>

        <div class="header-right">
          <n-button
            quaternary
            circle
            size="small"
            title="关闭"
            @click="handleClose">
            <template #icon>
              <n-icon :size="18"><X /></n-icon>
            </template>
          </n-button>
        </div>
      </div>

      <!-- 图片网格展示区 -->
      <div class="modal-body">
        <div v-if="allImages.length" class="image-grid">
          <div
            v-for="item in allImages"
            :key="item.id"
            class="image-card"
            :class="{
              selected: selectedUrl === item.url,
              checked: isChecked(item.id),
            }"
            @click="handleSelect(item)"
            @dblclick="handleDoubleClick(item)">
            <img :src="item.url" class="card-thumb" :alt="item.name" />

            <!-- 左上角：自定义图片的多选删除复选框，预置图片的胶囊标签 -->
            <div class="card-top-action" @click.stop>
              <div
                v-if="!item.isPreset"
                class="checkbox-wrap"
                :class="{ active: isChecked(item.id) }"
                title="勾选用于批量删除"
                @click="toggleCheck(item.id)">
                <n-icon v-if="isChecked(item.id)" :size="12"><Check /></n-icon>
              </div>
              <span v-else class="preset-badge">预置</span>
            </div>

            <!-- 右下角：当前单选选中的高亮 Badge -->
            <div v-if="selectedUrl === item.url" class="selected-badge">
              <n-icon :size="12"><Check /></n-icon>
            </div>
          </div>
        </div>

        <div v-else class="empty-wrap">
          <n-empty description="暂无图片，点击左上角添加图片" />
        </div>
      </div>

      <!-- 底部操作区 -->
      <div class="modal-footer">
        <div class="footer-info">
          <span v-if="selectedUrl" class="selected-hint">
            已选择：{{ currentSelectedItem?.name || "1 张图片" }}
          </span>
          <span v-else class="empty-hint">请点击选择要应用的图片</span>
        </div>
        <div class="footer-actions">
          <n-button round secondary @click="handleClose">取消</n-button>
          <n-button
            round
            type="primary"
            :disabled="!selectedUrl"
            @click="handleConfirm">
            确定
          </n-button>
        </div>
      </div>

      <!-- 二次确认删除弹框 -->
      <AppConfirmDialog
        v-model:show="showDeleteConfirm"
        title="删除图片"
        :content="`确定要从图片库中删除选中的 ${checkedIds.length} 张图片吗？`"
        confirm-text="删除"
        confirm-type="error"
        @confirm="handleConfirmDelete" />

      <!-- 本地文件选择降级 input -->
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        style="display: none"
        @change="handleFileInputChange" />
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NCard, NEmpty, NIcon, NModal } from "naive-ui";
import { Check, Plus, Trash2, X } from "lucide-vue-next";
import { useImageManager, type ImageItem } from "@/composables/useImageManager";
import electronAPI from "@/utils/electron";
import AppConfirmDialog from "./AppConfirmDialog.vue";

const props = withDefaults(
  defineProps<{
    show?: boolean;
    currentUrl?: string;
  }>(),
  {
    show: false,
    currentUrl: "",
  }
);

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "confirm", url: string): void;
  (e: "cancel"): void;
}>();

const imageManager = useImageManager();
const { allImages } = imageManager;

const innerVisible = ref(props.show);
const selectedUrl = ref(props.currentUrl);
const checkedIds = ref<string[]>([]);
const adding = ref(false);
const showDeleteConfirm = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.show,
  (val) => {
    innerVisible.value = val;
    if (val) {
      selectedUrl.value = props.currentUrl;
      checkedIds.value = [];
      void imageManager.loadImages();
    }
  }
);

watch(innerVisible, (val) => {
  emit("update:show", val);
});

watch(
  () => props.currentUrl,
  (val) => {
    selectedUrl.value = val;
  }
);

const currentSelectedItem = computed<ImageItem | undefined>(() =>
  allImages.value.find((img) => img.url === selectedUrl.value)
);

function isChecked(id: string): boolean {
  return checkedIds.value.includes(id);
}

function toggleCheck(id: string) {
  const index = checkedIds.value.indexOf(id);
  if (index === -1) {
    checkedIds.value.push(id);
  } else {
    checkedIds.value.splice(index, 1);
  }
}

function handleSelect(item: ImageItem) {
  selectedUrl.value = item.url;
}

function handleDoubleClick(item: ImageItem) {
  selectedUrl.value = item.url;
  handleConfirm();
}

async function handlePickAndAdd() {
  adding.value = true;
  try {
    if (electronAPI.selectBackgroundImages) {
      const filePaths = await electronAPI.selectBackgroundImages();
      if (filePaths && filePaths.length > 0) {
        const items = filePaths.map((filePath) => {
          const clean = filePath.split("/").pop() || "";
          return {
            url: filePath,
            name: clean ? decodeURIComponent(clean) : undefined,
          };
        });
        const addedList = await imageManager.addImages(items);
        if (addedList.length > 0) {
          selectedUrl.value = addedList[0].url;
          window.$message?.success(
            addedList.length > 1
              ? `已添加 ${addedList.length} 张图片到图片库`
              : "图片已加入图片库"
          );
        }
      }
    } else if (electronAPI.selectBackgroundImage) {
      const filePath = await electronAPI.selectBackgroundImage();
      if (filePath) {
        const added = await imageManager.addImage(filePath);
        if (added) {
          selectedUrl.value = added.url;
          window.$message?.success("图片已加入图片库");
        }
      }
    } else {
      fileInputRef.value?.click();
    }
  } catch (error) {
    console.error("添加图片失败:", error);
    fileInputRef.value?.click();
  } finally {
    adding.value = false;
  }
}

function handleFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files ? Array.from(target.files) : [];
  if (!files.length) return;

  const readPromises = files.map((file) => {
    return new Promise<{ url: string; name: string } | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          resolve({ url: dataUrl, name: file.name });
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  });

  void Promise.all(readPromises).then(async (results) => {
    const validItems = results.filter(
      (item): item is { url: string; name: string } => Boolean(item)
    );
    if (validItems.length > 0) {
      const addedList = await imageManager.addImages(validItems);
      if (addedList.length > 0) {
        selectedUrl.value = addedList[0].url;
        window.$message?.success(
          addedList.length > 1
            ? `已添加 ${addedList.length} 张图片到图片库`
            : "图片已加入图片库"
        );
      }
    }
    target.value = "";
  });
}

function handleRequestDelete() {
  if (!checkedIds.value.length) return;
  showDeleteConfirm.value = true;
}

async function handleConfirmDelete() {
  const count = await imageManager.removeImages(checkedIds.value);
  window.$message?.success(`已删除 ${count} 张图片`);

  // 如果删除的图片包含了当前选中的项，重置选中项为列表第一张
  if (!allImages.value.some((img) => img.url === selectedUrl.value)) {
    selectedUrl.value = allImages.value[0]?.url || "";
  }
  checkedIds.value = [];
}

function handleClose() {
  innerVisible.value = false;
  emit("cancel");
}

function handleConfirm() {
  if (!selectedUrl.value) return;
  emit("confirm", selectedUrl.value);
  innerVisible.value = false;
}

function handleAfterLeave() {
  checkedIds.value = [];
}
</script>

<style lang="scss" scoped>
:global(.image-center-card.n-card) {
  width: 820px;
  max-width: calc(100vw - 32px);
  height: 550px;
  max-height: 85vh;
  border-radius: 20px;
  background: rgba(64, 70, 82, 0.78) !important;
  backdrop-filter: blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:global(.image-center-card .n-card__content) {
  padding: 1rem !important;
  display: flex !important;
  flex-direction: column !important;
  flex: 1 !important;
  height: 100% !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  background: transparent !important;
}

.modal-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
  min-height: 36px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 1;

    .btn-wrap {
      display: inline-flex;
    }
  }

  .header-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    user-select: none;
    pointer-events: none;
  }

  .header-right {
    display: flex;
    align-items: center;
    z-index: 1;
  }
}

.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem 0;
  user-select: none;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(160, 160, 160, 0.3);
    border-radius: 3px;
  }
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.image-card {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid transparent;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  background: rgba(0, 0, 0, 0.25);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
  }

  &.selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 30%, transparent);
  }

  &.checked {
    filter: brightness(0.95);
  }

  .card-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
  }

  .card-top-action {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 2;

    .checkbox-wrap {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 1.5px solid #ffffff;
      background: rgba(0, 0, 0, 0.38);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        transform: scale(1.1);
        background: rgba(0, 0, 0, 0.6);
      }

      &.active {
        background: #ef4444;
        border-color: #ef4444;
      }
    }

    .preset-badge {
      display: inline-block;
      padding: 2px 7px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.3;
      border-radius: 999px;
      color: #ffffff;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(4px);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    }
  }

  .selected-badge {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--color-primary);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    z-index: 2;
  }
}

.empty-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 240px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  flex-shrink: 0;

  .footer-info {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.68);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}
</style>
