<template>
  <div class="account-security-dialog">
    <div class="dialog-head">
      <h2>{{ title }}</h2>
      <p>{{ subtitle }}</p>
    </div>

    <n-form label-placement="top" :model="form" class="security-form">
      <n-form-item v-if="mode === 'reset-password'" label="账号邮箱">
        <n-input v-model:value="form.email" round placeholder="请输入注册邮箱" />
      </n-form-item>

      <n-form-item v-if="mode === 'change-email'" label="新邮箱">
        <n-input v-model:value="form.email" round placeholder="请输入新邮箱" />
      </n-form-item>

      <n-form-item v-if="needsCode" label="验证码">
        <div class="code-row">
          <n-input v-model:value="form.code" round placeholder="6 位验证码" />
          <n-button round secondary :disabled="countdown > 0" :loading="sending" @click="sendCode">
            {{ countdown > 0 ? `${countdown}s` : "发送" }}
          </n-button>
        </div>
      </n-form-item>

      <n-form-item v-if="mode === 'change-password'" label="当前密码">
        <n-input v-model:value="form.currentPassword" round type="password" show-password-toggle placeholder="请输入当前密码" />
      </n-form-item>

      <n-form-item v-if="mode !== 'change-email'" label="新密码">
        <n-input v-model:value="form.newPassword" round type="password" show-password-toggle placeholder="至少 6 位" />
      </n-form-item>

      <n-form-item v-if="mode !== 'change-email'" label="确认新密码">
        <n-input v-model:value="form.confirmPassword" round type="password" show-password-toggle placeholder="请再次输入新密码" />
      </n-form-item>
    </n-form>

    <div class="dialog-actions">
      <n-button round secondary @click="emit('done')">取消</n-button>
      <n-button round type="primary" :loading="submitting" @click="submit">{{ submitText }}</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { NButton, NForm, NFormItem, NInput } from "naive-ui";
import { useUserStore } from "@/store";

defineOptions({ name: "AccountSecurityDialog" });

type DialogMode = "change-password" | "reset-password" | "change-email";

const props = defineProps<{
  mode: DialogMode;
}>();

const emit = defineEmits<{
  (event: "done"): void;
}>();

const userStore = useUserStore();
const sending = ref(false);
const submitting = ref(false);
const countdown = ref(0);
let countdownTimer: number | null = null;

const form = reactive({
  email: "",
  code: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const needsCode = computed(() => props.mode === "reset-password" || props.mode === "change-email");
const title = computed(() => {
  if (props.mode === "change-password") return "修改密码";
  if (props.mode === "reset-password") return "重置密码";
  return "修改邮箱";
});
const subtitle = computed(() => {
  if (props.mode === "change-password") return "修改成功后会自动退出登录。";
  if (props.mode === "reset-password") return "验证码会发送到账号绑定邮箱。";
  return "新邮箱验证通过后会自动退出登录。";
});
const submitText = computed(() => {
  if (props.mode === "change-password") return "确认修改";
  if (props.mode === "reset-password") return "确认重置";
  return "确认换绑";
});

onBeforeUnmount(() => {
  if (countdownTimer !== null) window.clearInterval(countdownTimer);
});

async function sendCode() {
  const email = form.email.trim().toLowerCase();
  if (!assertEmail(email)) return;
  sending.value = true;
  try {
    if (props.mode === "change-email") {
      await window.electronAPI.sendProfileEmailCode({ email });
    } else {
      await window.electronAPI.sendAccountEmailCode({ email, purpose: "reset_password" });
    }
    startCountdown();
    window.$message.success("验证码已发送");
  } catch (error) {
    window.$message.error(errorMessage(error, "验证码发送失败"));
  } finally {
    sending.value = false;
  }
}

async function submit() {
  if (submitting.value) return;
  const error = validateSubmit();
  if (error) {
    window.$message.warning(error);
    return;
  }
  submitting.value = true;
  try {
    if (props.mode === "change-password") {
      await window.electronAPI.changeAccountPassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      window.$message.success("密码已修改，请重新登录");
    } else if (props.mode === "reset-password") {
      await window.electronAPI.resetAccountPassword({
        email: form.email.trim().toLowerCase(),
        code: form.code.trim(),
        newPassword: form.newPassword,
      });
      window.$message.success("密码已重置，请重新登录");
    } else {
      await userStore.updateProfile({
        email: form.email.trim().toLowerCase(),
        code: form.code.trim(),
      });
      window.$message.success("邮箱已修改，请重新登录");
    }
    await userStore.logout();
    emit("done");
  } catch (error) {
    window.$message.error(errorMessage(error, "操作失败"));
  } finally {
    submitting.value = false;
  }
}

function validateSubmit() {
  if (props.mode === "change-password" && !form.currentPassword) return "请输入当前密码";
  if (needsCode.value) {
    const email = form.email.trim().toLowerCase();
    if (!assertEmail(email, false)) return "请输入有效邮箱";
    if (!form.code.trim()) return "请输入验证码";
  }
  if (props.mode !== "change-email") {
    if (form.newPassword.length < 6) return "新密码至少 6 位";
    if (form.newPassword.length > 128) return "新密码过长";
    if (form.newPassword !== form.confirmPassword) return "两次输入的新密码不一致";
    if (props.mode === "change-password" && form.currentPassword === form.newPassword) return "新密码不能与当前密码相同";
  }
  return "";
}

function assertEmail(email: string, showMessage = true) {
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid && showMessage) window.$message.warning("请输入有效邮箱");
  return valid;
}

function startCountdown() {
  if (countdownTimer !== null) window.clearInterval(countdownTimer);
  countdown.value = 60;
  countdownTimer = window.setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0 && countdownTimer !== null) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
</script>

<style lang="scss" scoped>
.account-security-dialog {
  width: min(380px, calc(100vw - 96px));
  box-sizing: border-box;
  padding: 2px 4px 0;
}

.dialog-head {
  margin-bottom: 18px;

  h2 {
    margin: 0;
    color: var(--color-text-default);
    font-size: 22px;
    font-weight: 800;
  }

  p {
    margin: 6px 0 0;
    color: var(--color-text-muted);
    font-size: 13px;
  }
}

.security-form {
  :deep(.n-form-item) {
    margin-bottom: 14px;
  }

  :deep(.n-form-item-label) {
    padding-bottom: 8px;
    line-height: 1.2;
  }

  :deep(.n-input) {
    width: 100%;
  }
}

.code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px;
  align-items: center;
  gap: 10px;
  width: 100%;

  :deep(.n-button) {
    width: 92px;
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;

  :deep(.n-button) {
    min-width: 64px;
  }
}

:deep(.n-button--primary-type) {
  background: var(--color-primary);
}
</style>
