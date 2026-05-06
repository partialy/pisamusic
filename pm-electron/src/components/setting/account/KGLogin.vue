<template>
  <div>
    <n-tabs v-model:value="activeName" v-on:update-value="handleTabChange" type="segment">
      <n-tab-pane name="username-pass" tab="验证码登录">
        <n-form :model="loginParam">
          <n-form-item label="手机号" required>
            <n-input v-model:value="loginParam.username" placeholder="请输入手机号"></n-input>
          </n-form-item>
          <n-form-item label="验证码" required>
            <n-input-otp :disabled="loginParam.username.length != 11" v-model:value="loginParam.code" @finish="login" />
            <n-button style="margin-left: auto" tertiary @click="startCountDown"
              :disabled="countDown > 0 || loginParam.username.length != 11">获取验证码<span v-if="countDown > 0">({{
                countDown }})</span></n-button>
          </n-form-item>
          <n-form-item style="display: flex; justify-content: center">
            <n-button :disabled="!loginParam.username || !loginParam.code.length" type="primary" @click="login"
              style="width: 200px; border-radius: 8px; background-color: var(--color-primary)">登录</n-button>
          </n-form-item>
        </n-form>
      </n-tab-pane>
      <n-tab-pane name="code" tab="扫码登录">
        <n-form>
          <n-form-item style="display: flex; justify-content: center">
            <n-image :src="qrImg" alt="image" style="width: 200px; height: 200px; padding: 3px; border: 1px solid #ccc"
              :style="{ borderRadius: scaned ? '50%' : '0' }" />
          </n-form-item>
          <n-form-item>
            <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                position: relative;
                width: 100%;
              ">
              <div style="text-align: center;font-size:18px">{{ tips }}</div>
              <div class="codeExpire" v-if="codeExpire">
                <div>二维码已过期</div>
                <n-button type="warning" @click="handleTabChange('code')">
                  <template #icon>
                    <n-icon :component="RefreshOutline"></n-icon>
                  </template>
                  重新获取
                </n-button>
              </div>
            </div>
          </n-form-item>
        </n-form>
      </n-tab-pane>
      <n-tab-pane name="cookie" tab="cookie登录">
        <div style="height: 40px;">
          <span>当前状态：</span>
          <n-tag v-if="!cookieLogined.status" type="error">未登录</n-tag>
          <n-tag v-else type="success">已登录-{{ cookieLogined.username }}</n-tag>
        </div>
        <div style="display: flex;justify-content: center;">
          <n-button round type="primary" @click="handleCookieLogin">{{ cookieLogined.status ? '重新登录' : '开始登录' }}</n-button>
        </div>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import {
  NTabs,
  NTabPane,
  NForm,
  NFormItem,
  NInput,
  NInputOtp,
  NButton,
} from "naive-ui";
import directAPI from "@/utils/api/directAPI";
import { RefreshOutline } from "@vicons/ionicons5";
import electronAPI from "@/utils/electron";

type Cookie = {
  name: string;
  value: string;
};

const activeName = ref("username-pass");
const loginParam = ref({
  username: "",
  code: [],
});

const cookieLogined = ref({
  status: false,
  username: "",
  token: "",
  userid: "",
});

const handleCookieLogin = async () => { 
  electronAPI.openCookieWindow("kg")
};

const loadKGCookie = async () => { 
  const username = localStorage.getItem("kg-username");
  const r = await electronAPI.readCookie('kg')
  const res = JSON.parse(r) as Cookie[];
  if(res.length > 0) {
    cookieLogined.value.status = true;
    res.forEach(e => {
      if(e.name == "KugooID") {
        cookieLogined.value.username = e.value || username || ""
      }
      if(e.name == "token") {
        cookieLogined.value.token = e.value
      }
      if(e.name == "KugooID") {
        cookieLogined.value.userid = e.value
      }
    })
  }
};
const sendCode = async () => {
  const res = await directAPI.kg?.sendCode({
    mobile: loginParam.value.username,
  });
  if (res?.data && res.data.count > 0) {
    window.$message.success("发送成功");
  }
};
const countDown = ref(0);
const startCountDown = () => {
  sendCode();
  countDown.value = 60;
  const timer = setInterval(() => {
    countDown.value--;
    if (countDown.value <= 0) clearInterval(timer);
  }, 1000);
};
const login = async () => {
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
};

const qrImg = ref("");
const tips = ref("等待扫码...");
const scaned = ref(false);
const codeExpire = ref(false);
let t: any;
const handleTabChange = async (name: string) => {
  if (name == "code" && directAPI.kg) {
    qrImg.value = "";
    tips.value = "等待扫码...";
    codeExpire.value = false;
    const qrk = await directAPI.kg.qrCodeKey();
    qrImg.value = qrk.data.qrcode_img;

    // 0过期 1等待 2待确认 4成功（有token）
    let i = 0;
    t = setInterval(async () => {
      const qr = await directAPI.kg?.qrCodeCheck(qrk.data.qrcode);
      if (i > 60) {
        clearInterval(t);
      }
      i++;
      switch (qr?.data.status) {
        // @ts-ignore
        case 0:
          tips.value = "二维码已过期";
          codeExpire.value = true;
          clearInterval(t);
          scaned.value = false;
          break;
        case 1:
          break;
        case 2:
          tips.value = qr?.data.nickname || tips.value;
          qrImg.value = qr?.data.pic || qrImg.value;
          scaned.value = true;
          break;
        case 4:
          tips.value = "登录成功！";
          if (qr?.data.token && qr?.data.userid) {
            handleUserInfo({
              token: qr.data.token,
              userid: qr.data.userid,
            });
          }
          clearInterval(t);
          break;
      }
    }, 1000);
  } else {
    if (t) clearInterval(t);
    if(name == "cookie") {
      loadKGCookie()
    }
  }
};

const handleUserInfo = async (param: { token: string; userid: number }) => {
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
};

onUnmounted(() => {
  if (t) clearInterval(t);
  loadKGCookie();
});
</script>

<style scoped>
.codeExpire {
  width: 203px;
  height: 203px;
  position: absolute;
  background-color: #00000083;
  font-size: 18px;
  font-weight: 600;
  color: white;
  top: -233px;
  left: 91px;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
</style>
