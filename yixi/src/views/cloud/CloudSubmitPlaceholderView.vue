<template>
  <div class="cloud-submit-page">
    <div class="page-nav">
      <n-button quaternary circle class="back-btn" @click="goBack">
        <template #icon>
          <n-icon :component="ArrowLeft" />
        </template>
      </n-button>
      <span class="nav-title">我要投稿</span>
    </div>

    <div class="placeholder-container">
      <div class="illustration-box">
        <div class="icon-circle">
          <n-icon :component="UploadCloud" :size="56" />
        </div>
      </div>

      <h2 class="placeholder-title">共享云盘投稿通道</h2>
      <p class="placeholder-desc">
        云盘投稿功能正在准备中。<br />
        后续将支持直接将音乐文件分享至公共共享云盘，敬请期待！
      </p>

      <div class="actions">
        <n-button type="primary" round class="return-btn" @click="goBack">
          返回共享云盘
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { NButton, NIcon } from "naive-ui";
import { ArrowLeft, UploadCloud } from "lucide-vue-next";

const router = useRouter();

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/cloud");
  }
}
</script>

<style scoped lang="scss">
.cloud-submit-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 24px 24px;
  box-sizing: border-box;
  overflow: hidden;
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  margin-bottom: 24px;
}

.back-btn {
  color: var(--color-text-secondary);

  &:hover {
    color: var(--color-text-default);
    background: var(--color-bg-hover);
  }
}

.nav-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-default);
}

.placeholder-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 20px 40px;
}

.illustration-box {
  margin-bottom: 24px;
}

.icon-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-source-cloud) 12%, var(--color-bg-default));
  color: var(--color-source-cloud);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--color-source-cloud) 16%, transparent);
}

.placeholder-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-default);
  margin: 0 0 12px;
}

.placeholder-desc {
  font-size: 14px;
  line-height: 1.8;
  color: var(--color-text-secondary);
  max-width: 420px;
  margin: 0 0 28px;
}

.actions {
  display: flex;
  justify-content: center;
}

.return-btn {
  padding: 0 28px;
  font-weight: 600;
}
</style>
