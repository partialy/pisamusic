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

      <div class="info-card">
        <div>
          <p class="card-label">版权信息</p>
          <h2>{{ about.copyright || "PisaMusic" }}</h2>
          <p class="card-desc">关于信息来自服务器配置。</p>
        </div>
        <n-button secondary :loading="aboutLoading" @click="loadAboutInfo">刷新</n-button>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { NButton, NSkeleton } from "naive-ui";
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

const checking = computed(() => state.value?.status === "checking");
const canDownload = computed(() => state.value?.status === "available" && !state.value?.simulated);
const canInstall = computed(() => state.value?.status === "downloaded");
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
  state.value = await electronAPI.checkForUpdates({ manual: true });
}

async function simulateCheckUpdate() {
  state.value = await electronAPI.simulateCheckForUpdates();
}

async function downloadUpdate() {
  state.value = await electronAPI.downloadUpdate();
}

function installUpdate() {
  void electronAPI.quitAndInstallUpdate();
}

onMounted(async () => {
  await Promise.all([loadBaseInfo(), loadAboutInfo()]);
  state.value = await electronAPI.getUpdaterState();
  disposeUpdaterState = electronAPI.onUpdaterState((next) => {
    state.value = next;
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

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

  .update-actions {
    justify-content: flex-start;
  }
}
</style>
