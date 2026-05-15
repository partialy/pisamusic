<template>
  <div class="account-con">
    <section v-for="item in accounts" :key="item.source" class="account-card">
      <div class="account-main">
        <div class="account-avatar-wrap">
          <img class="account-avatar" :src="item.avatar || defaultAvatar" alt="" />
          <div class="source-mark" :style="{ color: item.color }">
            <n-icon :component="item.source === 'kg' ? KGIcon : NeteaseIcon" />
          </div>
        </div>
        <div class="account-info">
          <div class="account-title-row">
            <div class="account-title">{{ item.name }}</div>
            <n-tag
              size="tiny"
              round
              :bordered="false"
              :color="{ color: item.loggedIn ? `${item.color}18` : 'rgba(120, 126, 138, 0.16)', textColor: item.loggedIn ? item.color : '#7d838c' }">
              {{ item.loggedIn ? (item.isVip ? "VIP" : "已登录") : "未登录" }}
            </n-tag>
          </div>
          <div class="account-name">{{ item.nickname || "暂未登录" }}</div>
          <div class="account-meta">
            <span v-if="item.userId">用户 ID：{{ item.userId }}</span>
            <span v-else>登录后可获取账号资料与歌单</span>
          </div>
        </div>
      </div>

      <div class="btn-group">
        <n-button secondary round @click="openLogin(item.source)">
          <template #icon>
            <n-icon :component="LogInOutline" />
          </template>
          登录
        </n-button>
        <n-button type="primary" secondary round :loading="item.loading" @click="refreshAccount(item.source)">
          <template #icon>
            <n-icon :component="Refresh" />
          </template>
          刷新
        </n-button>
        <n-button type="error" secondary round :disabled="!item.loggedIn" @click="logout(item.source)">
          <template #icon>
            <n-icon :component="LogOutOutline" />
          </template>
          退出
        </n-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, reactive } from "vue";
import { LogInOutline, Refresh, LogOutOutline } from "@vicons/ionicons5";
import { NButton, NIcon, NTag } from "naive-ui";
import KGLogin from "./KGLogin.vue";
import WYLogin from "./WYLogin.vue";
import { KGIcon, NeteaseIcon } from "@/icons";
import { renderIcon } from "@/utils/common";
import defaultAvatar from "@/assets/defaultAdminAvatar.jpg";
import { useCookieAccountStatus } from "@/composables/useCookieAccountStatus";
import {
  clearUserCookie,
  getCookieAccountProfile,
  refreshCookieAccount,
  type CookieAccountProfile,
  type CookieSource,
} from "@/utils/api/cookieMusicAPI";

type AccountCard = {
  source: CookieSource;
  name: string;
  color: string;
  nickname: string;
  avatar: string;
  userId: string;
  isVip: boolean;
  loggedIn: boolean;
  loading: boolean;
};

const { setCookieAccountStatus } = useCookieAccountStatus();

const accounts = reactive<AccountCard[]>([
  {
    source: "kg",
    name: "KG状态",
    color: "#0062ff",
    nickname: "",
    avatar: "",
    userId: "",
    isVip: false,
    loggedIn: false,
    loading: false,
  },
  {
    source: "wy",
    name: "WY状态",
    color: "#d71920",
    nickname: "",
    avatar: "",
    userId: "",
    isVip: false,
    loggedIn: false,
    loading: false,
  },
]);

function openLogin(source: CookieSource) {
  const component = source === "kg" ? KGLogin : WYLogin;
  const icon = source === "kg" ? renderIcon(KGIcon) : renderIcon(NeteaseIcon, {}, { color: "#d71920" });
  const modal = window.$modal.create({
    title: source === "kg" ? "登录酷狗音乐" : "登录网易云音乐",
    icon,
    preset: "dialog",
    closable: true,
    content: () =>
      h(component, {
        onLoginSuccess: (profile: CookieAccountProfile) => {
          applyProfile(profile);
          void loadProfile(source);
          modal.destroy();
        },
      }),
    show: true,
    style: { borderRadius: "10px" },
    closeOnEsc: true,
  });
}

async function loadProfile(source: CookieSource) {
  const item = findAccount(source);
  item.loading = true;
  try {
    const profile = await getCookieAccountProfile(source);
    applyProfile(profile);
    if (!profile.loggedIn) {
      window.$message.info(`${item.name}暂未登录`);
    }
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : "账号信息刷新失败");
  } finally {
    item.loading = false;
  }
}

async function refreshAccount(source: CookieSource) {
  if (source === "wy") {
    openLogin("wy");
    return;
  }

  const item = findAccount(source);
  item.loading = true;
  try {
    const result = await refreshCookieAccount(source);
    if (result.success) {
      window.$message.success(result.message || "酷狗 Cookie 刷新成功");
      if (result.profile) applyProfile(result.profile);
      await loadProfile(source);
    } else {
      window.$message.info(result.message || `${item.name}暂未登录`);
    }
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : "账号 Cookie 刷新失败");
  } finally {
    item.loading = false;
  }
}

async function logout(source: CookieSource) {
  await clearUserCookie(source);
  applyProfile({
    source,
    loggedIn: false,
    userId: "",
    nickname: "",
    avatar: "",
    isVip: false,
    expiresAt: "",
  });
  window.$message.success("登录 Cookie 已清除");
}

function applyProfile(profile: CookieAccountProfile) {
  const item = findAccount(profile.source);
  item.loggedIn = profile.loggedIn;
  item.nickname = profile.nickname;
  item.avatar = profile.avatar;
  item.userId = profile.userId;
  item.isVip = profile.isVip;
  setCookieAccountStatus(profile);
}

function findAccount(source: CookieSource) {
  return accounts.find((item) => item.source === source) ?? accounts[0];
}

onMounted(() => {
  void loadProfile("kg");
  void loadProfile("wy");
});
</script>

<style lang="scss" scoped>
.account-con {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.account-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--color-border-default);
  border-radius: 14px;
  background: var(--color-card-bg);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background: var(--color-setting-hover);
    border-color: color-mix(in srgb, var(--color-primary) 28%, var(--color-border-default));
  }
}

.account-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
}

.account-avatar-wrap {
  position: relative;
  width: 62px;
  height: 62px;
  flex-shrink: 0;
}

.account-avatar {
  width: 62px;
  height: 62px;
  display: block;
  overflow: hidden;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  object-fit: cover;
}

.source-mark {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 2px solid var(--color-bg-default);
  border-radius: 50%;
  background: var(--color-card-bg);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
  font-size: 16px;
}

.account-info {
  min-width: 0;
}

.account-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-title {
  color: var(--color-text-default);
  font-size: 16px;
  font-weight: 700;
}

.account-name {
  margin-top: 5px;
  color: var(--color-text-default);
  font-size: 14px;
}

.account-meta {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.btn-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
</style>
