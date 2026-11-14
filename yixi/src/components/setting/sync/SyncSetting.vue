<template>
  <div class="settings-stack sync-setting">
    <SettingSection title="同步账号" description="登录后自动同步收藏与歌单。">
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

    </SettingSection>
    <ImportUnassociatedLibrary :logged-in="isLogin" />
    <SettingSection title="同步状态" description="查看当前账号的同步结果。">
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">账号同步状态</div>
        <div class="setting-desc">{{ statusText }}</div>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">最近账号同步</div>
        <div class="setting-desc">{{ lastSyncText }}</div>
      </div>
    </div>

    <div v-if="state.lastError" class="setting-item error-item">
      <div class="setting-info">
        <div class="setting-title">账号同步错误</div>
        <div class="setting-desc">{{ state.lastError }}</div>
      </div>
    </div>
    </SettingSection>
  </div>
</template>

<script setup lang="ts">
import ImportUnassociatedLibrary from "./ImportUnassociatedLibrary.vue";
import SettingSection from "../SettingSection.vue";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { NAvatar, NButton, NSpace } from "naive-ui";
import { storeToRefs } from "pinia";
import { useAccountLoginDialog } from "@/composables/useAccountLoginDialog";
import { useUserStore } from "@/store";
import avatarImg from "@/assets/defaultAdminAvatar.jpg";

type SyncState = Awaited<ReturnType<typeof window.electronAPI.getSyncState>>;

const emptyState: SyncState = {
  identityRevision: 0,
  userId: "",
  seededAccountId: "",
  lastVersion: 0,
  lastSyncAt: "",
  lastError: "",
};

const userStore = useUserStore();
const { isLogin, userInfo } = storeToRefs(userStore);
const { openAccountLogin: openLogin } = useAccountLoginDialog();
const state = ref<SyncState>({ ...emptyState });
const loading = ref(false);
const logoutLoading = ref(false);
let stopIdentityListener: (() => void) | null = null;
let stopSyncListener: (() => void) | null = null;

const accountDesc = computed(() => {
  if (!isLogin.value) return "登录账号后自动同步收藏、歌单和本地创建的歌单";
  return userInfo.value.email || userInfo.value.id;
});

const statusText = computed(() => {
  if (!isLogin.value || !state.value.userId) return "未开启，登录账号后启用账号同步";
  if (state.value.lastError) return "账号同步异常";
  if (!state.value.lastSyncAt) return "已登录账号，尚未完成同步";
  return "账号同步正常";
});

const lastSyncText = computed(() => {
  if (!state.value.lastSyncAt) return "暂无记录";
  return formatTime(state.value.lastSyncAt);
});

onMounted(async () => {
  stopIdentityListener = window.electronAPI.onAccountIdentityChanged(revision => {
    state.value = { ...emptyState, identityRevision: revision };
    void refreshState();
  });
  await refreshState();
  stopSyncListener = window.electronAPI.onSyncChanged?.((next) => {
    applyState(next);
  }) ?? null;
});

onUnmounted(() => {
  stopSyncListener?.();
  stopIdentityListener?.();
});

async function handleSyncNow() {
  await runSyncAction(async () => {
    applyState(await window.electronAPI.syncNow());
    window.$message.success(state.value.lastError ? "账号同步完成，但存在错误" : "账号同步完成");
  });
}

async function handleLogout() {
  if (logoutLoading.value) return;
  logoutLoading.value = true;
  try {
    await userStore.logout();
    applyState(await window.electronAPI.getSyncState());
    window.$message.success("已退出登录");
  } catch (error) {
    window.$message.error(errorMessage(error, "退出登录失败"));
  } finally {
    logoutLoading.value = false;
  }
}

function applyState(next: SyncState) {
  if (next.identityRevision >= state.value.identityRevision) state.value = next;
}

async function refreshState() {
  applyState(await window.electronAPI.getSyncState());
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
    window.$message.error(errorMessage(error, "账号同步操作失败"));
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
@use "../settingLayout.scss";
.account-panel { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding: 12px 14px; }
.account-main { display: flex; align-items: center; gap: 14px; min-width: 0; }
.account-text { min-width: 0; }
.account-name { color: var(--text-primary); font-size: 14px; font-weight: 600; }
.account-desc { color: var(--text-secondary); margin-top: 4px; font-size: 12px; overflow-wrap: anywhere; }
.error-item .setting-desc { color: var(--text-primary); }
</style>
