<template>
  <div class="wy-login">
    <div class="login-options">
      <n-button
        type="primary"
        size="large"
        :loading="pcLoading"
        @click="openLogin('pc')">
        打开 PC 网页登录
      </n-button>
      <n-button
        secondary
        size="large"
        :loading="mobileLoading"
        @click="openLogin('mobile')">
        手机网页备用
      </n-button>
    </div>
    <p class="hint">
      登录窗口检测到 MUSIC_U 后会自动保存 Cookie。若网页登录失败，可关闭窗口后使用备用入口。
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NButton } from "naive-ui";
import {
  getCookieAccountProfile,
  wyOpenLoginWindow,
  type CookieAccountProfile,
} from "@/utils/api/cookieMusicAPI";

const emit = defineEmits<{
  (event: "loginSuccess", profile: CookieAccountProfile): void;
}>();

const pcLoading = ref(false);
const mobileLoading = ref(false);

async function openLogin(mode: "pc" | "mobile") {
  const loading = mode === "pc" ? pcLoading : mobileLoading;
  loading.value = true;
  try {
    const result = await wyOpenLoginWindow(mode);
    if (!result.saved || !result.hasMusicU) {
      window.$message.warning("未检测到网易云登录 Cookie");
      return;
    }
    const profile = await getCookieAccountProfile("wy");
    window.$message.success("网易云登录 Cookie 已保存");
    emit("loginSuccess", profile);
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : "网页登录失败");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="scss">
.wy-login {
  width: 420px;
  max-width: 100%;
}

.login-options {
  display: grid;
  gap: 12px;
}

.hint {
  margin: 14px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.7;
}
</style>
