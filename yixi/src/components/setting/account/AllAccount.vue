<template>
  <div class="account-con">
    <NCard v-for="item in info" :key="item.origin" class="account-card">
      <template #header>
        <div class="header">
          <div class="info">
            <n-image :src="item.avatar" style="width: 60px; height: 60px; border-radius: 50%" />
            <div>
              <div
                style="display: flex; align-items: center; gap: 5px; flex-direction: row"
              >
                <div class="name">{{ item.username }}</div>
                <n-tag
                  size="tiny"
                  :color="{ textColor: item.color, borderColor: item.color }"
                  >VIP</n-tag
                >
              </div>

              <div style="font-size: 14px">{{ item.time }}</div>
            </div>
          </div>
          <div class="btn-group">
            <NButton type="tertiary" @click="login(item.origin)">
              <template #icon>
                <n-icon :component="LogInOutline"></n-icon>
              </template>
              登录</NButton
            >
            <NButton type="info" @click="handleGetInfo(item.origin)">
              <template #icon>
                <n-icon :component="Refresh"></n-icon>
              </template>
              刷新</NButton
            >
            <NButton type="error">
              <template #icon>
                <n-icon :component="LogOutOutline"></n-icon>
              </template>
              退出</NButton
            >
          </div>
        </div>
      </template>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { LogInOutline, Refresh, LogOutOutline } from "@vicons/ionicons5";
import { NCard, NButton, NIcon, NTag } from "naive-ui";
import { h, onMounted, ref } from "vue";
import KGLogin from "./KGLogin.vue";
import WYLogin from "./WYLogin.vue";
import type { KGLoginData } from "@/utils/webapi/types/KG/KGLoginResponse";
import type { WYUserAccountResponse } from "@/utils/webapi";
import { proxyAPI } from "@/utils/api/proxyAPI";
import { renderIcon } from "@/utils/common";
import { KGIcon, NeteaseIcon } from "@/icons";

const info = ref({
  kg: {
    origin: "kg",
    avatar:"",
    color: "#0062FF",
    username: "username",
    time: "2023-05-05 12:00:00",
    isVip: false,
  },
  wy: {
    origin: "wy",
    avatar:"",
    color: "#FF0000",
    username: "username",
    time: "2023-05-05 12:00:00",
    isVip: false,
  }
});

const login = async (origin: string) => {
  const c = origin == "kg" ? KGLogin : WYLogin;
  window.$modal.create({
    title: "登录",
    icon: origin == 'kg' ? renderIcon(KGIcon) :renderIcon(NeteaseIcon, {}, { color: "red"}),
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
  if(linfo){
    wyInfo = JSON.parse(linfo) as WYUserAccountResponse;
  }
  if (!wyInfo) {
    wyInfo = await proxyAPI.wy?.userAccount();
    localStorage.setItem("wyuid", wyInfo?.profile.userId.toString() || "");
    localStorage.setItem("wy-user-info", JSON.stringify(wyInfo));
  }
  const userId = wyInfo?.profile.userId;
  console.log(wyInfo,userId,"wyInfo");
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
  gap: 1rem;

  .account-card {
    border-radius: 10px;
    background: transparent;
    backdrop-filter: blur(10px);
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.1);

    &:hover {
      background: #f9f9f9;
    }
  }
}
.header {
  display: flex;
  justify-content: space-between;

  .info {
    display: flex;
    align-items: center;
    flex-direction: row;
    gap: 1rem;
  }

  .btn-group {
    display: flex;
    align-items: center;
    gap: 10px;

    .n-button {
      border-radius: 5px;
    }
  }
}
</style>
