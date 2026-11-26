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
      <p v-if="isGuest" class="quota-guest-tip">
        当前为游客模式，登录账号即可获得更高下载配额与注册赠送次数。
      </p>
    </div>
    <template #footer>
      <template v-if="isGuest">
        <n-button round @click="emit('update:show', false)">我知道了</n-button>
        <n-button round type="primary" @click="handleGoLogin">去登录</n-button>
      </template>
      <n-button v-else round type="primary" @click="emit('update:show', false)">我知道了</n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton } from "naive-ui";
import { AlertTriangle } from "lucide-vue-next";
import AppModal from "@/components/common/AppModal.vue";
import { useAccountLoginDialog } from "@/composables/useAccountLoginDialog";
import type { SongDownloadQuotaAcquireResult } from "@/types/download";
import { formatQuotaExceededLines } from "@/utils/downloadQuotaFormat";

const props = defineProps<{
  show: boolean;
  result: SongDownloadQuotaAcquireResult | null;
}>();

const emit = defineEmits<{
  (event: "update:show", value: boolean): void;
}>();

const { openAccountLogin } = useAccountLoginDialog();

const lines = computed(() => (props.result ? formatQuotaExceededLines(props.result.quota) : []));
const requiredCount = computed(() => props.result?.requiredCount ?? 0);
const isGuest = computed(() => {
  const quota = props.result?.quota;
  if (!quota) return false;
  return quota.isGuest === true || quota.subjectType === "device";
});

function handleGoLogin() {
  emit("update:show", false);
  openAccountLogin();
}
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
.quota-guest-tip {
  margin: 4px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-secondary, rgba(148, 163, 184, 0.12));
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}
</style>
