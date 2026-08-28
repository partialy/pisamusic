<template>
  <div class="cloud-overview-card">
    <!-- 顶部标题与操作栏 -->
    <div class="card-top">
      <div class="header-left">
        <div class="music-icon-box">
          <n-icon :component="Music" :size="30" class="music-icon" />
        </div>
        <div class="header-texts">
          <span class="card-title">共享音乐空间</span>
          <span class="card-subtitle">宝藏歌曲&珍藏歌曲共享</span>
        </div>
      </div>

      <div class="header-right">
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

    <!-- 下方数据统计三栏面板 -->
    <div class="stats-panel">
      <div class="stat-col">
        <span class="stat-value">{{ total }}</span>
        <span class="stat-label">歌曲总数</span>
      </div>

      <div class="stat-divider"></div>

      <div class="stat-col">
        <span class="stat-value">{{ myContributions }}</span>
        <span class="stat-label">我的贡献</span>
      </div>

      <div class="stat-divider"></div>

      <div class="stat-col">
        <span class="stat-value">{{ formattedDate }}</span>
        <span class="stat-label">最近更新</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { NButton, NIcon } from "naive-ui";
import { Music, UploadCloud } from "lucide-vue-next";

const props = defineProps<{
  total: number;
  latestUpdatedAt: number | null;
  myContributions: number;
}>();

const router = useRouter();

const formattedDate = computed(() => {
  if (!props.latestUpdatedAt) return "-";
  const d = new Date(props.latestUpdatedAt);
  return `${d.getMonth() + 1}-${d.getDate()}`;
});

function goToSubmit() {
  router.push("/cloud/submit");
}
</script>

<style scoped lang="scss">
.cloud-overview-card {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 16px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border-default);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.07);
  }
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.music-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 14px;
  background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #4f46e5 100%);
  box-shadow: 0 6px 16px rgba(124, 58, 237, 0.25);
  color: #ffffff;
  flex-shrink: 0;
}

.music-icon {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
}

.header-texts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.card-title {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--color-text-default);
}

.card-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.header-right {
  flex-shrink: 0;
}

.submit-btn {
  font-weight: 600;
  padding: 0 20px;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

/* 底部数据面板 */
.stats-panel {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 14px 16px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-bg-hover) 70%, transparent);
  border: 1px solid var(--color-border-default);
}

.stat-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.stat-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text-default);
  line-height: 1.2;
  font-family: inherit;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.stat-divider {
  width: 1px;
  height: 28px;
  background: var(--color-border-default);
  flex-shrink: 0;
  opacity: 0.8;
}
</style>
