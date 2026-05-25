<template>
  <div class="sync-setting">
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">同步状态</div>
        <div class="setting-desc">{{ statusText }}</div>
      </div>
      <n-button secondary :loading="loading" @click="handleSyncNow">立即同步</n-button>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">同步码</div>
        <div class="setting-desc">{{ state.syncCode || "未创建" }}</div>
      </div>
      <n-space>
        <n-button secondary :loading="loading" @click="handleCreate">创建同步码</n-button>
        <n-button secondary :disabled="!state.syncCode" @click="copySyncCode">复制</n-button>
      </n-space>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">加入同步空间</div>
        <div class="setting-desc">输入手机端或其他桌面端显示的同步码</div>
      </div>
      <div class="join-row">
        <n-input
          v-model:value="joinCode"
          placeholder="同步码"
          clearable
          :disabled="loading" />
        <n-button type="primary" :loading="loading" @click="handleJoin">加入</n-button>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">当前设备</div>
        <div class="setting-desc">{{ state.deviceId || "未绑定" }}</div>
      </div>
      <n-button secondary type="error" :disabled="!state.token || loading" @click="handleUnbind">
        解绑
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { NButton, NInput, NSpace } from "naive-ui";

type SyncState = Awaited<ReturnType<typeof window.electronAPI.getSyncState>>;

const emptyState: SyncState = {
  token: "",
  syncCode: "",
  deviceId: "",
  spaceId: "",
  lastServerVersion: 0,
  lastSyncAt: "",
  lastError: "",
};

const state = ref<SyncState>({ ...emptyState });
const joinCode = ref("");
const loading = ref(false);
let stopSyncListener: (() => void) | null = null;

const statusText = computed(() => {
  if (!state.value.token) return "未开启";
  if (state.value.lastError) return `同步异常：${state.value.lastError}`;
  if (!state.value.lastSyncAt) return "已绑定，尚未同步";
  return `上次同步：${formatTime(state.value.lastSyncAt)}`;
});

onMounted(async () => {
  state.value = await window.electronAPI.getSyncState();
  stopSyncListener = window.electronAPI.onSyncChanged?.((next) => {
    state.value = next;
  }) ?? null;
});

onUnmounted(() => {
  stopSyncListener?.();
});

async function handleCreate() {
  if (state.value.token) {
    window.$dialog.create({
      style: { borderRadius: "10px" },
      title: "重新生成同步码",
      type: "warning",
      content: "重新生成后会清空当前同步空间的云端数据，并让旧同步码和旧 token 失效。同步码 4 小时内只能重新生成一次。",
      positiveText: "重新生成",
      negativeText: "取消",
      onPositiveClick: () => {
        void createOrResetSyncCode();
      },
    });
    return;
  }
  await createOrResetSyncCode();
}

async function createOrResetSyncCode() {
  await runSyncAction(async () => {
    state.value = await window.electronAPI.createSyncSpace();
    await copySyncCode();
    window.$message.success("同步码已创建并复制");
  });
}

async function handleJoin() {
  const code = joinCode.value.trim();
  if (!code) {
    window.$message.warning("请输入同步码");
    return;
  }
  await runSyncAction(async () => {
    state.value = await window.electronAPI.joinSyncSpace(code);
    window.$message.success(state.value.lastError || "同步完成");
  });
}

async function handleSyncNow() {
  await runSyncAction(async () => {
    state.value = await window.electronAPI.syncNow();
    window.$message.success(state.value.lastError || "同步完成");
  });
}

async function handleUnbind() {
  await runSyncAction(async () => {
    state.value = await window.electronAPI.unbindSync();
    window.$message.success("已解绑同步设备");
  });
}

async function copySyncCode() {
  if (!state.value.syncCode) return;
  await navigator.clipboard?.writeText(state.value.syncCode);
}

async function runSyncAction(action: () => Promise<void>) {
  if (loading.value) return;
  loading.value = true;
  try {
    await action();
  } catch (error: any) {
    window.$message.error(error?.message || "同步操作失败");
  } finally {
    loading.value = false;
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
</script>

<style lang="scss" scoped>
.sync-setting {
  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 14px 20px;
    border-radius: 8px;

    &:hover {
      background: var(--color-setting-hover);
    }
  }

  .setting-info {
    min-width: 0;
  }

  .setting-title {
    color: var(--color-text-default);
    font-size: 15px;
    font-weight: 600;
  }

  .setting-desc {
    margin-top: 4px;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  .join-row {
    display: grid;
    grid-template-columns: minmax(180px, 260px) auto;
    gap: 10px;
    align-items: center;
  }
}
</style>
