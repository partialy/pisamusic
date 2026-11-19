<template>
  <AppModal
    :show="show"
    title="下载配额不足"
    :icon="AlertTriangle"
    :width="400"
    @update:show="emit('update:show', $event)">
    <div class="quota-body">
      <p class="quota-lead">下载配额不足，当前剩余：</p>
      <ul class="quota-lines">
        <li v-for="(line, idx) in lines" :key="idx">{{ line }}</li>
      </ul>
      <p v-if="requiredCount > 1" class="quota-hint">本次请求下载 {{ requiredCount }} 首</p>
    </div>
    <template #footer>
      <n-button round type="primary" @click="emit('update:show', false)">我知道了</n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton } from "naive-ui";
import { AlertTriangle } from "lucide-vue-next";
import AppModal from "@/components/common/AppModal.vue";
import type { SongDownloadQuotaAcquireResult } from "@/types/download";
import { formatQuotaExceededLines } from "@/utils/downloadQuotaFormat";

const props = defineProps<{
  show: boolean;
  result: SongDownloadQuotaAcquireResult | null;
}>();

const emit = defineEmits<{
  (event: "update:show", value: boolean): void;
}>();

const lines = computed(() => (props.result ? formatQuotaExceededLines(props.result.quota) : []));
const requiredCount = computed(() => props.result?.requiredCount ?? 0);
</script>

<style scoped lang="scss">
.quota-body {
  display: grid;
  gap: 10px;
  color: var(--text-primary);
}
.quota-lead {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.quota-lines {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}
.quota-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
