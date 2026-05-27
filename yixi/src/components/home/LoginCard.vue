<template>
  <n-card class="login-card" :bordered="false">
    <div class="login-head">
      <n-image :src="logo" preview-disabled class="login-logo" />
      <div>
        <div class="login-title">PisaMusic</div>
        <div class="login-subtitle">账号同步收藏与歌单</div>
      </div>
    </div>

    <n-tabs v-model:value="mode" animated type="segment" class="login-tabs">
      <n-tab-pane name="password" tab="密码登录">
        <n-form :model="passwordForm" @submit.prevent="loginByPassword">
          <n-form-item label="用户名 / 邮箱">
            <n-input v-model:value="passwordForm.identifier" round placeholder="请输入用户名或邮箱" />
          </n-form-item>
          <n-form-item label="密码">
            <n-input
              v-model:value="passwordForm.password"
              round
              type="password"
              show-password-toggle
              placeholder="请输入密码" />
          </n-form-item>
          <n-button block round type="primary" :loading="loading" @click="loginByPassword">
            登录
          </n-button>
        </n-form>
      </n-tab-pane>

      <n-tab-pane name="code" tab="验证码登录">
        <n-form :model="codeForm" @submit.prevent="loginByCode">
          <n-form-item label="邮箱">
            <n-input v-model:value="codeForm.email" round placeholder="请输入邮箱" />
          </n-form-item>
          <n-form-item label="验证码">
            <div class="code-row">
              <n-input v-model:value="codeForm.code" round placeholder="6 位验证码" />
              <n-button round secondary :disabled="codeCountdown > 0" :loading="codeSending === 'login'" @click="sendCode('login')">
                {{ codeCountdown > 0 ? `${codeCountdown}s` : "发送" }}
              </n-button>
            </div>
          </n-form-item>
          <n-button block round type="primary" :loading="loading" @click="loginByCode">
            登录
          </n-button>
        </n-form>
      </n-tab-pane>

      <n-tab-pane name="register" tab="注册">
        <n-form :model="registerForm" @submit.prevent="register">
          <n-form-item label="邮箱">
            <n-input v-model:value="registerForm.email" round placeholder="请输入邮箱" />
          </n-form-item>
          <n-form-item label="用户名">
            <n-input v-model:value="registerForm.username" round placeholder="请输入用户名" />
          </n-form-item>
          <n-form-item label="密码">
            <n-input
              v-model:value="registerForm.password"
              round
              type="password"
              show-password-toggle
              placeholder="至少 6 位" />
          </n-form-item>
          <n-form-item label="确认密码">
            <n-input
              v-model:value="registerForm.confirmPassword"
              round
              type="password"
              show-password-toggle
              placeholder="请再次输入密码" />
          </n-form-item>
          <n-form-item label="验证码">
            <div class="code-row">
              <n-input v-model:value="registerForm.code" round placeholder="6 位验证码" />
              <n-button round secondary :disabled="registerCountdown > 0" :loading="codeSending === 'register'" @click="sendCode('register')">
                {{ registerCountdown > 0 ? `${registerCountdown}s` : "发送" }}
              </n-button>
            </div>
          </n-form-item>
          <n-button block round type="primary" :loading="loading" @click="register">
            注册并登录
          </n-button>
        </n-form>
      </n-tab-pane>
    </n-tabs>
  </n-card>
</template>
<script setup lang="ts">
import { reactive, ref } from "vue";
import { NButton, NCard, NForm, NFormItem, NImage, NInput, NTabPane, NTabs } from "naive-ui";
import logo from "@/assets/pisamusic_icon_1024.png";
import { useUserStore } from "@/store";

type Purpose = "login" | "register";
type AccountSession = Awaited<ReturnType<typeof window.electronAPI.getAccountSession>>;

const userStore = useUserStore();
const mode = ref<"password" | "code" | "register">("password");
const loading = ref(false);
const codeSending = ref<Purpose | "">("");
const codeCountdown = ref(0);
const registerCountdown = ref(0);

const passwordForm = reactive({
  identifier: "",
  password: "",
});

const codeForm = reactive({
  email: "",
  code: "",
});

const registerForm = reactive({
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
  code: "",
});

async function sendCode(purpose: Purpose) {
  const email = purpose === "login" ? codeForm.email.trim() : registerForm.email.trim();
  if (!assertEmail(email)) return;
  codeSending.value = purpose;
  try {
    await window.electronAPI.sendAccountEmailCode({ email, purpose });
    startCountdown(purpose);
    window.$message.success("验证码已发送");
  } catch (error) {
    window.$message.error(errorMessage(error, "验证码发送失败"));
  } finally {
    codeSending.value = "";
  }
}

async function loginByPassword() {
  const identifier = passwordForm.identifier.trim();
  if (!identifier || !passwordForm.password) {
    window.$message.warning("请输入用户名/邮箱和密码");
    return;
  }
  await runAuth(() =>
    window.electronAPI.loginAccountByPassword({
      identifier,
      password: passwordForm.password,
    })
  );
}

async function loginByCode() {
  const email = codeForm.email.trim();
  if (!assertEmail(email)) return;
  if (!codeForm.code.trim()) {
    window.$message.warning("请输入验证码");
    return;
  }
  await runAuth(() =>
    window.electronAPI.loginAccountByCode({
      email,
      code: codeForm.code.trim(),
    })
  );
}

async function register() {
  const email = registerForm.email.trim();
  const username = registerForm.username.trim();
  if (!assertEmail(email)) return;
  if (!username || registerForm.password.length < 6) {
    window.$message.warning("请输入用户名和至少 6 位密码");
    return;
  }
  if (registerForm.password !== registerForm.confirmPassword) {
    window.$message.warning("两次输入的密码不一致");
    return;
  }
  if (!registerForm.code.trim()) {
    window.$message.warning("请输入验证码");
    return;
  }
  await runAuth(() =>
    window.electronAPI.registerAccount({
      email,
      username,
      password: registerForm.password,
      code: registerForm.code.trim(),
    })
  );
}

async function runAuth(request: () => Promise<AccountSession>) {
  if (loading.value) return;
  loading.value = true;
  try {
    const session = await request();
    userStore.setSession(session);
    window.$message.success("登录成功");
    window.$modal.destroyAll();
    void window.electronAPI.syncNow();
  } catch (error) {
    window.$message.error(errorMessage(error, "登录失败"));
  } finally {
    loading.value = false;
  }
}

function assertEmail(email: string) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return true;
  window.$message.warning("请输入有效邮箱");
  return false;
}

function startCountdown(purpose: Purpose) {
  const target = purpose === "login" ? codeCountdown : registerCountdown;
  target.value = 60;
  const timer = window.setInterval(() => {
    target.value -= 1;
    if (target.value <= 0) window.clearInterval(timer);
  }, 1000);
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
</script>

<style lang="scss" scoped>
.login-card {
  width: min(420px, calc(100vw - 48px));
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(244, 249, 255, 0.92)),
    var(--color-bg-default);
  box-shadow: 0 24px 70px rgba(20, 102, 180, 0.18);

  :deep(.n-card__content) {
    padding: 24px;
  }
}

.login-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.login-logo {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  box-shadow: 0 10px 26px rgba(40, 151, 255, 0.22);
}

.login-title {
  color: var(--color-text-default);
  font-size: 23px;
  font-weight: 800;
  line-height: 1.1;
}

.login-subtitle {
  margin-top: 5px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.login-tabs {
  :deep(.n-tabs-nav) {
    margin-bottom: 18px;
  }

  :deep(.n-tabs-tab) {
    min-height: 34px;
    border-radius: 999px;
  }
}

.code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px;
  gap: 10px;
  width: 100%;
}

:deep(.n-button--primary-type) {
  background: var(--color-primary);
}

html.dark .login-card,
:global(.dark) .login-card {
  background:
    linear-gradient(180deg, rgba(24, 32, 44, 0.98), rgba(13, 21, 31, 0.96)),
    var(--color-bg-default);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
}
</style>
