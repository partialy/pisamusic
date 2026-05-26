<template>
  <div class="about-page">
    <section class="about-panel">
      <div>
        <p class="eyebrow">PisaMusic</p>
        <h1>关于</h1>
        <p class="description">桌面端音乐播放器</p>
      </div>

      <div class="update-card">
        <div>
          <h2>在线更新</h2>
          <p>{{ updateText }}</p>
        </div>
        <div class="update-actions">
          <n-button :loading="checking" secondary @click="checkUpdate">检查更新</n-button>
          <n-button v-if="canDownload" type="primary" @click="downloadUpdate">下载更新</n-button>
          <n-button v-if="canInstall" type="primary" @click="installUpdate">重启安装</n-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { NButton } from "naive-ui";
import electronAPI from "@/utils/electron";

type LocalUpdaterState = Awaited<ReturnType<ElectronIpc["getUpdaterState"]>>;

const state = ref<LocalUpdaterState | null>(null);
const checking = computed(() => state.value?.status === "checking");
const canDownload = computed(() => state.value?.status === "available");
const canInstall = computed(() => state.value?.status === "downloaded");
const updateText = computed(() => {
  const current = state.value;
  if (!current) return "点击检查更新，查看是否有新的桌面端版本。";
  if (current.status === "disabled") return current.error || "当前环境不支持自动更新。";
  if (current.status === "checking") return "正在检查新版本...";
  if (current.status === "available") return `发现新版本 ${current.updateInfo?.version || ""}，确认后可开始下载。`;
  if (current.status === "downloading") return `正在下载更新 ${Math.round(current.progress?.percent ?? 0)}%。`;
  if (current.status === "downloaded") return "更新已下载完成，可以重启安装。";
  if (current.status === "not-available") return "当前已是最新版本。";
  if (current.status === "error") return current.error || "检查更新失败。";
  return "点击检查更新，查看是否有新的桌面端版本。";
});

let disposeUpdaterState: (() => void) | undefined;

async function checkUpdate() {
  state.value = await electronAPI.checkForUpdates({ manual: true });
}

async function downloadUpdate() {
  state.value = await electronAPI.downloadUpdate();
}

function installUpdate() {
  void electronAPI.quitAndInstallUpdate();
}

onMounted(async () => {
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
  height: 100%;
  overflow: auto;
  padding: 28px;
}

.about-panel {
  display: grid;
  gap: 24px;
  max-width: 760px;
}

.eyebrow {
  color: var(--primary-color);
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 8px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  color: var(--color-text);
  font-size: 28px;
  font-weight: 800;
}

.description {
  color: var(--color-text-2);
  font-size: 14px;
  margin-top: 8px;
}

.update-card {
  align-items: center;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  display: flex;
  gap: 18px;
  justify-content: space-between;
  padding: 20px;
}

.update-card h2 {
  color: var(--color-text);
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 8px;
}

.update-card p {
  color: var(--color-text-2);
  font-size: 13px;
}

.update-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}
</style>
