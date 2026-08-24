<template>
  <section class="fault-report-section">
    <div class="section-head">
      <div class="title-group">
        <span class="section-icon" aria-hidden="true">
          <n-icon :component="ShieldCheck" />
        </span>
        <div>
          <h3>故障上报</h3>
          <p>上报 PC 主进程网络请求失败信息，帮助定位服务和音源连接问题。</p>
        </div>
      </div>
      <span class="privacy-badge">已脱敏</span>
    </div>

    <div v-if="loadError" class="load-error">
      <div>
        <strong>故障统计加载失败</strong>
        <p>{{ loadError }}</p>
      </div>
      <n-button secondary size="small" @click="loadStats">重试</n-button>
    </div>

    <template v-else>
      <div class="stats-grid" :class="{ loading }">
        <div v-for="item in statItems" :key="item.label" class="stat-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <div class="report-meta">
        <div>
          <span>上报场景</span>
          <strong>PC 网络请求</strong>
        </div>
        <div>
          <span>上次上报</span>
          <strong>{{ formatDateTime(stats?.lastReportedAt) }}</strong>
        </div>
      </div>

      <div class="report-action">
        <div class="privacy-note">
          <n-icon :component="LockKeyhole" />
          <p>
            仅上传经过脱敏的请求地址、参数、响应摘要和系统版本，不包含 Cookie、账号密码和本地文件。
          </p>
        </div>
        <n-popconfirm
          positive-text="确认上报"
          negative-text="取消"
          :disabled="!canSubmit"
          @positive-click="submitReport">
          <template #trigger>
            <n-button type="primary" :loading="submitting" :disabled="!canSubmit">
              <template #icon>
                <n-icon :component="CloudUpload" />
              </template>
              {{ submitText }}
            </n-button>
          </template>
          将上报当前待处理的脱敏故障信息，单次最多 300 条。是否继续？
        </n-popconfirm>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { NButton, NIcon, NPopconfirm } from "naive-ui";
import { CloudUpload, LockKeyhole, ShieldCheck } from "lucide-vue-next";

defineOptions({ name: "FaultReportSection" });

const loading = ref(false);
const submitting = ref(false);
const loadError = ref("");
type FaultReportStats = Awaited<ReturnType<typeof window.electronAPI.getFaultReportStats>>;
const stats = ref<FaultReportStats | null>(null);

const statItems = computed(() => [
  { label: "累计错误", value: loading.value ? "..." : String(stats.value?.totalCount ?? 0) },
  { label: "最近 7 天", value: loading.value ? "..." : String(stats.value?.recentSevenDaysCount ?? 0) },
  { label: "待上报", value: loading.value ? "..." : String(stats.value?.pendingCount ?? 0) },
  { label: "最近错误", value: loading.value ? "..." : formatDateTime(stats.value?.latestOccurredAt, true) },
]);

const canSubmit = computed(() => !loading.value && !submitting.value && (stats.value?.pendingCount ?? 0) > 0);
const submitText = computed(() => {
  if (submitting.value) return "正在上报";
  const count = stats.value?.pendingCount ?? 0;
  return count > 0 ? `立即上报（${Math.min(count, 300)}）` : "暂无待上报信息";
});

onMounted(loadStats);

async function loadStats() {
  loading.value = true;
  loadError.value = "";
  try {
    stats.value = await window.electronAPI.getFaultReportStats();
  } catch (error) {
    loadError.value = errorMessage(error, "故障统计读取失败");
  } finally {
    loading.value = false;
  }
}

async function submitReport() {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    const result = await window.electronAPI.submitPendingFaultReport();
    window.$notification?.success({
      title: "故障信息上报成功",
      content: result.remainingCount > 0
        ? `本批已处理 ${result.receivedCount} 条，仍有 ${result.remainingCount} 条待上报`
        : `已处理 ${result.receivedCount} 条故障信息`,
      duration: 2600,
    });
    await loadStats();
  } catch (error) {
    window.$message.error(errorMessage(error, "故障信息上报失败"));
  } finally {
    submitting.value = false;
  }
}

function formatDateTime(value?: number | null, compact = false) {
  if (!value) return "从未";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", compact
    ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }
    : { hour12: false });
}

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;
  return error.message.replace(/^Error invoking remote method '[^']+':\s*/i, "");
}
</script>

<style lang="scss" scoped>
.fault-report-section {
  padding: 20px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border-default));
  border-radius: 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 8%, transparent), transparent 42%),
    var(--color-card-bg);
}

.section-head,
.title-group,
.report-action,
.privacy-note,
.load-error {
  display: flex;
  align-items: center;
}

.section-head,
.report-action,
.load-error {
  justify-content: space-between;
  gap: 20px;
}

.title-group {
  min-width: 0;
  gap: 12px;
}

.section-icon {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 13%, transparent);
  font-size: 20px;
}

.section-head h3 {
  color: var(--color-text-default);
  font-size: 16px;
  font-weight: 650;
}

.section-head p,
.load-error p {
  margin-top: 5px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.privacy-badge {
  flex-shrink: 0;
  padding: 4px 9px;
  border-radius: 999px;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  font-size: 11px;
  font-weight: 700;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
  transition: opacity 0.18s ease;

  &.loading {
    opacity: 0.6;
  }
}

.stat-item,
.report-meta > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-item {
  min-width: 0;
  padding: 13px 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-bg-secondary) 84%, transparent);

  span,
  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: var(--color-text-secondary);
    font-size: 11px;
  }

  strong {
    color: var(--color-text-default);
    font-size: 17px;
    font-weight: 680;
  }
}

.report-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
  padding: 12px 14px;
  border-top: 1px solid var(--color-border-default);
  border-bottom: 1px solid var(--color-border-default);

  span {
    color: var(--color-text-secondary);
    font-size: 11px;
  }

  strong {
    color: var(--color-text-default);
    font-size: 13px;
    font-weight: 600;
  }
}

.report-action {
  margin-top: 16px;
}

.privacy-note {
  min-width: 0;
  max-width: 680px;
  align-items: flex-start;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.55;

  .n-icon {
    flex: 0 0 auto;
    margin-top: 2px;
    color: var(--color-primary);
  }
}

.load-error {
  margin-top: 18px;
  padding: 14px;
  border-radius: 8px;
  color: var(--color-text-default);
  background: color-mix(in srgb, #d03050 8%, var(--color-bg-secondary));
}

@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .report-action {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
