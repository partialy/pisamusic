<template>
  <AppModal
    :show="show"
    title="公告"
    :icon="Megaphone"
    :width="680"
    :closable="false"
    :mask-closable="false"
    :close-on-esc="false"
    @after-leave="emit('afterLeave')">
    <div class="announcement-detail-body">
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
    </div>

    <template #footer>
      <n-button
        v-if="announcement?.showGotoButton && announcement?.gotoUrl"
        secondary
        type="primary"
        @click="emit('goto')">
        前往
      </n-button>
      <n-button type="primary" @click="emit('confirmed')">
        {{ announcement?.confirmText || "我知道了" }}
      </n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton } from "naive-ui";
import { Megaphone } from "lucide-vue-next";
import AppModal from "@/components/common/AppModal.vue";
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
.announcement-detail-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.announcement-detail-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-control);
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 12px;
}

.announcement-detail-content {
  max-height: min(60vh, 520px);
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  color: var(--text-primary);
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
  border-radius: var(--radius-control);
  object-fit: contain;
}

.announcement-image-placeholder {
  display: block;
  padding: 24px 12px;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-control);
  color: var(--text-secondary);
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
</style>
