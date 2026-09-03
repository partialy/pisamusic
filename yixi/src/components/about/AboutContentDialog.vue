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
    <div v-else class="content-body">{{ content || "暂无内容" }}</div>
  </n-modal>
</template>

<script setup lang="ts">
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

function handleVisibleChange(value: boolean) {
  emit("update:show", value);
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
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.8;
}
</style>

<style lang="scss">
.about-content-dialog {
  width: min(720px, calc(100vw - 48px));
  border-radius: 8px;
}
</style>
