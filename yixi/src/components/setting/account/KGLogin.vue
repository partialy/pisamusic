<template>
  <div>
    <n-tabs v-model:value="activeName" type="segment" @update:value="handleTabChange">
      <n-tab-pane name="username-pass" tab="验证码登录">
        <n-form :model="loginParam">
          <n-form-item label="手机号" required>
            <n-input v-model:value="loginParam.username" placeholder="请输入手机号" />
          </n-form-item>
          <n-form-item label="验证码" required>
            <n-input-otp
              v-model:value="loginParam.code"
              :disabled="loginParam.username.length !== 11"
              @finish="login" />
            <n-button
              style="margin-left: auto"
              tertiary
              :disabled="countDown > 0 || loginParam.username.length !== 11"
              @click="startCountDown">
              获取验证码<span v-if="countDown > 0">({{ countDown }})</span>
            </n-button>
          </n-form-item>
          <n-form-item style="display: flex; justify-content: center">
            <n-button
              type="primary"
              style="width: 200px; border-radius: 8px; background-color: var(--color-primary)"
              :disabled="!loginParam.username || !loginParam.code.length"
              @click="login">
              登录
            </n-button>
          </n-form-item>
        </n-form>
      </n-tab-pane>

      <n-tab-pane name="code" tab="扫码登录">
        <n-form>
          <n-form-item style="display: flex; justify-content: center">
            <n-image
              :src="qrImg"
              alt="image"
              style="width: 200px; height: 200px; padding: 3px; border: 1px solid #ccc"
              :style="{ borderRadius: scaned ? '50%' : '0' }" />
          </n-form-item>
          <n-form-item>
            <div class="qr-status">
              <div style="text-align: center; font-size: 18px">{{ tips }}</div>
              <div v-if="codeExpire" class="codeExpire">
                <div>二维码已过期</div>
                <n-button type="warning" @click="handleTabChange('code')">
                  <template #icon>
                    <n-icon :component="RefreshOutline" />
                  </template>
                  重新获取
                </n-button>
              </div>
            </div>
          </n-form-item>
        </n-form>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputOtp,
  NTabPane,
  NTabs,
} from "naive-ui";
import { RefreshOutline } from "@vicons/ionicons5";
import directAPI from "@/utils/api/directAPI";

const activeName = ref("username-pass");
const loginParam = ref({
  username: "",
  code: [] as string[],
});

const qrImg = ref("");
const tips = ref("等待扫码...");
const scaned = ref(false);
const codeExpire = ref(false);
const countDown = ref(0);
let qrTimer: ReturnType<typeof setInterval> | null = null;

async function sendCode() {
  const res = await directAPI.kg?.sendCode({
    mobile: loginParam.value.username,
  });
  if (res?.data && res.data.count > 0) {
    window.$message.success("发送成功");
  }
}

function startCountDown() {
  void sendCode();
  countDown.value = 60;
  const timer = setInterval(() => {
    countDown.value -= 1;
    if (countDown.value <= 0) clearInterval(timer);
  }, 1000);
}

async function login() {
  const res = await directAPI?.kg?.loginCellphone({
    mobile: loginParam.value.username,
    code: loginParam.value.code.join(""),
  });
  if (res?.data) {
    localStorage.setItem("kg-token", res.data.token);
    localStorage.setItem("kg-user-info", JSON.stringify(res.data));
    localStorage.setItem("kg-username", res.data.username);
  } else {
    window.$notification.error({
      title: "登录失败",
      content: JSON.stringify(res),
      duration: 3000,
      closable: true,
    });
  }
}

async function handleTabChange(name: string) {
  if (name !== "code" || !directAPI.kg) {
    clearQrTimer();
    return;
  }

  qrImg.value = "";
  tips.value = "等待扫码...";
  codeExpire.value = false;
  scaned.value = false;

  const qrk = await directAPI.kg.qrCodeKey();
  qrImg.value = qrk.data.qrcode_img;

  let count = 0;
  qrTimer = setInterval(async () => {
    const qr = await directAPI.kg?.qrCodeCheck(qrk.data.qrcode);
    count += 1;
    if (count > 60) clearQrTimer();

    switch (Number(qr?.data.status)) {
      case 0:
        tips.value = "二维码已过期";
        codeExpire.value = true;
        scaned.value = false;
        clearQrTimer();
        break;
      case 2:
        tips.value = qr?.data.nickname || tips.value;
        qrImg.value = qr?.data.pic || qrImg.value;
        scaned.value = true;
        break;
      case 4:
        tips.value = "登录成功";
        if (qr?.data.token && qr?.data.userid) {
          await handleUserInfo({
            token: qr.data.token,
            userid: qr.data.userid,
          });
        }
        clearQrTimer();
        break;
    }
  }, 1000);
}

async function handleUserInfo(param: { token: string; userid: number }) {
  const res = await directAPI?.kg?.loginRefresh(param);
  if (res?.data) {
    localStorage.setItem("kg-token", res.data.token);
    localStorage.setItem("kg-user-info", JSON.stringify(res.data));
  } else {
    window.$notification.error({
      title: "登录失败",
      content: JSON.stringify(res),
      duration: 3000,
      closable: true,
    });
  }
}

function clearQrTimer() {
  if (qrTimer) {
    clearInterval(qrTimer);
    qrTimer = null;
  }
}

onUnmounted(clearQrTimer);
</script>

<style scoped>
.qr-status {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.codeExpire {
  position: absolute;
  top: -233px;
  left: 91px;
  width: 203px;
  height: 203px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: white;
  font-size: 18px;
  font-weight: 600;
  background-color: #00000083;
}
</style>
