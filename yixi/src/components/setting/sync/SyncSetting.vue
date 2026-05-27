<template>
  <div class="sync-setting">
    <div class="account-panel">
      <div class="account-main">
        <n-avatar :src="userInfo.avatar || avatarImg" round :size="48" />
        <div class="account-text">
          <div class="account-name">{{ isLogin ? userInfo.username : "未登录账号" }}</div>
          <div class="account-desc">{{ accountDesc }}</div>
        </div>
      </div>
      <n-space>
        <n-button v-if="!isLogin" type="primary" round @click="openLogin">登录 / 注册</n-button>
        <n-button v-else secondary round :loading="loading" @click="handleSyncNow">立即同步</n-button>
        <n-button v-if="isLogin" secondary round type="error" :loading="logoutLoading" @click="handleLogout">
          退出登录
        </n-button>
      </n-space>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">同步状态</div>
        <div class="setting-desc">{{ statusText }}</div>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">最近同步</div>
        <div class="setting-desc">{{ lastSyncText }}</div>
      </div>
    </div>

    <div v-if="state.lastError" class="setting-item error-item">
      <div class="setting-info">
        <div class="setting-title">同步错误</div>
        <div class="setting-desc">{{ state.lastError }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref } from "vue";
import { NAvatar, NButton, NSpace } from "naive-ui";
import { storeToRefs } from "pinia";
import { LoginCard } from "@/components";
import { useUserStore } from "@/store";
import avatarImg from "@/assets/defaultAdminAvatar.jpg";

type SyncState = Awaited<ReturnType<typeof window.electronAPI.getSyncState>>;

const emptyState: SyncState = {
  token: "",
  deviceId: "",
  spaceId: "",
  seededUserId: "",
  lastServerVersion: 0,
  lastSyncAt: "",
  lastError: "",
};

const userStore = useUserStore();
const { isLogin, userInfo } = storeToRefs(userStore);
const state = ref<SyncState>({ ...emptyState });
const loading = ref(false);
const logoutLoading = ref(false);
let stopSyncListener: (() => void) | null = null;

const accountDesc = computed(() => {
  if (!isLogin.value) return "登录后自动同步收藏、歌单和本地创建的歌单";
  return userInfo.value.email || userInfo.value.id;
});

const statusText = computed(() => {
  if (!isLogin.value || !state.value.token) return "未开启，登录账号后可同步";
  if (state.value.lastError) return "同步异常";
  if (!state.value.lastSyncAt) return "已登录，尚未同步";
  return "同步正常";
});

const lastSyncText = computed(() => {
  if (!state.value.lastSyncAt) return "暂无记录";
  return formatTime(state.value.lastSyncAt);
});

onMounted(async () => {
  await refreshState();
  stopSyncListener = window.electronAPI.onSyncChanged?.((next) => {
    state.value = next;
  }) ?? null;
});

onUnmounted(() => {
  stopSyncListener?.();
});

function openLogin() {
  window.$modal.create({
    style: { borderRadius: "12px" },
    preset: "dialog",
    closable: true,
    content: () => h(LoginCard),
  });
}

async function handleSyncNow() {
  await runSyncAction(async () => {
    state.value = await window.electronAPI.syncNow();
    window.$message.success(state.value.lastError ? "同步完成，但存在错误" : "同步完成");
  });
}

async function handleLogout() {
  if (logoutLoading.value) return;
  logoutLoading.value = true;
  try {
    await userStore.logout();
    state.value = await window.electronAPI.getSyncState();
    window.$message.success("已退出登录");
  } catch (error) {
    window.$message.error(errorMessage(error, "退出登录失败"));
  } finally {
    logoutLoading.value = false;
  }
}

async function refreshState() {
  state.value = await window.electronAPI.getSyncState();
}

async function runSyncAction(action: () => Promise<void>) {
  if (loading.value) return;
  if (!isLogin.value) {
    openLogin();
    return;
  }
  loading.value = true;
  try {
    await action();
  } catch (error) {
    window.$message.error(errorMessage(error, "同步操作失败"));
  } finally {
    loading.value = false;
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
</script>

<style lang="scss" scoped>
.sync-setting {
  display: grid;
  gap: 12px;

  .account-panel,
  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 16px 20px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  }

  .setting-item {
    background: transparent;

    &:hover {
      background: var(--color-setting-hover);
    }
  }

  .account-main {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 14px;
  }

  .account-text,
  .setting-info {
    min-width: 0;
  }

  .account-name,
  .setting-title {
    color: var(--color-text-default);
    font-size: 15px;
    font-weight: 700;
  }

  .account-desc,
  .setting-desc {
    margin-top: 4px;
    color: var(--color-text-muted);
    font-size: 13px;
    line-height: 1.5;
    word-break: break-all;
  }

  .error-item {
    background: rgba(208, 48, 80, 0.08);
  }
}
</style>
