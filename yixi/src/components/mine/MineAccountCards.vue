<template>
  <section class="tw-grid tw-grid-cols-2 tw-gap-4 account-grid">
    <article
      v-for="item in accountItems"
      :key="item.source"
      class="account-card tw-rounded-2xl tw-border tw-bg-white/80 tw-p-5 tw-backdrop-blur-xl tw-transition-all tw-duration-300 tw-ease-out"
      :style="{ '--source-color': item.color }">
      <div class="tw-flex tw-items-start tw-justify-between tw-gap-4">
        <div class="tw-flex tw-min-w-0 tw-items-center tw-gap-4">
          <div class="avatar-wrap">
            <img class="account-avatar" :src="item.profile.avatar || defaultAvatar" alt="" />
            <span class="source-badge">
              <n-icon :component="item.icon" />
            </span>
          </div>
          <div class="tw-min-w-0">
            <div class="tw-flex tw-items-center tw-gap-2">
              <h2 class="account-title">{{ item.name }}</h2>
              <n-tag :bordered="false" round size="small" :color="item.tagColor">
                {{ item.profile.loggedIn ? (item.profile.isVip ? "VIP" : "已登录") : "未登录" }}
              </n-tag>
            </div>
            <p class="account-name text-line-1">{{ item.profile.nickname || "等待登录" }}</p>
            <p class="account-meta text-line-1">
              {{ item.profile.userId ? `用户 ID：${item.profile.userId}` : item.emptyText }}
            </p>
          </div>
        </div>
      </div>
      <div class="tw-mt-5 tw-flex tw-flex-wrap tw-gap-2">
        <n-button secondary round @click="openLogin(item.source)">
          <template #icon>
            <n-icon :component="LogIn" />
          </template>
          登录
        </n-button>
        <n-button
          type="primary"
          secondary
          round
          :loading="actionLoading[item.source]"
          @click="refreshAccount(item.source)">
          <template #icon>
            <n-icon :component="RefreshCw" />
          </template>
          刷新
        </n-button>
        <n-button
          type="error"
          secondary
          round
          :disabled="!item.profile.loggedIn"
          @click="logout(item.source)">
          <template #icon>
            <n-icon :component="LogOut" />
          </template>
          退出
        </n-button>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, h, reactive } from "vue";
import { LogIn, LogOut, RefreshCw } from "lucide-vue-next";
import { NButton, NIcon, NTag } from "naive-ui";
import KGLogin from "@/components/setting/account/KGLogin.vue";
import WYLogin from "@/components/setting/account/WYLogin.vue";
import { KGIcon, NeteaseIcon } from "@/icons";
import { renderIcon } from "@/utils/common";
import defaultAvatar from "@/assets/defaultAdminAvatar.jpg";
import { useCookieAccountStatus } from "@/composables/useCookieAccountStatus";
import {
  clearUserCookie,
  refreshCookieAccount,
  type CookieAccountProfile,
  type CookieSource,
} from "@/utils/api/cookieMusicAPI";

const {
  accounts,
  refreshCookieAccountStatus,
  setCookieAccountStatus,
  resetCookieAccountStatus,
} = useCookieAccountStatus();

const actionLoading = reactive<Record<CookieSource, boolean>>({
  kg: false,
  wy: false,
});

const accountMeta = {
  kg: {
    name: "酷狗音乐",
    color: "#0062ff",
    icon: KGIcon,
    emptyText: "登录后显示酷狗歌单、会员状态和云盘入口",
  },
  wy: {
    name: "网易云音乐",
    color: "#d71920",
    icon: NeteaseIcon,
    emptyText: "登录后显示网易云歌单、红心和每日推荐",
  },
};

const accountItems = computed(() =>
  (["kg", "wy"] as CookieSource[]).map((source) => {
    const meta = accountMeta[source];
    const profile = accounts[source];
    return {
      source,
      ...meta,
      profile,
      tagColor: {
        color: profile.loggedIn ? `${meta.color}18` : "rgba(120, 126, 138, 0.16)",
        textColor: profile.loggedIn ? meta.color : "#7d838c",
      },
    };
  })
);

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
          setCookieAccountStatus(profile);
          void refreshCookieAccountStatus(source);
          modal.destroy();
        },
      }),
    show: true,
    style: { borderRadius: "16px" },
    closeOnEsc: true,
  });
}

async function refreshAccount(source: CookieSource) {
  if (source === "wy") {
    openLogin("wy");
    return;
  }

  actionLoading[source] = true;
  try {
    const result = await refreshCookieAccount(source);
    if (!result.success) {
      window.$message.info(result.message || "酷狗账号暂未登录");
      return;
    }

    if (result.profile) setCookieAccountStatus(result.profile);
    await refreshCookieAccountStatus(source);
    window.$message.success(result.message || "酷狗 Cookie 刷新成功");
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : "账号 Cookie 刷新失败");
  } finally {
    actionLoading[source] = false;
  }
}

async function logout(source: CookieSource) {
  await clearUserCookie(source);
  resetCookieAccountStatus(source);
  window.$message.success(`${accountMeta[source].name} 登录 Cookie 已清除`);
}
</script>

<style scoped lang="scss">
.account-grid {
  min-width: 0;
}

.account-card {
  min-height: 188px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-color: color-mix(in srgb, var(--source-color) 22%, var(--color-border-default));
  background:
    radial-gradient(circle at 0 0, color-mix(in srgb, var(--source-color) 16%, transparent) 0, transparent 34%),
    var(--color-card-bg);
  box-shadow: 0 20px 42px -20px rgba(15, 23, 42, 0.26);

  &:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--source-color) 42%, var(--color-border-default));
    box-shadow: 0 26px 50px -24px rgba(15, 23, 42, 0.34);
  }
}

.avatar-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  flex: 0 0 auto;
}

.account-avatar {
  width: 72px;
  height: 72px;
  display: block;
  overflow: hidden;
  border: 3px solid color-mix(in srgb, var(--source-color) 18%, var(--color-bg-default));
  border-radius: 24px;
  background: var(--color-bg-secondary);
  object-fit: cover;
}

.source-badge {
  position: absolute;
  right: -7px;
  bottom: -7px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--source-color) 24%, var(--color-border-default));
  border-radius: 12px;
  background: color-mix(in srgb, var(--source-color) 10%, var(--color-bg-default));
  color: var(--source-color);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
  font-size: 17px;
}

.account-title {
  margin: 0;
  color: var(--color-text-default);
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 0;
}

.account-name {
  max-width: 310px;
  margin: 9px 0 0;
  color: var(--color-text-default);
  font-size: 15px;
  font-weight: 650;
}

.account-meta {
  max-width: 310px;
  margin: 5px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

</style>
