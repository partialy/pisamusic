<template>
  <div class="cloud-overview-card">
    <div class="card-left">
      <div class="cloud-icon-box">
        <n-icon :component="Cloud" :size="28" />
      </div>
      <div class="card-info">
        <div class="card-title-row">
          <span class="card-title">共享云盘</span>
          <span class="card-badge">公共曲库</span>
        </div>
        <div class="card-meta">
          <span class="meta-item">
            <span class="meta-label">共享歌曲</span>
            <strong class="meta-value">{{ total }} 首</strong>
          </span>
          <span class="meta-divider" v-if="formattedUpdatedAt">/</span>
          <span class="meta-item" v-if="formattedUpdatedAt">
            <span class="meta-label">最近更新</span>
            <span class="meta-time">{{ formattedUpdatedAt }}</span>
          </span>
        </div>
      </div>
    </div>

    <div class="card-actions">
      <n-button
        type="primary"
        class="submit-btn"
        round
        @click="goToSubmit">
        <template #icon>
          <n-icon :component="UploadCloud" />
        </template>
        我要投稿
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { NButton, NIcon } from "naive-ui";
import { Cloud, UploadCloud } from "lucide-vue-next";

const props = defineProps<{
  total: number;
  latestUpdatedAt: number | null;
}>();

const router = useRouter();

const formattedUpdatedAt = computed(() => {
  if (!props.latestUpdatedAt) return null;
  const d = new Date(props.latestUpdatedAt);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
});

function goToSubmit() {
  router.push("/cloud/submit");
}
</script>

<style scoped lang="scss">
.cloud-overview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-radius: 14px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border-default);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.07);
  }
}

.card-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.cloud-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-source-cloud) 14%, var(--color-bg-default));
  color: var(--color-source-cloud);
  flex-shrink: 0;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-default);
}

.card-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--color-source-cloud) 12%, var(--color-bg-default));
  color: var(--color-source-cloud);
  font-weight: 500;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.meta-label {
  color: var(--color-text-third);
}

.meta-value {
  color: var(--color-text-default);
  font-weight: 600;
}

.meta-divider {
  color: var(--color-border-default);
}

.card-actions {
  flex-shrink: 0;
}

.submit-btn {
  font-weight: 600;
  padding: 0 18px;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 30%, transparent);
}
</style>
