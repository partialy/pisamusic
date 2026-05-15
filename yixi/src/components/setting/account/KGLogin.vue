<template>
  <div class="kg-login">
    <n-tabs v-model:value="activeTab" type="segment" animated @update:value="handleTabChange">
      <n-tab-pane name="phone" tab="验证码登录">
        <n-form :model="phoneForm" label-placement="left" label-width="72">
          <n-form-item label="手机号" required>
            <n-input
              v-model:value="phoneForm.mobile"
              maxlength="11"
              placeholder="请输入酷狗绑定手机号" />
          </n-form-item>
          <n-form-item label="验证码" required>
            <div class="code-row">
              <n-input
                v-model:value="phoneForm.code"
                maxlength="8"
                placeholder="请输入验证码"
                @keyup.enter="submitPhoneLogin" />
              <n-button
                secondary
                :disabled="!canSendCode || countdown > 0"
                :loading="sendingCode"
                @click="sendCode">
                {{ countdown > 0 ? `${countdown}s` : "获取验证码" }}
              </n-button>
            </div>
          </n-form-item>
          <n-button
            block
            type="primary"
            :disabled="!canSubmitPhone"
            :loading="phoneLoading"
            @click="submitPhoneLogin">
            登录并保存 Cookie
          </n-button>
        </n-form>
      </n-tab-pane>

      <n-tab-pane name="qr" tab="扫码登录">
        <div class="qr-panel">
          <div class="qr-box" :class="{ confirming: qrStatus === 'confirming' }">
            <n-spin v-if="qrLoading" />
            <img v-else-if="qrImage" :src="qrImage" alt="酷狗登录二维码" />
            <div v-else class="qr-placeholder">二维码未加载</div>
            <div v-if="qrExpired" class="qr-mask">
              <span>二维码已过期</span>
              <n-button size="small" type="warning" @click="startQrLogin">重新获取</n-button>
            </div>
          </div>
          <div class="qr-meta">
            <img v-if="qrAvatar" :src="qrAvatar" alt="" />
            <strong>{{ qrTitle }}</strong>
            <span>{{ qrMessage }}</span>
          </div>
          <n-button secondary :loading="qrLoading" @click="startQrLogin">刷新二维码</n-button>
        </div>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from "vue";
import { NButton, NForm, NFormItem, NInput, NSpin, NTabPane, NTabs } from "naive-ui";
import {
  kgCheckQrLogin,
  kgLoginWithCode,
  kgSendCaptcha,
  kgStartQrLogin,
  type CookieAccountProfile,
} from "@/utils/api/cookieMusicAPI";

const emit = defineEmits<{
  (event: "loginSuccess", profile: CookieAccountProfile): void;
}>();

const activeTab = ref("phone");
const phoneForm = reactive({
  mobile: "",
  code: "",
});
const sendingCode = ref(false);
const phoneLoading = ref(false);
const countdown = ref(0);
const qrLoading = ref(false);
const qrImage = ref("");
const qrLoginId = ref("");
const qrStatus = ref<"waiting" | "confirming" | "expired" | "success" | "failed">("waiting");
const qrMessage = ref("打开酷狗音乐 App 扫码登录");
const qrAvatar = ref("");
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let qrTimer: ReturnType<typeof setInterval> | null = null;

const canSendCode = computed(() => /^1\d{10}$/.test(phoneForm.mobile));
const canSubmitPhone = computed(() => canSendCode.value && phoneForm.code.trim().length > 0);
const qrExpired = computed(() => qrStatus.value === "expired");
const qrTitle = computed(() => {
  if (qrStatus.value === "confirming") return "等待手机确认";
  if (qrStatus.value === "success") return "登录成功";
  if (qrStatus.value === "failed") return "登录失败";
  if (qrStatus.value === "expired") return "二维码已过期";
  return "扫码登录";
});

async function sendCode() {
  if (!canSendCode.value) {
    window.$message.warning("请输入正确的手机号");
    return;
  }
  sendingCode.value = true;
  try {
    await kgSendCaptcha(phoneForm.mobile);
    window.$message.success("验证码已发送");
    startCountdown();
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : "验证码发送失败");
  } finally {
    sendingCode.value = false;
  }
}

async function submitPhoneLogin() {
  if (!canSubmitPhone.value) return;
  phoneLoading.value = true;
  try {
    const profile = await kgLoginWithCode(phoneForm.mobile, phoneForm.code.trim());
    window.$message.success("酷狗登录 Cookie 已保存");
    emit("loginSuccess", profile);
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : "登录失败");
  } finally {
    phoneLoading.value = false;
  }
}

async function startQrLogin() {
  clearQrTimer();
  qrLoading.value = true;
  qrImage.value = "";
  qrAvatar.value = "";
  qrStatus.value = "waiting";
  qrMessage.value = "正在获取二维码...";
  try {
    const snapshot = await kgStartQrLogin();
    qrImage.value = snapshot.qrcodeImg;
    qrLoginId.value = snapshot.loginId;
    qrMessage.value = "打开酷狗音乐 App 扫码登录";
    qrTimer = setInterval(() => {
      void checkQrStatus();
    }, 3000);
  } catch (error) {
    qrStatus.value = "failed";
    qrMessage.value = error instanceof Error ? error.message : "二维码获取失败";
  } finally {
    qrLoading.value = false;
  }
}

async function checkQrStatus() {
  if (!qrLoginId.value) return;
  try {
    const result = await kgCheckQrLogin(qrLoginId.value);
    qrStatus.value = result.status;
    qrMessage.value = result.message || qrMessage.value;
    qrAvatar.value = result.avatar || qrAvatar.value;
    if (result.status === "expired" || result.status === "failed") {
      clearQrTimer();
    }
    if (result.status === "success" && result.saved) {
      clearQrTimer();
      window.$message.success("酷狗登录 Cookie 已保存");
      emit("loginSuccess", {
        source: "kg",
        loggedIn: true,
        userId: "",
        nickname: result.nickname || "",
        avatar: result.avatar || "",
        isVip: false,
        expiresAt: "",
      });
    }
  } catch (error) {
    qrStatus.value = "failed";
    qrMessage.value = error instanceof Error ? error.message : "扫码状态检查失败";
    clearQrTimer();
  }
}

function handleTabChange(value: string | number) {
  if (value === "qr") {
    void startQrLogin();
  } else {
    clearQrTimer();
  }
}

function startCountdown() {
  clearCountdownTimer();
  countdown.value = 60;
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) clearCountdownTimer();
  }, 1000);
}

function clearCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function clearQrTimer() {
  if (qrTimer) {
    clearInterval(qrTimer);
    qrTimer = null;
  }
}

onUnmounted(() => {
  clearCountdownTimer();
  clearQrTimer();
});
</script>

<style scoped lang="scss">
.kg-login {
  width: 420px;
  max-width: 100%;
}

.code-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.qr-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding-top: 4px;
}

.qr-box {
  position: relative;
  width: 220px;
  height: 220px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border-default);
  border-radius: 10px;
  background: var(--color-bg-secondary);

  &.confirming img {
    border-radius: 50%;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.qr-placeholder {
  color: var(--color-text-secondary);
}

.qr-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  background: rgba(0, 0, 0, 0.62);
  font-weight: 700;
}

.qr-meta {
  min-height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  color: var(--color-text-default);

  img {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    object-fit: cover;
  }

  span {
    color: var(--color-text-secondary);
    font-size: 13px;
  }
}
</style>
