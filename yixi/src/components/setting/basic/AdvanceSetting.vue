<template>
    <div class="setting-con">
        <n-card class="backup-server">
            <template #header>
                <span style="display: flex">备用服务器({{ delay }}ms)</span>
                <span :style="{ color: useBackupServer ? 'green' : 'red' }">{{
                    useBackupServer ? "正在使用备用服务器" : "当前使用本地服务"
                    }}</span>
            </template>
            <template #header-extra>
                <n-switch v-model:value="useBackupServer">
                    <template #checked>开</template>
                    <template #unchecked>关</template>
                </n-switch>
            </template>
            <template #default>
                <div>
                    <div>连接状态: <span :style="{ color: serverStatus }">{{ backupRes?.message == "success" ? "success" :
                        "fail" }}</span></div>
                    <div>
                        服务器:
                        <span :style="{ color: serverStatus }">{{ backupRes?.status == "OK" ? "OK" : "fail" }}</span>
                    </div>
                    <div>服务器版本: {{ backupRes?.version }}</div>
                    <div>
                        服务器时间:
                        {{
                            backupRes &&
                            new Date(
                                new Date(backupRes.currentTime).getTime() + 8 * 60 * 60 * 1000
                            ).toLocaleString()
                        }}
                    </div>
                </div>
            </template>
        </n-card>

        <div class="setting-item">
            <div>KG URL</div>
            <div class="item-right">
                <n-input v-model:value="urlPack.kgUrl" placeholder="请输入KG URL"></n-input>

                <n-button secondary @click="testUrl('kgUrl')">测试</n-button>
                <n-button secondary color="red">重置</n-button>
            </div>
        </div>
        <div class="setting-item">
            <div>WY URL</div>
            <div class="item-right">
                <n-input v-model:value="urlPack.wyUrl" placeholder="请输入wy URL"></n-input>

                <n-button secondary @click="testUrl('wyUrl')">测试</n-button>
                <n-button secondary color="red">重置</n-button>
            </div>
        </div>
        <div class="setting-item">
            <div>Proxy URL</div>
            <div class="item-right">
                <n-input v-model:value="urlPack.proxyUrl" placeholder="请输入Proxy URL"></n-input>

                <n-button secondary @click="testUrl('proxyUrl')">测试</n-button>
                <n-button secondary color="red">重置</n-button>
            </div>
        </div>
        <div class="setting-item">
            <div>操作</div>
            <div class="item-right">
                <n-button type="primary" @click="saveUrl">保存</n-button>
                <n-button secondary color="red" @click="resetUrl('all')">重置全部</n-button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { NInput, NButton, NCard, NSwitch } from "naive-ui";
import directAPI from "@/utils/api/directAPI";
import { proxyAPI } from "@/utils/api/proxyAPI";
import electronAPI from "@/utils/electron";

const useBackupServer = ref(true);
const backServer = ref<{
      kgServer: string;
      wyServer: string;
      kwServer: string;
      kgProxy: string;
      wyProxy: string;
      kwProxy: string;
    }>()
const backupRes = ref<{
    message: string;
    status: string;
    currentTime: string;
    version: string;
}>();
const delay = ref(0);
const serverStatus = computed(() => {
    return backupRes?.value?.status == "OK" ? "green" : "red"
})

watch(
    () => useBackupServer.value,
    (val) => {
        if (val && backServer.value) {
            localStorage.setItem("pisa-use-backup-server", "true");
            directAPI.kg?.setBaseURL(backServer.value.kgServer);
            directAPI.wy?.setBaseURL(backServer.value.wyServer);
            proxyAPI.kg?.setBaseURL(backServer.value.kgProxy + "/proxy/kg");
            proxyAPI.wy?.setBaseURL(backServer.value.wyProxy + "/proxy/wy");
            proxyAPI.kw?.setBaseURL(backServer.value.kwProxy + "/proxy/kw");
        } else {
            localStorage.setItem("pisa-use-backup-server", "false");
            loadUrlFromLocalStorage();
        }
    }
);

onMounted(async () => {
    useBackupServer.value =
        localStorage.getItem("pisa-use-backup-server") === "true";
    const s = await electronAPI.getServerPort();
    backServer.value = s.backServer;
    const t = new Date().getTime()
    const res = await fetch(backServer.value.kgProxy.replace("/proxy/kg", ""));
    const t2 = new Date().getTime()
    delay.value = t2 - t
    backupRes.value = await res.json();
    loadUrl();
    if (!urlPack.kgUrl) resetUrl('all')
});

const urlPack = reactive({
    kgUrl: localStorage.getItem("pisa-kg-url") || "",
    wyUrl: localStorage.getItem("pisa-wy-url") || "",
    proxyUrl: localStorage.getItem("pisa-proxy-url") || "",
});

const loadUrlFromLocalStorage = () => {
    urlPack.kgUrl = localStorage.getItem("pisa-kg-url") || "";
    urlPack.wyUrl = localStorage.getItem("pisa-wy-url") || "";
    urlPack.proxyUrl = localStorage.getItem("pisa-proxy-url") || "";
};

const testUrl = async (op: "kgUrl" | "wyUrl" | "proxyUrl") => {
    const url = urlPack[op];
    const res = await fetch(url);
    if (res.status === 200) {
        window.$message.success("此url可用");
    } else {
        window.$message.error("此url不可用");
    }
};

const saveUrl = () => {
    localStorage.setItem("pisa-kg-url", urlPack.kgUrl);
    localStorage.setItem("pisa-wy-url", urlPack.wyUrl);
    localStorage.setItem("pisa-proxy-url", urlPack.proxyUrl);
    window.$message.success("已保存");
};
const resetUrl = (op: "kg" | "wy" | "proxy" | "all") => {
    switch (op) {
        case "kg":
            urlPack.kgUrl = "http://127.0.0.1:31000";
            window.$message.success("已重置kgUrl");
            break;
        case "wy":
            urlPack.wyUrl = "http://127.0.0.1:31001";
            window.$message.success("已重置wyUrl");
            break;
        case "proxy":
            urlPack.proxyUrl = "http://127.0.0.1:38888";
            window.$message.success("已重置proxyUrl");
            break;
        case "all":
            resetUrl("kg");
            resetUrl("wy");
            resetUrl("proxy");
            break;
    }
    saveUrl();
};

const loadUrl = () => {
    urlPack.kgUrl = directAPI.kg?.getBaseURL() || localStorage.getItem("pisa-kg-url") || "";
    urlPack.wyUrl = directAPI.wy?.getBaseURL() || localStorage.getItem("pisa-wy-url") || "";
    urlPack.proxyUrl = directAPI.kw?.getBaseURL().replace("/proxy/kw","") || localStorage.getItem("pisa-proxy-url") || "";
    saveUrl();
};
</script>

<style lang="scss" scoped>
.setting-con {
    .backup-server {
        height: 100%;
        background: transparent;
        border: 1px solid #f5f5f5;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
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
            width: 360px;
        }
    }
}
</style>
