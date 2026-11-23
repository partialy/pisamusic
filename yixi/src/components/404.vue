<template>
  <div class="not-found-page">
    <section class="not-found-card" aria-labelledby="not-found-title">
      <div class="icon-badge" aria-hidden="true">
        <n-icon :size="30" :component="Disc3" />
      </div>

      <p class="error-code">404</p>
      <h1 id="not-found-title" class="error-title">页面走丢了</h1>
      <p class="error-desc">当前访问的地址不存在或已被移除，你可以返回上一页或回到首页继续听歌。</p>

      <div v-if="currentPath" class="path-pill" :title="currentPath">
        <span class="path-label">路径</span>
        <code class="path-value">{{ currentPath }}</code>
      </div>

      <div class="actions">
        <n-button round secondary @click="goBack">
          <template #icon>
            <n-icon :component="ArrowLeft" />
          </template>
          返回上一页
        </n-button>
        <n-button round type="primary" @click="goHome">
          <template #icon>
            <n-icon :component="Home" />
          </template>
          返回首页
        </n-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NButton, NIcon } from "naive-ui";
import { ArrowLeft, Disc3, Home } from "lucide-vue-next";

defineOptions({ name: "NotFoundPage" });

const route = useRoute();
const router = useRouter();

const currentPath = computed(() => route.fullPath || "");

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.replace("/");
}

function goHome() {
  void router.push("/");
}
</script>

<style lang="scss" scoped>
.not-found-page {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
}

.not-found-card {
  width: min(460px, 100%);
  padding: 40px 36px 34px;
  border-radius: var(--radius-control);
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(18px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.icon-badge {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
  color: var(--text-accent);
  background: var(--surface-input);
  border: 1px solid var(--border-subtle);
}

.error-code {
  margin: 0;
  font-size: 56px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--text-accent);
}

.error-title {
  margin: 14px 0 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-primary);
}

.error-desc {
  margin: 10px 0 0;
  max-width: 340px;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.path-pill {
  margin-top: 18px;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  background: var(--surface-input);
  border: 1px solid var(--border-subtle);
  font-size: 12px;
  line-height: 1.4;
}

.path-label {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.path-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--text-secondary);
}

.actions {
  margin-top: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
