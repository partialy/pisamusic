<template>
  <n-modal
    :show="show"
    preset="card"
    :title="title"
    class="about-content-dialog"
    :mask-closable="true"
    @update:show="handleVisibleChange">
    <div v-if="loading" class="content-loading">
      <n-skeleton text width="80%" />
      <n-skeleton text width="92%" />
      <n-skeleton text width="72%" />
    </div>
    <div v-else class="content-body" v-html="sanitizedContent"></div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NModal, NSkeleton } from "naive-ui";

defineOptions({ name: "AboutContentDialog" });

const props = defineProps<{
  show: boolean;
  title: string;
  content: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (event: "update:show", value: boolean): void;
}>();

const sanitizedContent = computed(() => sanitizeHtml(props.content || "<p>暂无内容</p>"));

function handleVisibleChange(value: boolean) {
  emit("update:show", value);
}

function sanitizeHtml(html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  doc.querySelectorAll("script, iframe, object, embed, link, meta").forEach((node) => node.remove());
  doc.body.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || value.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return doc.body.innerHTML || "<p>暂无内容</p>";
}
</script>

<style scoped lang="scss">
.content-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.content-body {
  max-height: min(62vh, 620px);
  overflow: auto;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.8;

  :deep(p) {
    margin: 0 0 12px;
  }

  :deep(a) {
    color: var(--color-primary);
  }
}
</style>

<style lang="scss">
.about-content-dialog {
  width: min(720px, calc(100vw - 48px));
  border-radius: 8px;
}
</style>
