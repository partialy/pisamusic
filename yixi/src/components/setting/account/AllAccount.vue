<template>
  <div class="account-con">
    <section
      v-for="item in info"
      :key="item.origin"
      class="account-card">
      <div class="account-main">
        <div class="account-avatar-wrap">
          <img
            class="account-avatar"
            :src="item.avatar || defaultAvatar"
            alt="" />
          <div
            class="source-mark"
            :style="{ color: item.color }">
            <n-icon :component="item.origin === 'kg' ? KGIcon : NeteaseIcon" />
          </div>
        </div>
        <div class="account-info">
          <div class="account-title-row">
            <div class="account-title">{{ sourceName(item.origin) }}账号</div>
            <n-tag
              size="tiny"
              round
              :bordered="false"
              :color="{ color: `${item.color}18`, textColor: item.color }">
              {{ item.isVip ? "VIP" : "普通" }}
            </n-tag>
          </div>
          <div class="account-name">{{ item.username || "未登录" }}</div>
          <div class="account-meta">到期时间：{{ item.time || "-" }}</div>
        </div>
      </div>

      <div class="btn-group">
        <NButton secondary round @click="login(item.origin)">
          <template #icon>
            <n-icon :component="LogInOutline" />
          </template>
          登录
        </NButton>
        <NButton type="primary" secondary round @click="handleGetInfo(item.origin)">
          <template #icon>
            <n-icon :component="Refresh" />
          </template>
          刷新
        </NButton>
        <NButton type="error" secondary round>
          <template #icon>
            <n-icon :component="LogOutOutline" />
          </template>
          退出
        </NButton>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { LogInOutline, Refresh, LogOutOutline } from "@vicons/ionicons5";
import { NButton, NIcon, NTag } from "naive-ui";
import { h, onMounted, ref } from "vue";
import KGLogin from "./KGLogin.vue";
import WYLogin from "./WYLogin.vue";
import type { KGLoginData } from "@/utils/webapi/types/KG/KGLoginResponse";
import type { WYUserAccountResponse } from "@/utils/webapi";
import { proxyAPI } from "@/utils/api/proxyAPI";
import { renderIcon } from "@/utils/common";
import { KGIcon, NeteaseIcon } from "@/icons";
import defaultAvatar from "@/assets/defaultAdminAvatar.jpg";

const info = ref({
  kg: {
    origin: "kg",
    avatar: "",
    color: "#0062FF",
    username: "username",
    time: "2023-05-05 12:00:00",
    isVip: false,
  },
  wy: {
    origin: "wy",
    avatar: "",
    color: "#FF0000",
    username: "username",
    time: "2023-05-05 12:00:00",
    isVip: false,
  },
});

const sourceName = (origin: string) => {
  return origin === "kg" ? "酷狗音乐" : "网易云音乐";
};

const login = async (origin: string) => {
  const c = origin == "kg" ? KGLogin : WYLogin;
  window.$modal.create({
    title: "登录",
    icon: origin == "kg" ? renderIcon(KGIcon) : renderIcon(NeteaseIcon, {}, { color: "red" }),
    preset: "dialog",
    closable: true,
    content: () => h(c),
    show: true,
    size: "large",
    style: { borderRadius: "10px" },
    closeOnEsc: true,
  });
};

const getKGInfo = async () => {
  const s = localStorage.getItem("kg-user-info");
  if (!s) {
    return;
  }
  const kgInfo = JSON.parse(s) as KGLoginData;
  info.value.kg.time = kgInfo?.vip_end_time.toString() || "-";
  info.value.kg.username = kgInfo?.nickname || "-";
  info.value.kg.isVip = kgInfo?.vip_type == 6 || false;
  info.value.kg.avatar = kgInfo?.pic || "";
};

const getWYInfo = async () => {
  const linfo = localStorage.getItem("wy-user-info");
  let wyInfo: WYUserAccountResponse | null | undefined = null;
  if (linfo) {
    wyInfo = JSON.parse(linfo) as WYUserAccountResponse;
  }
  if (!wyInfo) {
    wyInfo = await proxyAPI.wy?.userAccount();
    localStorage.setItem("wyuid", wyInfo?.profile.userId.toString() || "");
    localStorage.setItem("wy-user-info", JSON.stringify(wyInfo));
  }
  const userId = wyInfo?.profile.userId;
  if (userId) localStorage.setItem("wyuid", userId.toString());

  info.value.wy.time = new Date(wyInfo?.profile.viptypeVersion || 0).toDateString();
  info.value.wy.username = wyInfo?.profile.nickname || "-";
  info.value.wy.isVip = wyInfo?.account.vipType ? true : false;
  info.value.wy.avatar = wyInfo?.profile.avatarUrl || "";
};

const handleGetInfo = async (origin: string) => {
  if (origin == "kg") {
    getKGInfo();
  } else if (origin == "wy") {
    getWYInfo();
  }
};

onMounted(() => {
  getKGInfo();
  getWYInfo();
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
