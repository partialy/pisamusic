<template>
  <div class="setting-con">
    <n-card class="backup-server">
      <template #header>
        <div class="tips-header">
          <span>服务端配置（{{ delay }}ms）</span>
          <span :style="{ color: serverStatus }">
            {{ backupRes?.status === "OK" ? "在线" : "不可用" }}
          </span>
        </div>
      </template>
      <template #header-extra>
        <n-button secondary @click="refreshRuntimeConfig">刷新</n-button>
      </template>
      <template #default>
        <div class="server-info">
          <div>连接状态：{{ backupRes?.message || "-" }}</div>
          <div>服务状态：{{ backupRes?.status || "-" }}</div>
          <div>配置版本：{{ backupRes?.version || "-" }}</div>
          <div>检查时间：{{ backupRes?.currentTime ? new Date(backupRes.currentTime).toLocaleString() : "-" }}</div>
        </div>
      </template>
    </n-card>

    <div class="setting-item">
      <div>KG URL</div>
      <div class="item-right">
        <n-input v-model:value="urlPack.kgUrl" placeholder="KG URL" />
        <n-button secondary @click="testUrl('kgUrl')">测试</n-button>
        <n-button secondary color="red" @click="resetUrl('kg')">重置</n-button>
      </div>
    </div>
    <div class="setting-item">
      <div>WY URL</div>
      <div class="item-right">
        <n-input v-model:value="urlPack.wyUrl" placeholder="WY URL" />
        <n-button secondary @click="testUrl('wyUrl')">测试</n-button>
        <n-button secondary color="red" @click="resetUrl('wy')">重置</n-button>
      </div>
    </div>
    <div class="setting-item">
      <div>Proxy URL</div>
      <div class="item-right">
        <n-input v-model:value="urlPack.proxyUrl" placeholder="Proxy URL" />
        <n-button secondary @click="testUrl('proxyUrl')">测试</n-button>
        <n-button secondary color="red" @click="resetUrl('proxy')">重置</n-button>
      </div>
    </div>
    <div class="setting-item">
      <div>操作</div>
      <div class="item-right">
        <n-button type="primary" @click="applyUrl">应用到当前运行时</n-button>
        <n-button secondary color="red" @click="resetUrl('all')">重置全部</n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { NInput, NButton, NCard } from "naive-ui";
import electronAPI from "@/utils/electron";
import { useRuntimeConfigStore } from "@/store";

type RuntimeEndpoints = {
  kgServer: string;
  wyServer: string;
  kwServer: string;
  kgProxy: string;
  wyProxy: string;
  kwProxy: string;
};

const runtimeConfig = useRuntimeConfigStore();
const backServer = ref<RuntimeEndpoints | null>(null);
const backupRes = ref<{
  message: string;
  status: string;
  currentTime: string;
  version: string;
}>();
const delay = ref(0);

const urlPack = reactive({
  kgUrl: "",
  wyUrl: "",
  proxyUrl: "",
});

const serverStatus = computed(() => {
  return backupRes.value?.status === "OK" ? "green" : "red";
});

const refreshRuntimeConfig = async () => {
  const endpoints = await runtimeConfig.refresh();
  backServer.value = endpoints || (await electronAPI.getRuntimeEndpoints(true));
  loadUrl();
  await refreshServerStatus();
};

const refreshServerStatus = async () => {
  try {
    const baseUrl = await electronAPI.getSystemBaseUrl();
    const start = Date.now();
    const res = await fetch(new URL("/api/health", baseUrl).toString());
    delay.value = Date.now() - start;
    const data = await res.json();
    backupRes.value = {
      message: data.msg || (data.success ? "success" : "fail"),
      status: data.data?.status === "up" ? "OK" : "fail",
      currentTime: new Date().toISOString(),
      version: runtimeConfig.loaded ? "runtime" : "",
    };
  } catch {
    backupRes.value = {
      message: "fail",
      status: "fail",
      currentTime: new Date().toISOString(),
      version: "",
    };
  }
};

const testUrl = async (op: "kgUrl" | "wyUrl" | "proxyUrl") => {
  try {
    const res = await fetch(urlPack[op]);
    if (res.ok) {
      window.$message.success("URL 可用");
    } else {
      window.$message.error("URL 不可用");
    }
  } catch {
    window.$message.error("URL 不可用");
  }
};

const applyUrl = () => {
  runtimeConfig.applyEndpoints({
    kgServer: urlPack.kgUrl,
    wyServer: urlPack.wyUrl,
    kwServer: `${urlPack.proxyUrl}/proxy/kw`,
    kgProxy: `${urlPack.proxyUrl}/proxy/kg`,
    wyProxy: `${urlPack.proxyUrl}/proxy/wy`,
    kwProxy: `${urlPack.proxyUrl}/proxy/kw`,
  });
  window.$message.success("已应用到当前运行时");
};

const resetUrl = (op: "kg" | "wy" | "proxy" | "all") => {
  switch (op) {
    case "kg":
      urlPack.kgUrl = backServer.value?.kgServer || "";
      break;
    case "wy":
      urlPack.wyUrl = backServer.value?.wyServer || "";
      break;
    case "proxy":
      urlPack.proxyUrl = proxyBase(backServer.value?.kgProxy || "");
      break;
    case "all":
      resetUrl("kg");
      resetUrl("wy");
      resetUrl("proxy");
      break;
  }
};

const loadUrl = () => {
  urlPack.kgUrl = backServer.value?.kgServer || "";
  urlPack.wyUrl = backServer.value?.wyServer || "";
  urlPack.proxyUrl = proxyBase(backServer.value?.kgProxy || "");
};

const proxyBase = (url: string) => {
  return url.replace(/\/proxy\/(kg|wy|kw)\/?$/, "");
};

onMounted(() => {
  void refreshRuntimeConfig();
});
</script>

<style lang="scss" scoped>
.setting-con {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .backup-server {
    height: 100%;
    background: transparent;
    border: 1px solid #f5f5f5;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
  }

  .tips-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .server-info {
    display: grid;
    gap: 6px;
    color: var(--color-text-secondary);
  }

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;

    &:hover {
      background: #f5f5f5;
      cursor: pointer;
      border-radius: 8px;
    }

    .item-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .n-input {
      width: 400px;
    }
  }
}
</style>
