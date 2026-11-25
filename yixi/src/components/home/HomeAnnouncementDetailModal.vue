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
            :class="{ bold: block.bold, italic: block.italic }"
            :style="block.color ? { color: resolveAnnouncementColor(block.color) } : undefined">{{ block.text }}</span>

          <span v-else-if="block.type === 'image'" class="announcement-image-line">
            <img v-if="block.url" :src="block.url" :alt="block.alt || '公告图片'" class="announcement-image" />
            <span v-else class="announcement-image-placeholder">图片暂不可用（{{ block.alt || block.fileId }}）</span>
          </span>

          <component
            :is="block.action.type === 'none' ? 'span' : 'button'"
            v-else
            :type="block.action.type !== 'none' ? 'button' : undefined"
            :disabled="block.action.type !== 'none' && executingAction"
            class="announcement-highlight"
            :class="{
              actionable: block.action.type !== 'none',
              'link-action': block.action.type === 'url' || block.action.type === 'protocol' || block.action.type === 'page',
            }"
            :style="{ color: resolveAnnouncementColor(block.color) }"
            :title="block.action.type !== 'none' ? block.action.label : undefined"
            @click="handleHighlightAction(block)">
            {{ block.text }}<span v-if="block.action.type === 'copy'" class="announcement-action-mark">⧉</span>
          </component>
        </template>
      </div>
    </div>

    <template #footer>
      <n-button
        v-if="gotoAction.type !== 'none' || legacyGotoUrl"
        secondary
        type="primary"
        :loading="executingAction"
        @click="handleGoto">
        前往
      </n-button>
      <n-button type="primary" :disabled="remaining > 0 || executingAction" @click="handleConfirm">
        {{ confirmLabel }}
      </n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { NButton } from "naive-ui";
import { Megaphone } from "lucide-vue-next";
import AppModal from "@/components/common/AppModal.vue";
import type { AnnouncementAction } from "@/types/announcement";
import {
  resolveAnnouncementColor,
  normalizeAnnouncementContent,
  parseAnnouncementAction,
  type Announcement,
  type AnnouncementBlock,
} from "./homeAnnouncement";

defineOptions({ name: "HomeAnnouncementDetailModal" });

const props = defineProps<{
  show: boolean;
  announcement: Announcement | null;
  automatic?: boolean;
  confirm: (notice: Announcement) => Promise<void>;
}>();

const emit = defineEmits<{
  afterLeave: [];
}>();

const router = useRouter();
const executingAction = ref(false);
const remaining = ref(0);
const content = computed(() => normalizeAnnouncementContent(props.announcement?.content));
const confirmLabel = computed(() => {
  const label = props.announcement?.confirmText || "我知道了";
  return remaining.value > 0 ? `${label}（${remaining.value}）` : label;
});
const gotoAction = computed(() => {
  const action = parseAnnouncementAction(props.announcement?.gotoAction);
  return props.announcement?.showGotoButton && (action.type === "url" || action.type === "page")
    ? action
    : { type: "none" as const };
});
const legacyGotoUrl = computed(() => props.announcement?.showGotoButton
  ? props.announcement.gotoUrl?.trim()
  : undefined);

watch(
  () => [props.show, props.announcement?.id, props.automatic, props.announcement?.waitSeconds] as const,
  ([show, , automatic, waitSeconds], _, onCleanup) => {
    const seconds = show && automatic && typeof waitSeconds === "number" && Number.isSafeInteger(waitSeconds) && waitSeconds > 0
      ? waitSeconds
      : 0;
    remaining.value = seconds;
    if (seconds === 0) return;
    const deadline = performance.now() + seconds * 1000;
    const timer = window.setInterval(() => {
      remaining.value = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      if (remaining.value === 0) window.clearInterval(timer);
    }, 100);
    onCleanup(() => window.clearInterval(timer));
  },
  { immediate: true },
);

async function handleConfirm() {
  const notice = props.announcement;
  if (notice && props.show && remaining.value === 0 && !executingAction.value) await props.confirm(notice);
}

async function executeAction(action: Exclude<AnnouncementAction, { type: "none" }>) {
  if (action.type === "copy") {
    await navigator.clipboard.writeText(action.value);
    window.$message?.success("已复制");
  } else if (action.type === "page") {
    const target = action.page === "discover" ? "/discover" : "/setting";
    if (router.currentRoute.value.fullPath !== target && await router.push(target)) {
      throw new Error("无法打开目标页面");
    }
  } else if (!await window.electronAPI.openAnnouncementAction(action)) {
    throw new Error("无法打开公告链接");
  }
}

async function runAction(open: () => Promise<unknown>, confirmOnSuccess: boolean) {
  const notice = props.announcement;
  if (!notice || !props.show || executingAction.value) return;
  const confirm = props.confirm;
  executingAction.value = true;
  try {
    await open();
    if (confirmOnSuccess) await confirm(notice);
  } catch (error) {
    window.$message?.error(error instanceof Error ? error.message : "公告操作失败");
  } finally {
    executingAction.value = false;
  }
}

function handleGoto() {
  const action = gotoAction.value;
  const legacyUrl = legacyGotoUrl.value;
  if (action.type !== "none") {
    void runAction(() => executeAction(action), true);
  } else if (legacyUrl) {
    void runAction(async () => {
      if (!await window.electronAPI.openUrl({ url: legacyUrl, mode: "window" })) {
        throw new Error("无法打开公告链接");
      }
    }, true);
  }
}

function handleHighlightAction(block: AnnouncementBlock) {
  if (block.type !== "highlight" || block.action.type === "none") return;
  const action = block.action;
  void runAction(() => executeAction(action), action.type === "page");
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

.announcement-text.italic {
  font-style: italic;
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

button.announcement-highlight {
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-weight: 600;
  white-space: inherit;
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
