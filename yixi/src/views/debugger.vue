<template>
  <div class="debug-page">
    <header class="debug-header">
      <div>
        <h1>Debug</h1>
        <p>查看最近运行日志，必要时导出 log 文件用于排查问题。</p>
      </div>
      <div class="header-actions">
        <n-button secondary :loading="loading" @click="loadRecentLogs">
          <template #icon>
            <n-icon :component="RefreshCw" />
          </template>
          刷新日志
        </n-button>
        <n-button secondary @click="openLogsDir">
          <template #icon>
            <n-icon :component="FolderOpen" />
          </template>
          打开目录
        </n-button>
        <n-button type="primary" :disabled="!logResult.filePath" @click="exportLogFile">
          <template #icon>
            <n-icon :component="Download" />
          </template>
          导出 log
        </n-button>
      </div>
    </header>

    <section class="log-panel">
      <div class="log-meta">
        <div>
          <span class="meta-label">文件</span>
          <span>{{ logResult.fileName || "暂无日志" }}</span>
        </div>
        <div>
          <span class="meta-label">更新时间</span>
          <span>{{ formatDate(logResult.updatedAt) || "-" }}</span>
        </div>
        <div>
          <span class="meta-label">行数</span>
          <span>{{ logResult.lines.length }}</span>
        </div>
      </div>

      <n-alert v-if="logResult.error" type="warning" :show-icon="false" class="log-alert">
        {{ logResult.error }}
      </n-alert>

      <pre v-if="logResult.lines.length" class="log-viewer">{{ logText }}</pre>
      <n-empty v-else class="empty-state" description="暂无可查看的日志" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { NAlert, NButton, NEmpty, NIcon } from "naive-ui";
import { Download, FolderOpen, RefreshCw } from "lucide-vue-next";
import electronAPI from "@/utils/electron";

type LogReadResult = Awaited<ReturnType<typeof electronAPI.getRecentLogs>>;

const loading = ref(false);
const logResult = ref<LogReadResult>({
  error: null,
  filePath: null,
  fileName: null,
  updatedAt: null,
  lines: [],
});

const logText = computed(() => logResult.value.lines.join("\n"));

async function loadRecentLogs() {
  loading.value = true;
  try {
    logResult.value = await electronAPI.getRecentLogs(500);
  } catch (error) {
    logResult.value = {
      error: error instanceof Error ? error.message : String(error),
      filePath: null,
      fileName: null,
      updatedAt: null,
      lines: [],
    };
  } finally {
    loading.value = false;
  }
}

async function exportLogFile() {
  const result = await electronAPI.exportRecentLog();
  if (result.exported) {
    window.$message.success("日志已导出");
  }
}

async function openLogsDir() {
  await electronAPI.openLogsDir();
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

onMounted(() => {
  void loadRecentLogs();
});
</script>

<style lang="scss" scoped>
.debug-page {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--color-text-default);
}

.debug-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;

  h1 {
    margin: 0;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 0;
  }

  p {
    margin: 6px 0 0;
    color: var(--color-text-secondary);
    font-size: 13px;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.log-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--color-text-default);
  font-size: 13px;

  > div {
    min-width: 160px;
    padding: 10px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-primary) 7%, transparent);
  }
}

.meta-label {
  margin-right: 8px;
  color: var(--color-text-secondary);
}

.log-alert {
  flex-shrink: 0;
}

.log-viewer {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 14px;
  overflow: auto;
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  color: var(--color-text-default);
  background: color-mix(in srgb, var(--color-bg-track) 82%, #000 18%);
  font-family: Consolas, "Courier New", monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-state {
  flex: 1;
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 900px) {
  .debug-header {
    flex-direction: column;
  }

  .header-actions {
    justify-content: flex-start;
  }
}
</style>
