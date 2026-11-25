<template>
  <section class="discover-page" aria-label="发现" :aria-busy="loading">
    <webview
      v-if="source"
      ref="page"
      class="discover-webview"
      :class="{ 'is-loading': loading }"
      :src="source"
      partition="pisa-discover" />

    <div v-if="loading" class="discover-status" role="status">
      <n-spin size="small" />
      <span>正在加载发现页</span>
    </div>
    <div v-else-if="failed" class="discover-status">
      <span role="alert">发现页加载失败</span>
      <n-button secondary @click="loadPage">重试</n-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { NButton, NSpin } from "naive-ui";
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";

defineOptions({ name: "Discover" });

const page = useTemplateRef<HTMLElement>("page");
const source = ref("");
const loading = ref(true);
const failed = ref(false);
let loadGeneration = 0;

async function loadPage() {
  const generation = ++loadGeneration;
  source.value = "";
  failed.value = false;
  loading.value = true;
  try {
    const url = await window.electronAPI.getDiscoverPage();
    if (generation === loadGeneration) source.value = url;
  } catch {
    if (generation === loadGeneration) showError();
  }
}

function showError() {
  failed.value = true;
  loading.value = false;
  source.value = "";
}

watch(page, (webview, _, onCleanup) => {
  if (!webview) return;
  const handlers = new AbortController();
  const options = { signal: handlers.signal };
  const timeout = window.setTimeout(showError, 20_000);
  webview.addEventListener("did-finish-load", () => {
    window.clearTimeout(timeout);
    loading.value = false;
  }, options);
  webview.addEventListener("did-fail-load", (event) => {
    const { isMainFrame, errorCode } = event as Event & { isMainFrame: boolean; errorCode: number };
    if (isMainFrame && errorCode !== -3) showError();
  }, options);
  webview.addEventListener("did-navigate", (event) => {
    if ((event as Event & { httpResponseCode: number }).httpResponseCode >= 400) showError();
  }, options);
  webview.addEventListener("render-process-gone", showError, options);
  onCleanup(() => {
    window.clearTimeout(timeout);
    handlers.abort();
  });
});

onMounted(loadPage);
onBeforeUnmount(() => {
  loadGeneration += 1;
});
</script>

<style scoped>
.discover-page {
  position: relative;
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  background: var(--surface-card);
  border-radius: var(--radius-control);
}

.discover-webview {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.discover-webview.is-loading {
  visibility: hidden;
}

.discover-status {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
}
</style>
