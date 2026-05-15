<template>
  <div class="advance-setting">
    <template v-if="developmentRuntime">
      <section class="debug-section">
        <div class="section-head">
          <div>
            <h3>Cookie 调试</h3>
            <p>查看本地 Cookie 请求头、使用 Cookie 请求用户信息，并导出 KG/WY Cookie JSON 文件。</p>
          </div>
          <n-button secondary :loading="cookieExporting" @click="exportCookies">
            导出 Cookie 文件
          </n-button>
        </div>

        <div class="debug-actions">
          <n-button secondary @click="showCookie('kg')">查看酷狗 Cookie</n-button>
          <n-button secondary @click="showCookie('wy')">查看网易 Cookie</n-button>
          <n-button type="primary" secondary :loading="cookieApiLoading === 'kg'" @click="testCookieApi('kg')">
            酷狗 /user/detail
          </n-button>
          <n-button type="primary" secondary :loading="cookieApiLoading === 'wy'" @click="testCookieApi('wy')">
            网易 /user/account
          </n-button>
        </div>

        <n-input
          class="debug-output"
          type="textarea"
          readonly
          :autosize="{ minRows: 8, maxRows: 18 }"
          :value="cookieDebugOutput"
          placeholder="Cookie 调试结果会显示在这里" />
      </section>

      <section class="debug-section">
        <div class="section-head">
          <div>
            <h3>Debug 网络错误记录</h3>
            <p>当前共 {{ pageData.total }} 条，仅记录 Electron 主进程发起的失败请求。</p>
          </div>
          <n-dropdown
            trigger="click"
            :options="exportOptions"
            @select="handleExportSelect">
            <n-button secondary :loading="exporting">导出 JSON</n-button>
          </n-dropdown>
        </div>

        <n-data-table
          :columns="columns"
          :data="pageData.items"
          :loading="loading"
          :bordered="false"
          :single-line="false" />

        <div class="pagination-row">
          <n-pagination
            :page="pageData.page"
            :page-size="pageData.pageSize"
            :item-count="pageData.total"
            @update:page="handlePageChange" />
        </div>
      </section>
    </template>

    <section v-else class="empty-state">
      <h3>高级设置</h3>
      <p>当前暂无需要在正式环境展示的高级配置。</p>
    </section>

    <n-modal
      v-model:show="detailVisible"
      preset="card"
      title="网络错误详情"
      class="detail-modal"
      :bordered="false">
      <template v-if="detail">
        <div class="detail-grid">
          <div class="detail-item">
            <span>时间</span>
            <strong>{{ formatDateTime(detail.createdAt) }}</strong>
          </div>
          <div class="detail-item">
            <span>范围</span>
            <strong>{{ detail.requestScope }}</strong>
          </div>
          <div class="detail-item">
            <span>方法</span>
            <strong>{{ detail.method }}</strong>
          </div>
          <div class="detail-item">
            <span>HTTP</span>
            <strong>{{ detail.httpStatus ?? "-" }}</strong>
          </div>
          <div class="detail-item">
            <span>业务码</span>
            <strong>{{ detail.businessCode ?? "-" }}</strong>
          </div>
          <div class="detail-item detail-item-wide">
            <span>请求地址</span>
            <strong>{{ detail.requestUrl }}</strong>
          </div>
        </div>

        <div class="detail-block">
          <h4>错误摘要</h4>
          <p>{{ detail.errorMessage }}</p>
        </div>

        <div class="detail-block">
          <h4>请求参数</h4>
          <pre>{{ prettyJson(detail.requestParams) }}</pre>
        </div>

        <div class="detail-block">
          <h4>响应内容</h4>
          <pre>{{ prettyJson(detail.response) }}</pre>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, ref } from "vue";
import {
  NButton,
  NDataTable,
  NDropdown,
  NInput,
  NModal,
  NPagination,
  NTag,
  type DataTableColumns,
  type DropdownOption,
} from "naive-ui";
import {
  exportCookieFiles,
  getCookieDebugUserInfo,
  getUserCookie,
  type CookieSource,
} from "@/utils/api/cookieMusicAPI";

type NetworkErrorRecordSummary = {
  id: number;
  requestScope: string;
  method: string;
  requestPath: string;
  httpStatus: number | null;
  businessCode: string | null;
  errorMessage: string;
  createdAt: string;
};

type NetworkErrorRecordDetail = NetworkErrorRecordSummary & {
  requestUrl: string;
  requestParams: unknown;
  response: unknown;
};

type NetworkErrorRecordPage = {
  items: NetworkErrorRecordSummary[];
  total: number;
  page: number;
  pageSize: number;
};

const developmentRuntime = ref(false);
const loading = ref(false);
const exporting = ref(false);
const cookieExporting = ref(false);
const cookieApiLoading = ref<CookieSource | "">("");
const cookieDebugOutput = ref("");
const detailVisible = ref(false);
const detail = ref<NetworkErrorRecordDetail | null>(null);
const pageData = ref<NetworkErrorRecordPage>({
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
});

const exportOptions: DropdownOption[] = [
  { label: "导出最近 10 条", key: "10" },
  { label: "导出最近 100 条", key: "100" },
  { label: "自定义导出（暂未实现）", key: "custom", disabled: true },
];

const columns: DataTableColumns<NetworkErrorRecordSummary> = [
  {
    title: "时间",
    key: "createdAt",
    width: 168,
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    title: "范围",
    key: "requestScope",
    width: 88,
    render: (row) => h(NTag, { size: "small", bordered: false }, { default: () => row.requestScope }),
  },
  {
    title: "方法",
    key: "method",
    width: 84,
  },
  {
    title: "路径",
    key: "requestPath",
    ellipsis: { tooltip: true },
  },
  {
    title: "HTTP",
    key: "httpStatus",
    width: 84,
    render: (row) => row.httpStatus ?? "-",
  },
  {
    title: "业务码",
    key: "businessCode",
    width: 92,
    render: (row) => row.businessCode ?? "-",
  },
  {
    title: "错误摘要",
    key: "errorMessage",
    ellipsis: { tooltip: true },
  },
  {
    title: "操作",
    key: "actions",
    width: 84,
    render: (row) =>
      h(
        NButton,
        {
          quaternary: true,
          type: "primary",
          size: "small",
          onClick: () => void openDetail(row.id),
        },
        { default: () => "查看" }
      ),
  },
];

onMounted(async () => {
  developmentRuntime.value = await window.electronAPI.isDevelopmentRuntime();
  if (developmentRuntime.value) {
    await loadPage(1);
  }
});

async function showCookie(source: CookieSource) {
  const cookie = await getUserCookie(source);
  cookieDebugOutput.value = [
    `${sourceLabel(source)} Cookie 请求头`,
    "",
    cookie.trim() || "（当前为空）",
  ].join("\n");
}

async function testCookieApi(source: CookieSource) {
  cookieApiLoading.value = source;
  cookieDebugOutput.value = `${sourceLabel(source)} Cookie 接口请求中...`;
  try {
    const result = await getCookieDebugUserInfo(source);
    cookieDebugOutput.value = [
      `${sourceLabel(source)} ${result.endpoint}`,
      `HTTP ${result.httpStatus} ok=${result.ok}`,
      "",
      "--- body ---",
      prettyJson(result.body),
      "",
      "--- cookieHeaderForNextRequest ---",
      result.cookieHeaderForNextRequest || "（当前为空）",
    ].join("\n");
  } catch (error) {
    cookieDebugOutput.value = error instanceof Error ? error.stack || error.message : String(error);
  } finally {
    cookieApiLoading.value = "";
  }
}

async function exportCookies() {
  cookieExporting.value = true;
  try {
    const result = await exportCookieFiles();
    if (!result.exported) {
      window.$message.info("没有可导出的 Cookie 文件");
      return;
    }
    window.$notification?.success({
      title: "Cookie 导出完成",
      content: `已导出：${result.exportedFiles.join("、")}`,
      duration: 2200,
    });
    cookieDebugOutput.value = [
      "Cookie 文件导出完成",
      `目录：${result.directory}`,
      `已导出：${result.exportedFiles.join(", ") || "-"}`,
      `已跳过：${result.skippedFiles.join(", ") || "-"}`,
    ].join("\n");
  } finally {
    cookieExporting.value = false;
  }
}

async function loadPage(page: number) {
  loading.value = true;
  try {
    pageData.value = await window.electronAPI.listNetworkErrors({
      page,
      pageSize: pageData.value.pageSize,
    });
  } finally {
    loading.value = false;
  }
}

async function handlePageChange(page: number) {
  await loadPage(page);
}

async function openDetail(id: number) {
  detail.value = await window.electronAPI.getNetworkErrorDetail(id);
  detailVisible.value = Boolean(detail.value);
}

async function handleExportSelect(key: string | number) {
  if (key !== "10" && key !== "100") return;
  exporting.value = true;
  try {
    const result = await window.electronAPI.exportNetworkErrors(Number(key) as 10 | 100);
    if (!result.exported) return;
    window.$notification?.success({
      title: "导出完成",
      content: `已导出 ${result.count} 条网络错误记录`,
      duration: 1800,
    });
  } finally {
    exporting.value = false;
  }
}

function sourceLabel(source: CookieSource) {
  return source === "kg" ? "酷狗" : "网易";
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}
</script>

<style lang="scss" scoped>
.advance-setting {
  width: 100%;
  min-height: 100%;
  padding: 8px 0 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.debug-section,
.empty-state {
  padding: 18px 20px;
  border-radius: 8px;
  background: var(--color-card-bg);
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;
}

.section-head h3,
.empty-state h3 {
  color: var(--color-text-default);
  font-size: 16px;
  font-weight: 600;
}

.section-head p,
.empty-state p {
  margin-top: 6px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.debug-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.debug-output {
  :deep(textarea) {
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
    line-height: 1.5;
  }
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.detail-modal {
  width: min(860px, calc(100vw - 48px));
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.detail-item-wide {
  grid-column: 1 / -1;
}

.detail-item span,
.detail-block h4 {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.detail-item strong {
  color: var(--color-text-default);
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;
}

.detail-block {
  margin-top: 18px;
}

.detail-block p {
  margin-top: 8px;
  color: var(--color-text-default);
  font-size: 13px;
  line-height: 1.6;
}

.detail-block pre {
  margin-top: 8px;
  max-height: 240px;
  overflow: auto;
  padding: 12px;
  border-radius: 8px;
  color: var(--color-text-default);
  background: var(--color-bg-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}
</style>
