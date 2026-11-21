<template>
  <div class="settings-stack about-setting">
    <section class="brand-card">
      <div class="brand-main">
        <div class="app-mark">
          <img src="@/assets/pisamusic_icon_1024.png" alt="PisaMusic" />
        </div>
        <div class="brand-info">
          <div class="brand-title-row">
            <h1>{{ about.appName || "PisaMusic" }}</h1>
            <span class="version-badge">v{{ normalizeVersionLabel(appVersion) }}</span>
            <span v-if="about.team" class="team-badge">{{ about.team }}</span>
          </div>
          <p class="brand-desc">
            <n-skeleton v-if="aboutLoading" text width="240px" />
            <span v-else>{{ about.description || "桌面端音乐播放器" }}</span>
          </p>
        </div>
      </div>
      <div class="brand-actions">
        <n-button secondary round :loading="aboutLoading" @click="loadAboutInfo">
          <template #icon>
            <n-icon :component="RefreshCw" :size="15" />
          </template>
          刷新信息
        </n-button>
      </div>
    </section>

    <SettingSection title="版本与更新" description="检查桌面端版本更新与在线升级状态。">
      <div class="setting-item">
        <div class="item-leading">
          <span class="item-icon">
            <n-icon :component="Download" :size="18" />
          </span>
          <div class="setting-info">
            <div class="setting-title-line">
              <span class="setting-title">在线更新</span>
              <span class="status-pill" :class="updateStatusClass">{{ updateStatusLabel }}</span>
            </div>
            <div class="setting-desc">{{ updateText }}</div>
          </div>
        </div>
        <div class="update-actions">
          <n-button round :loading="checking" secondary @click="checkUpdate">检查更新</n-button>
          <n-button
            v-if="developmentRuntime"
            round
            :loading="checking"
            tertiary
            type="primary"
            @click="simulateCheckUpdate"
          >
            模拟检查更新
          </n-button>
          <n-button v-if="canViewNotes" round secondary @click="openUpdateDialog">更新日志</n-button>
          <n-button v-if="canDownload" round type="primary" @click="downloadUpdate">下载更新</n-button>
          <n-button v-if="canInstall" round type="primary" @click="installUpdate">重启安装</n-button>
        </div>
      </div>
    </SettingSection>

    <SettingSection title="官方与支持" description="访问官方网站、分享App或向我们反馈问题与建议。">
      <div class="setting-item">
        <div class="item-leading">
          <span class="item-icon">
            <n-icon :component="Globe" :size="18" />
          </span>
          <div class="setting-info">
            <div class="setting-title">{{ about.websiteLabel || "PisaMusic 官网" }}</div>
            <div class="setting-desc">{{ about.websiteUrl || "https://pisamusic.partialy.cn" }}</div>
          </div>
        </div>
        <n-button round secondary :disabled="!about.websiteUrl" @click="openWebsite">
          打开官网
        </n-button>
      </div>

      <div class="setting-item">
        <div class="item-leading">
          <span class="item-icon">
            <n-icon :component="Share2" :size="18" />
          </span>
          <div class="setting-info">
            <div class="setting-title">分享 PisaMusic</div>
            <div class="setting-desc">独乐乐不如众乐乐</div>
          </div>
        </div>
        <n-button round secondary @click="openAppShare">立即分享</n-button>
      </div>

      <div class="setting-item">
        <div class="item-leading">
          <span class="item-icon">
            <n-icon :component="MessageSquareText" :size="18" />
          </span>
          <div class="setting-info">
            <div class="setting-title">意见反馈</div>
            <div class="setting-desc">提交问题、功能建议和截图</div>
          </div>
        </div>
        <n-button round secondary @click="openFeedback">提交反馈</n-button>
      </div>
    </SettingSection>

    <SettingSection title="协议与条款" description="查看服务条款、隐私保护说明与版权信息。">
      <button type="button" class="setting-item action-row" @click="openContentDialog('agreement')">
        <div class="item-leading">
          <span class="item-icon">
            <n-icon :component="FileText" :size="18" />
          </span>
          <div class="setting-info">
            <div class="setting-title">用户协议</div>
            <div class="setting-desc">查看服务条款与使用规范</div>
          </div>
        </div>
        <span class="row-trailing">
          <span>查看</span>
          <n-icon :component="ChevronRight" :size="16" />
        </span>
      </button>

      <button type="button" class="setting-item action-row" @click="openContentDialog('privacy')">
        <div class="item-leading">
          <span class="item-icon">
            <n-icon :component="ShieldCheck" :size="18" />
          </span>
          <div class="setting-info">
            <div class="setting-title">隐私政策</div>
            <div class="setting-desc">查看数据与隐私保护说明</div>
          </div>
        </div>
        <span class="row-trailing">
          <span>查看</span>
          <n-icon :component="ChevronRight" :size="16" />
        </span>
      </button>

      <div class="setting-item">
        <div class="item-leading">
          <span class="item-icon">
            <n-icon :component="Info" :size="18" />
          </span>
          <div class="setting-info">
            <div class="setting-title">版权信息</div>
            <div class="setting-desc">{{ about.copyright || "PisaMusic" }}</div>
          </div>
        </div>
        <span v-if="about.team" class="copyright-team">{{ about.team }}</span>
      </div>
    </SettingSection>

    <AboutContentDialog
      v-model:show="contentDialog.show"
      :title="contentDialog.title"
      :content="contentDialog.content"
      :loading="contentDialog.loading"
    />
    <AboutFeedbackDialog
      v-model:show="feedbackDialogVisible"
      :app-version="appVersion"
      :initial-type="feedbackInitialType"
    />
    <n-modal
      v-model:show="updateDialogVisible"
      class="update-modal"
      transform-origin="center"
      :mask-closable="false"
      :mask-style="updateModalMaskStyle"
    >
      <section class="update-dialog-card" role="dialog" aria-modal="true">
        <div class="update-dialog-title">
          <span class="update-title-icon">
            <img src="@/assets/pisamusic_icon_1024.png" alt="Pisa Music" />
          </span>
          <h2>{{ updateDialogTitle }}</h2>
        </div>
        <div class="update-dialog-notes">
          <strong>更新日志：</strong>
          <div>{{ updateReleaseNotes }}</div>
        </div>
        <div class="update-dialog-actions">
          <n-button
            class="update-primary-button"
            type="primary"
            :disabled="Boolean(updateDialogState?.simulated)"
            @click="updateImmediately"
          >
            <template #icon>
              <n-icon :component="Download" />
            </template>
            立即更新
          </n-button>
          <n-button class="update-glass-button" secondary @click="openOfficialDownload">
            <template #icon>
              <n-icon :component="ExternalLink" />
            </template>
            官网下载
          </n-button>
          <n-button class="update-glass-button" tertiary @click="closeUpdateDialog">关闭</n-button>
        </div>
      </section>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import SettingSection from "../SettingSection.vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NButton, NIcon, NModal, NSkeleton } from "naive-ui";
import {
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Info,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Share2,
} from "lucide-vue-next";
import AboutContentDialog from "@/components/about/AboutContentDialog.vue";
import AboutFeedbackDialog from "@/components/about/AboutFeedbackDialog.vue";
import { QUALITY_UNLOCK_FEEDBACK_QUERY_VALUE } from "@/composables/useQualityUnlockFeedback";
import electronAPI from "@/utils/electron";
import { useAppShareDialog } from "@/composables/useAppShareDialog";
import { normalizeReleaseNotes, normalizeVersionLabel } from "@/utils/updaterNotes";

defineOptions({ name: "AboutSetting" });
const { openAppShare } = useAppShareDialog();

type LocalUpdaterState = Awaited<ReturnType<ElectronIpc["getUpdaterState"]>>;
type AboutInfo = Awaited<ReturnType<ElectronIpc["getAboutInfo"]>>;

const defaultAbout: AboutInfo = {
  appName: "PisaMusic",
  websiteLabel: "",
  websiteUrl: "",
  description: "",
  team: "",
  copyright: "",
};

const state = ref<LocalUpdaterState | null>(null);
const route = useRoute();
const router = useRouter();
const about = ref<AboutInfo>({ ...defaultAbout });
const appVersion = ref("");
const aboutLoading = ref(false);
const developmentRuntime = ref(false);
const feedbackDialogVisible = ref(false);
const feedbackInitialType = ref<"bug" | "suggestion" | "account" | "other">("bug");
const updateDialogVisible = ref(false);
const updateDialogState = ref<LocalUpdaterState | null>(null);
const contentDialog = ref({
  show: false,
  title: "",
  content: "",
  loading: false,
});

const updateModalMaskStyle = {
  backdropFilter: "blur(16px)",
  background: "rgba(8, 12, 20, 0.42)",
};

const checking = computed(() => state.value?.status === "checking");
const canDownload = computed(() => state.value?.status === "available" && !state.value?.simulated);
const canInstall = computed(() => state.value?.status === "downloaded");
const canViewNotes = computed(() => {
  const status = state.value?.status;
  return Boolean(state.value?.updateInfo && (status === "available" || status === "downloading" || status === "downloaded"));
});
const updateStatusLabel = computed(() => {
  const status = state.value?.status;
  if (status === "checking") return "检查中";
  if (status === "available") return "有新版本";
  if (status === "downloading") return "下载中";
  if (status === "downloaded") return "待安装";
  if (status === "not-available") return "已是最新";
  if (status === "error") return "检查失败";
  if (status === "disabled") return "不可用";
  return `v${normalizeVersionLabel(appVersion.value)}`;
});
const updateStatusClass = computed(() => {
  const status = state.value?.status;
  if (status === "available" || status === "downloaded" || status === "downloading") return "is-highlight";
  if (status === "error") return "is-warning";
  return "";
});
const updateDialogTitle = computed(() => {
  const version = updateDialogState.value?.updateInfo?.version || appVersion.value || "-";
  return `Pisa Music v${normalizeVersionLabel(version)}版本`;
});
const updateReleaseNotes = computed(() => normalizeReleaseNotes(updateDialogState.value?.updateInfo?.releaseNotes));
const updateText = computed(() => {
  const current = state.value;
  if (!current) return "点击检查更新，查看是否有新的桌面端版本。";
  if (current.status === "disabled") return current.error || "当前环境不支持自动更新。";
  if (current.status === "checking") return current.simulated ? "正在向服务器模拟检查新版本..." : "正在检查新版本...";
  if (current.status === "available") {
    const version = current.updateInfo?.version || "";
    return current.simulated
      ? `模拟发现新版本 ${version}。`
      : `发现新版本 ${version}，确认后可开始下载。`;
  }
  if (current.status === "downloading") return `正在下载更新 ${Math.round(current.progress?.percent ?? 0)}%。`;
  if (current.status === "downloaded") return "更新已下载完成，可以重启安装。";
  if (current.status === "not-available") return "当前已经是最新版本。";
  if (current.status === "error") return current.error || "检查更新失败。";
  return "点击检查更新，查看是否有新的桌面端版本。";
});

let disposeUpdaterState: (() => void) | undefined;
let lastHandledManualResult = "";

function getManualResultKey(next: LocalUpdaterState) {
  return [
    next.status,
    next.updateInfo?.version || "",
    normalizeReleaseNotes(next.updateInfo?.releaseNotes, ""),
    next.error || "",
    next.simulated ? "simulated" : "real",
  ].join(":");
}

function handleManualCheckResult(next: LocalUpdaterState) {
  if (next.status === "available" && updateDialogVisible.value) {
    updateDialogState.value = next;
  }
  if (!next.manual) return;
  if (next.status === "checking") {
    lastHandledManualResult = "";
    return;
  }
  const resultKey = getManualResultKey(next);
  if (resultKey === lastHandledManualResult) return;
  lastHandledManualResult = resultKey;

  if (next.status === "not-available") {
    window.$message?.success("已是最新版本");
    return;
  }

  if (next.status === "available") {
    updateDialogState.value = next;
    updateDialogVisible.value = true;
  }
}

function openUpdateDialog() {
  if (!state.value?.updateInfo) return;
  updateDialogState.value = state.value;
  updateDialogVisible.value = true;
}

async function loadAboutInfo() {
  aboutLoading.value = true;
  try {
    const info = await electronAPI.getAboutInfo();
    about.value = {
      appName: info.appName || defaultAbout.appName,
      websiteLabel: info.websiteLabel || "",
      websiteUrl: info.websiteUrl || "",
      description: info.description || "",
      team: info.team || "",
      copyright: info.copyright || "",
    };
  } catch (error) {
    window.$message?.warning("关于信息加载失败");
    void electronAPI.reportError(error, {
      scope: "about",
      action: "loadAboutInfo",
    });
  } finally {
    aboutLoading.value = false;
  }
}

async function loadBaseInfo() {
  const [versionResult, runtimeResult] = await Promise.allSettled([
    electronAPI.getAppVersion(),
    electronAPI.isDevelopmentRuntime(),
  ]);
  if (versionResult.status === "fulfilled") appVersion.value = versionResult.value;
  if (runtimeResult.status === "fulfilled") developmentRuntime.value = runtimeResult.value;
}

async function openWebsite() {
  const url = about.value.websiteUrl?.trim();
  if (!url) return;
  try {
    await electronAPI.openUrl({ url, mode: "external" });
  } catch (error) {
    window.$message?.error(error instanceof Error ? error.message : "官网打开失败");
  }
}

async function checkUpdate() {
  lastHandledManualResult = "";
  const next = await electronAPI.checkForUpdates({ manual: true });
  state.value = next;
  handleManualCheckResult(next);
}

async function simulateCheckUpdate() {
  lastHandledManualResult = "";
  const next = await electronAPI.simulateCheckForUpdates();
  state.value = next;
  handleManualCheckResult(next);
}

async function downloadUpdate() {
  state.value = await electronAPI.downloadUpdate();
}

async function updateImmediately() {
  updateDialogVisible.value = false;
  await downloadUpdate();
}

async function openOfficialDownload() {
  const url = about.value.websiteUrl?.trim();
  if (!url) {
    window.$message?.warning("暂未配置官网地址");
    return;
  }
  await openWebsite();
}

function closeUpdateDialog() {
  updateDialogVisible.value = false;
}

function installUpdate() {
  void electronAPI.quitAndInstallUpdate();
}

function openFeedback() {
  feedbackInitialType.value = "bug";
  feedbackDialogVisible.value = true;
}

async function handleFeedbackRouteRequest(value: unknown) {
  const request = Array.isArray(value) ? value[0] : value;
  if (request !== QUALITY_UNLOCK_FEEDBACK_QUERY_VALUE) return;

  feedbackInitialType.value = "account";
  feedbackDialogVisible.value = true;
  window.$message?.info("请输入需求并提交，等待作者审核。");

  const query = { ...route.query };
  delete query.feedback;
  await router.replace({ path: route.path, query });
}

watch(
  () => route.query.feedback,
  (value) => {
    void handleFeedbackRouteRequest(value);
  },
  { immediate: true },
);

async function openContentDialog(type: "agreement" | "privacy") {
  contentDialog.value = {
    show: true,
    title: type === "agreement" ? "用户协议" : "隐私政策",
    content: "",
    loading: true,
  };
  try {
    const data = type === "agreement"
      ? await electronAPI.getServiceAgreement()
      : await electronAPI.getPrivacyPolicy();
    contentDialog.value = {
      show: true,
      title: data.title || (type === "agreement" ? "用户协议" : "隐私政策"),
      content: data.content || "暂无内容",
      loading: false,
    };
  } catch (error) {
    contentDialog.value.loading = false;
    contentDialog.value.content = "内容加载失败，请稍后重试。";
    window.$message?.warning("内容加载失败");
    void electronAPI.reportError(error, {
      scope: "about",
      action: type === "agreement" ? "loadServiceAgreement" : "loadPrivacyPolicy",
    });
  }
}

onMounted(async () => {
  await Promise.all([loadBaseInfo(), loadAboutInfo()]);
  state.value = await electronAPI.getUpdaterState();
  disposeUpdaterState = electronAPI.onUpdaterState((next) => {
    state.value = next;
    handleManualCheckResult(next);
  });
});

onBeforeUnmount(() => {
  disposeUpdaterState?.();
});
</script>

<style scoped lang="scss">
@use "../settingLayout.scss";

.brand-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 18px;
  padding: 20px 22px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-control);
  background: var(--surface-card);
  box-sizing: border-box;
}

.brand-main {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  flex: 1 1 280px;
}

.app-mark {
  width: 64px;
  height: 64px;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: var(--radius-control);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
}

.brand-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.brand-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;

  h1 {
    margin: 0;
    color: var(--text-primary);
    font-size: 20px;
    font-weight: 800;
    line-height: 1.25;
  }
}

.version-badge,
.team-badge,
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
}

.version-badge {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.team-badge {
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  background: var(--surface-input);
  font-weight: 600;
}

.brand-desc {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.brand-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.item-leading {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1 1 220px;
  min-width: 0;
}

.item-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: var(--radius-control);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.setting-title-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.status-pill {
  color: var(--text-secondary);
  background: var(--surface-input);
  border: 1px solid var(--border-subtle);

  &.is-highlight {
    color: var(--color-primary);
    border-color: color-mix(in srgb, var(--color-primary) 28%, transparent);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  }

  &.is-warning {
    color: #e03131;
    border-color: rgba(224, 49, 49, 0.25);
    background: rgba(224, 49, 49, 0.1);
  }
}

.update-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}

.action-row {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;

  &:hover .row-trailing {
    color: var(--text-primary);
    transform: translateX(2px);
  }
}

.row-trailing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
  transition:
    color 0.18s ease,
    transform 0.18s ease;
}

.copyright-team {
  color: var(--text-secondary);
  font-size: 12px;
  flex-shrink: 0;
}

.update-modal {
  width: min(400px, calc(100vw - 44px));
}

.update-dialog-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border-modal);
  border-radius: var(--radius-control);
  padding: 36px 30px 30px;
  background: var(--surface-modal);
  box-shadow: var(--shadow-modal);
  color: var(--text-primary);
}

.update-dialog-card::before {
  content: "";
  position: absolute;
  inset: 1px;
  border-radius: var(--radius-control);
  border: 1px solid var(--border-subtle);
  pointer-events: none;
}

.update-dialog-title {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;

  h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 20px;
    font-weight: 850;
    line-height: 1.3;
  }
}

.update-title-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-control);
  overflow: hidden;
  background: var(--surface-card);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 22px color-mix(in srgb, var(--color-primary) 28%, transparent);

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
}

.update-dialog-notes {
  position: relative;
  max-height: 180px;
  overflow: auto;
  margin-top: 22px;
  padding: 18px 20px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-control);
  background: var(--surface-input);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: inset -4px 0 0 color-mix(in srgb, var(--color-primary) 14%, transparent);

  strong {
    display: block;
    margin-bottom: 8px;
    color: var(--text-primary);
    font-weight: 850;
  }
}

.update-dialog-actions {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 26px;

  :deep(.n-button) {
    width: 100%;
    height: 46px;
    border-radius: var(--radius-pill);
    font-size: 15px;
    font-weight: 800;
  }
}

.update-primary-button {
  --n-color: var(--color-primary) !important;
  --n-color-hover: var(--color-primary-hover) !important;
  --n-color-pressed: color-mix(in srgb, var(--color-primary) 82%, #000000 18%) !important;
  --n-border: 1px solid var(--color-primary) !important;
  --n-border-hover: 1px solid var(--color-primary-hover) !important;
  box-shadow: 0 12px 24px color-mix(in srgb, var(--color-primary) 26%, transparent);
}

.update-glass-button {
  --n-text-color: var(--text-secondary) !important;
  --n-text-color-hover: var(--text-primary) !important;
  --n-text-color-pressed: var(--text-primary) !important;
  --n-border: 1px solid var(--border-subtle) !important;
  --n-border-hover: 1px solid var(--border-default) !important;
  --n-border-pressed: 1px solid var(--border-default) !important;
  --n-color: var(--surface-control) !important;
  --n-color-hover: var(--surface-control-hover) !important;
  --n-color-pressed: var(--surface-control-active) !important;
}

@media (max-width: 560px) {
  .update-dialog-card {
    padding: 28px 22px 24px;
  }
}
</style>
