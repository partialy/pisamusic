<template>
  <div class="about-page">
    <section class="hero-panel">
      <div class="app-mark">
        <img src="@/assets/pisamusic_icon_1024.png" alt="PisaMusic" />
      </div>
      <div class="hero-content">
        <p class="eyebrow">ABOUT</p>
        <h1>{{ about.appName || "PisaMusic" }}</h1>
        <p class="description">
          <n-skeleton v-if="aboutLoading" text width="260px" />
          <span v-else>{{ about.description || "桌面端音乐播放器" }}</span>
        </p>
        <div class="meta-row">
          <span>当前版本 {{ appVersion || "-" }}</span>
          <span v-if="about.team">{{ about.team }}</span>
        </div>
        <n-button class="hero-refresh" tertiary :loading="aboutLoading" @click="loadAboutInfo">刷新信息</n-button>
      </div>
    </section>

    <section class="info-grid">
      <div class="info-card">
        <div>
          <p class="card-label">官方网站</p>
          <h2>{{ about.websiteLabel || "PisaMusic" }}</h2>
          <p class="card-desc">{{ about.websiteUrl || "暂未配置官网地址" }}</p>
        </div>
        <n-button secondary :disabled="!about.websiteUrl" @click="openWebsite">打开</n-button>
      </div>
    </section>

    <section class="update-card">
      <div>
        <p class="card-label">在线更新</p>
        <h2>检查桌面端版本</h2>
        <p>{{ updateText }}</p>
      </div>
      <div class="update-actions">
        <n-button :loading="checking" secondary @click="checkUpdate">检查更新</n-button>
        <n-button v-if="developmentRuntime" :loading="checking" tertiary type="primary" @click="simulateCheckUpdate">
          模拟检查更新
        </n-button>
        <n-button v-if="canDownload" type="primary" @click="downloadUpdate">下载更新</n-button>
        <n-button v-if="canInstall" type="primary" @click="installUpdate">重启安装</n-button>
      </div>
    </section>

    <section class="entry-list">
      <button type="button" class="entry-item" @click="openFeedback">
        <span class="entry-icon">
          <n-icon :component="MessageSquareText" size="22" />
        </span>
        <span class="entry-content">
          <span>意见反馈</span>
          <small>提交问题、建议和截图</small>
        </span>
        <n-icon class="entry-arrow" :component="ChevronRight" size="18" />
      </button>
      <button type="button" class="entry-item" @click="openContentDialog('agreement')">
        <span class="entry-icon">
          <n-icon :component="FileText" size="22" />
        </span>
        <span class="entry-content">
          <span>用户协议</span>
          <small>查看服务条款</small>
        </span>
        <n-icon class="entry-arrow" :component="ChevronRight" size="18" />
      </button>
      <button type="button" class="entry-item" @click="openContentDialog('privacy')">
        <span class="entry-icon">
          <n-icon :component="ShieldCheck" size="22" />
        </span>
        <span class="entry-content">
          <span>隐私政策</span>
          <small>查看数据与隐私说明</small>
        </span>
        <n-icon class="entry-arrow" :component="ChevronRight" size="18" />
      </button>
    </section>

    <footer class="copyright-footer">
      <p class="card-label">版权信息</p>
      <p>{{ about.copyright || "PisaMusic" }}</p>
    </footer>

    <AboutContentDialog
      v-model:show="contentDialog.show"
      :title="contentDialog.title"
      :content="contentDialog.content"
      :loading="contentDialog.loading"
    />
    <AboutFeedbackDialog v-model:show="feedbackDialogVisible" :app-version="appVersion" />
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
            <n-icon :component="Sparkles" size="24" />
          </span>
          <h2>{{ updateDialogTitle }}</h2>
        </div>
        <div class="update-dialog-notes">{{ updateReleaseNotes }}</div>
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
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { NButton, NIcon, NModal, NSkeleton } from "naive-ui";
import {
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from "lucide-vue-next";
import AboutContentDialog from "@/components/about/AboutContentDialog.vue";
import AboutFeedbackDialog from "@/components/about/AboutFeedbackDialog.vue";
import electronAPI from "@/utils/electron";

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
const about = ref<AboutInfo>({ ...defaultAbout });
const appVersion = ref("");
const aboutLoading = ref(false);
const developmentRuntime = ref(false);
const feedbackDialogVisible = ref(false);
const updateDialogVisible = ref(false);
const updateDialogState = ref<LocalUpdaterState | null>(null);
const contentDialog = ref({
  show: false,
  title: "",
  content: "",
  loading: false,
});

const updateModalMaskStyle = {
  backdropFilter: "blur(18px)",
  background: "rgba(8, 12, 20, 0.34)",
};

const checking = computed(() => state.value?.status === "checking");
const canDownload = computed(() => state.value?.status === "available" && !state.value?.simulated);
const canInstall = computed(() => state.value?.status === "downloaded");
const updateDialogTitle = computed(() => {
  const version = updateDialogState.value?.updateInfo?.version || appVersion.value || "-";
  return `Pisa Music v${version}版本`;
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

function normalizeReleaseNotes(value: unknown) {
  if (Array.isArray(value)) {
    const text = value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "note" in item) return String(item.note ?? "");
        return "";
      })
      .filter(Boolean)
      .join("\n");
    return text || "暂无更新说明";
  }
  const text = String(value ?? "").trim();
  return text || "暂无更新说明";
}

function getManualResultKey(next: LocalUpdaterState) {
  return [
    next.status,
    next.updateInfo?.version || "",
    next.error || "",
    next.simulated ? "simulated" : "real",
  ].join(":");
}

function handleManualCheckResult(next: LocalUpdaterState) {
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
  const next = await electronAPI.checkForUpdates({ manual: true });
  state.value = next;
  handleManualCheckResult(next);
}

async function simulateCheckUpdate() {
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
  feedbackDialogVisible.value = true;
}

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
      content: data.content || "<p>暂无内容</p>",
      loading: false,
    };
  } catch (error) {
    contentDialog.value.loading = false;
    contentDialog.value.content = "<p>内容加载失败，请稍后重试。</p>";
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
.about-page {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 28px;
  box-sizing: border-box;
}

.hero-panel,
.info-card,
.update-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-elevated);
  box-sizing: border-box;
}

.hero-panel {
  display: flex;
  align-items: center;
  gap: 22px;
  max-width: 860px;
  padding: 24px;
}

.app-mark {
  width: 92px;
  height: 92px;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 22px;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.14);

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
}

.hero-content {
  min-width: 0;
}

.eyebrow,
.card-label {
  margin: 0 0 8px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  color: var(--color-text);
  font-size: 30px;
  font-weight: 850;
  line-height: 1.2;
}

h2 {
  color: var(--color-text);
  font-size: 18px;
  font-weight: 800;
  line-height: 1.3;
}

.description,
.card-desc,
.update-card p {
  color: var(--color-text-2);
  font-size: 13px;
  line-height: 1.7;
}

.description {
  margin-top: 10px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;

  span {
    border: 1px solid color-mix(in srgb, var(--color-border) 76%, transparent);
    border-radius: 999px;
    color: var(--color-text-2);
    font-size: 12px;
    padding: 5px 10px;
  }
}

.hero-refresh {
  margin-top: 14px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  max-width: 860px;
  margin-top: 18px;
}

.info-card,
.update-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 20px;
}

.info-card > div,
.update-card > div:first-child {
  min-width: 0;
}

.card-desc {
  margin-top: 8px;
  word-break: break-all;
}

.update-card {
  max-width: 860px;
  margin-top: 18px;
}

.update-card h2 {
  margin-bottom: 8px;
}

.update-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.entry-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  max-width: 860px;
  margin-top: 18px;
}

.entry-item {
  min-height: 96px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
  border-radius: 8px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 58%),
    color-mix(in srgb, var(--color-bg-elevated) 78%, transparent);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 18px;
  text-align: left;
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--color-primary) 10%, transparent);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, background 0.2s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--color-primary) 42%, var(--color-border));
    background:
      linear-gradient(145deg, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent 62%),
      color-mix(in srgb, var(--color-bg-elevated) 86%, transparent);
    box-shadow: 0 16px 34px color-mix(in srgb, var(--color-primary) 16%, transparent);
    transform: translateY(-2px);
  }
}

.entry-icon {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.entry-content {
  min-width: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 7px;

  span {
    color: var(--color-text);
    font-size: 15px;
    font-weight: 800;
    line-height: 1.2;
  }

  small {
    color: var(--color-text-2);
    font-size: 12px;
    line-height: 1.4;
  }
}

.entry-arrow {
  color: color-mix(in srgb, var(--color-primary) 72%, var(--color-text-2));
  flex: 0 0 auto;
}

@media (max-width: 760px) {
  .about-page {
    padding: 18px;
  }

  .hero-panel,
  .info-card,
  .update-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .entry-list {
    grid-template-columns: 1fr;
  }

  .update-actions {
    justify-content: flex-start;
  }
}

.copyright-footer {
  max-width: 860px;
  margin-top: 22px;
  padding: 0 2px 6px;
  color: var(--color-text-2);
  font-size: 12px;
  line-height: 1.7;
}

.update-modal {
  width: min(520px, calc(100vw - 44px));
}

.update-dialog-card {
  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-primary) 34%, rgba(255, 255, 255, 0.38));
  border-radius: 8px;
  padding: 28px;
  background:
    radial-gradient(circle at 18% 0, color-mix(in srgb, #ffffff 36%, transparent), transparent 32%),
    linear-gradient(145deg, color-mix(in srgb, var(--color-primary) 92%, #ffffff 8%), color-mix(in srgb, var(--color-primary) 48%, var(--color-bg-elevated)) 72%);
  box-shadow: 0 28px 72px rgba(0, 0, 0, 0.28);
  color: #ffffff;
}

.update-dialog-card::before {
  content: "";
  position: absolute;
  inset: 1px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.2);
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
    color: #ffffff;
    font-size: 20px;
    font-weight: 850;
    line-height: 1.3;
  }
}

.update-title-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.16);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.update-dialog-notes {
  position: relative;
  max-height: 240px;
  overflow: auto;
  margin-top: 22px;
  padding: 18px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.update-dialog-actions {
  position: relative;
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 22px;
}

.update-primary-button {
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.2);
}

.update-glass-button {
  --n-text-color: #ffffff !important;
  --n-text-color-hover: #ffffff !important;
  --n-text-color-pressed: #ffffff !important;
  --n-border: 1px solid rgba(255, 255, 255, 0.34) !important;
  --n-border-hover: 1px solid rgba(255, 255, 255, 0.56) !important;
  --n-border-pressed: 1px solid rgba(255, 255, 255, 0.56) !important;
  --n-color: rgba(255, 255, 255, 0.12) !important;
  --n-color-hover: rgba(255, 255, 255, 0.2) !important;
  --n-color-pressed: rgba(255, 255, 255, 0.18) !important;
}

@media (max-width: 560px) {
  .update-dialog-card {
    padding: 22px;
  }

  .update-dialog-actions {
    flex-direction: column;
  }
}
</style>
