<template>
  <div class="advance-setting">
    <section class="setting-card">
      <div class="section-header">
        <div>
          <h3>服务端配置</h3>
          <p>查看当前网关连接状态，并刷新运行时端点。</p>
        </div>
        <div class="status-actions">
          <span class="status-pill" :class="serverStatusClass">
            {{ backupRes?.status === "OK" ? "在线" : "不可用" }}
          </span>
          <n-button secondary round @click="refreshRuntimeConfig">
            刷新
          </n-button>
        </div>
      </div>

      <div class="server-grid">
        <div class="server-info-item">
          <span>连接状态</span>
          <strong>{{ backupRes?.message || "-" }}</strong>
        </div>
        <div class="server-info-item">
          <span>服务状态</span>
          <strong>{{ backupRes?.status || "-" }}</strong>
        </div>
        <div class="server-info-item">
          <span>配置版本</span>
          <strong>{{ backupRes?.version || "-" }}</strong>
        </div>
        <div class="server-info-item">
          <span>延迟</span>
          <strong>{{ delay }}ms</strong>
        </div>
        <div class="server-info-item wide">
          <span>检查时间</span>
          <strong>{{ backupRes?.currentTime ? new Date(backupRes.currentTime).toLocaleString() : "-" }}</strong>
        </div>
      </div>
    </section>

    <section class="setting-card">
      <div class="section-header">
        <div>
          <h3>运行端点</h3>
          <p>仅影响当前运行时，通常用于调试音源和代理服务。</p>
        </div>
      </div>

      <div class="endpoint-list">
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">KG URL</div>
            <div class="item-desc">酷狗音源服务地址。</div>
          </div>
          <div class="item-right">
            <n-input v-model:value="urlPack.kgUrl" placeholder="KG URL" />
            <n-button secondary round @click="testUrl('kgUrl')">测试</n-button>
            <n-button secondary round type="error" @click="resetUrl('kg')">重置</n-button>
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">WY URL</div>
            <div class="item-desc">网易云音源服务地址。</div>
          </div>
          <div class="item-right">
            <n-input v-model:value="urlPack.wyUrl" placeholder="WY URL" />
            <n-button secondary round @click="testUrl('wyUrl')">测试</n-button>
            <n-button secondary round type="error" @click="resetUrl('wy')">重置</n-button>
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">Proxy URL</div>
            <div class="item-desc">统一代理根地址，会自动拼接 /proxy/*。</div>
          </div>
          <div class="item-right">
            <n-input v-model:value="urlPack.proxyUrl" placeholder="Proxy URL" />
            <n-button secondary round @click="testUrl('proxyUrl')">测试</n-button>
            <n-button secondary round type="error" @click="resetUrl('proxy')">重置</n-button>
          </div>
        </div>
      </div>
    </section>

    <section class="setting-card action-card">
      <div class="item-info">
        <div class="item-title">应用运行时端点</div>
        <div class="item-desc">保存到当前应用进程，不会覆盖后端下发的配置。</div>
      </div>
      <div class="item-right">
        <n-button type="primary" round @click="applyUrl">应用到当前运行时</n-button>
        <n-button secondary round type="error" @click="resetUrl('all')">重置全部</n-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { NInput, NButton } from "naive-ui";
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

const serverStatusClass = computed(() => {
  return backupRes.value?.status === "OK" ? "is-online" : "is-offline";
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
.advance-setting {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 20px;
}

.setting-card {
  padding: 18px;
  border: 1px solid var(--color-border-default);
  border-radius: 14px;
  background: var(--color-card-bg);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;

  h3 {
    margin: 0;
    color: var(--color-text-default);
    font-size: 16px;
    font-weight: 700;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-text-secondary);
    font-size: 12px;
  }
}

.status-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;

  &.is-online {
    color: #16a34a;
    background: rgba(22, 163, 74, 0.1);
  }

  &.is-offline {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }
}

.server-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.server-info-item {
  min-height: 66px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--color-bg-secondary);

  &.wide {
    grid-column: span 4;
  }

  span {
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  strong {
    color: var(--color-text-default);
    font-size: 14px;
    font-weight: 600;
    word-break: break-all;
  }
}

.endpoint-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-item,
.action-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 68px;
  padding: 12px 14px;
  border-radius: 12px;
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--color-setting-hover);
  }
}

.item-info {
  min-width: 0;
}

.item-title {
  color: var(--color-text-default);
  font-size: 14px;
  font-weight: 700;
}

.item-desc {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.item-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

:deep(.n-input) {
  width: min(42vw, 420px);
}
</style>
