<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    :close-on-esc="false"
    :internal-appear="true"
    transform-origin="center"
    @update:show="handleVisibleChange"
    @after-leave="emit('afterLeave')">
    <n-card
      class="announcement-detail-modal"
      :bordered="false"
      :closable="false"
      role="dialog"
      aria-modal="true">
      <template #header>
        <div class="announcement-detail-title">公告</div>
      </template>

      <div class="announcement-detail-meta">
        <span>{{ announcement?.publisher || "PisaMusic Team" }}</span>
        <span>{{ announcement?.time || "刚刚" }}</span>
      </div>

      <div class="announcement-detail-content">
        <template v-for="(block, index) in content.blocks" :key="`${block.type}-${index}`">
          <span
            v-if="block.type === 'text'"
            class="announcement-text"
            :class="{ bold: block.bold }">{{ block.text }}</span>

          <span v-else-if="block.type === 'image'" class="announcement-image-line">
            <img v-if="block.url" :src="block.url" :alt="block.alt || '公告图片'" class="announcement-image" />
            <span v-else class="announcement-image-placeholder">图片暂不可用（{{ block.alt || block.fileId }}）</span>
          </span>

          <span
            v-else
            class="announcement-highlight"
            :class="{
              actionable: block.action.type !== 'none',
              'link-action': block.action.type === 'url' || block.action.type === 'protocol',
            }"
            :style="{ color: resolveAnnouncementColor(block.color) }"
            :title="block.action.type !== 'none' ? block.action.label : undefined"
            @click="handleHighlightAction(block)">
            {{ block.text }}<span v-if="block.action.type === 'copy'" class="announcement-action-mark">⧉</span>
          </span>
        </template>
      </div>

      <template #footer>
        <div class="announcement-detail-footer">
          <n-button type="primary" @click="emit('confirmed')">
            {{ announcement?.confirmText || "我知道了" }}
          </n-button>
          <n-button
            v-if="announcement?.showGotoButton && announcement?.gotoUrl"
            secondary
            type="primary"
            @click="emit('goto')">
            前往
          </n-button>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton, NCard, NModal } from "naive-ui";
import {
  resolveAnnouncementColor,
  normalizeAnnouncementContent,
  type Announcement,
  type AnnouncementBlock,
} from "./homeAnnouncement";

defineOptions({ name: "HomeAnnouncementDetailModal" });

const props = defineProps<{
  show: boolean;
  announcement: Announcement | null;
}>();

const emit = defineEmits<{
  confirmed: [];
  goto: [];
  afterLeave: [];
}>();

const content = computed(() => normalizeAnnouncementContent(props.announcement?.content));

function handleVisibleChange(nextVisible: boolean) {
  if (nextVisible) return;
  // Modal 不允许通过遮罩或 ESC 关闭，只接受底部按钮关闭。
}

async function handleHighlightAction(block: AnnouncementBlock) {
  if (block.type !== "highlight" || block.action.type === "none") return;
  try {
    if (block.action.type === "copy") {
      await navigator.clipboard.writeText(block.action.value);
      window.$message?.success("已复制");
      return;
    }
    await window.electronAPI.openAnnouncementAction(block.action);
  } catch (error) {
    window.$message?.error(error instanceof Error ? error.message : "公告操作失败");
  }
}
</script>

<style lang="scss" scoped>
.announcement-detail-modal {
  width: min(680px, calc(100vw - 48px));
  max-height: calc(100vh - 80px);
  overflow: hidden;
  border-radius: 14px;
  background-color: var(--color-bg-default);
  color: var(--color-text-default);
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.24);
}

.announcement-detail-title {
  color: var(--color-text-default);
  font-size: 18px;
  font-weight: 700;
}

.announcement-detail-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.announcement-detail-content {
  max-height: min(60vh, 560px);
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  color: var(--color-text-default);
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.announcement-detail-content::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.announcement-text.bold {
  font-weight: 700;
}

.announcement-image-line {
  display: block;
  margin: 14px 0;
  text-align: center;
}

.announcement-image {
  display: block;
  max-width: 100%;
  max-height: 420px;
  margin: 0 auto;
  border-radius: 8px;
  object-fit: contain;
}

.announcement-image-placeholder {
  display: block;
  padding: 24px 12px;
  border: 1px dashed var(--color-border-default);
  border-radius: 8px;
  color: var(--color-text-secondary);
}

.announcement-highlight {
  font-weight: 600;
}

.announcement-highlight.link-action {
  cursor: pointer;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.announcement-highlight.actionable {
  cursor: pointer;
}

.announcement-action-mark {
  margin-left: 4px;
  font-size: 12px;
}

.announcement-detail-footer {
  display: flex;
  justify-content: center;
  gap: 10px;
}
</style>
