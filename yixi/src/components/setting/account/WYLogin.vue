<template>
  <div>
    <n-tabs
      v-model:value="activeName"
      type="segment"
      @update:value="handleTabChange">
      <n-tab-pane name="cellphone" tab="验证码登录">
        <n-form v-model="loginForm">
          <n-form-item label="手机号" required>
            <n-select
              style="width: 160px"
              v-model:value="loginForm.ctcode"
              :options="countryCodes"
              value-field="key"
              label-field="label" />
            <n-input
              v-model:value="loginForm.phone"
              placeholder="请输入手机号"></n-input>
          </n-form-item>
          <n-form-item label="验证码" required>
            <n-input-otp :disabled="loginForm.phone.length != 11" v-model:value="loginForm.captcha" @finish="codeLogin" />

            <n-button :disabled="loginForm.phone.length != 11 || countDown > 0"
              style="margin-left: auto"
              tertiary
              @click="startCountDown"
              >获取验证码<span v-if="countDown > 0">({{ countDown }})</span></n-button
            >
          </n-form-item>
          <n-form-item style="display: flex; justify-content: center">
            <n-button :disabled="!loginForm.phone || !loginForm.captcha.length"
              type="primary"
              @click="codeLogin"
              style="width: 200px; border-radius: 8px; background-color: var(--color-primary)"
              >登录</n-button
            >
          </n-form-item>
        </n-form>
      </n-tab-pane>
      <n-tab-pane name="code" tab="扫码登录">
        <n-form>
          <n-form-item style="display: flex; justify-content: center">
            <n-image
              :src="qrImg"
              alt="image"
              style="
                width: 200px;
                height: 200px;
                padding: 3px;
                border: 1px solid #ccc;
              "
              :style="{ borderRadius: scaned ? '50%' : '0' }" />
          </n-form-item>
          <n-form-item>
            <div
              style="
                display: flex;
                justify-content: center;
                align-items: center;
                position: relative;
                width: 100%;
              ">
              <div style="text-align: center; font-size: 18px">{{ tips }}</div>
              <div class="codeExpire" v-if="codeExpire">
                <div>二维码已过期</div>
                <n-button type="warning" @click="startLogin">
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
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { NTabs, NTabPane, NForm, NFormItem, NButton,NInputOtp } from "naive-ui";
import directAPI from "@/utils/api/directAPI";
import { RefreshOutline } from "@vicons/ionicons5";
const activeName = ref("cellphone");

const loginForm = ref({
  ctcode: 86,
  phone: "",
  captcha: [],
});

const sendCode = async () => {
  const res = await directAPI.wy?.captchaSent({
    phone: loginForm.value.phone,
    // @ts-ignore
    realIP: "116.25.146.177",
  });
  if (res?.code == 200) {
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

const codeLogin = async () => {
  const cres = await directAPI.wy?.captchaVerify({
    phone: loginForm.value.phone,
    captcha: loginForm.value.captcha.join(""),
    // @ts-ignore
    realIP: "116.25.146.177",
  });
  if (cres?.code == 200) {
    const res = await directAPI.wy?.loginCellphone({
      phone: loginForm.value.phone,
      captcha: loginForm.value.captcha.join(""),
      // @ts-ignore
      realIP: "116.25.146.177",
    });
    if (res?.loginType == 1) {
      window.$message.success(res.message);
    }
  } else {
    window.$message.error("验证码错误");
  }
};

const qrImg = ref("");
const tips = ref("等待扫码...");
const scaned = ref(false);
const codeExpire = ref(false);
let t: any;
const startLogin = async () => {
  if (directAPI.wy) {
    qrImg.value = "";
    tips.value = "等待扫码...";
    codeExpire.value = false;
    const qrk = await directAPI.wy.loginQrKey();
    const qrc = await directAPI.wy.loginQrCreate({
      key: qrk.data.unikey,
      qrimg: true,
      // @ts-ignore
      realIP: "116.25.146.177",
    });
    qrImg.value = qrc.data.qrimg;

    // 800过期 801等待 802待确认 803成功（有cookie）
    let i = 0;
    t = setInterval(async () => {
      const qr = await directAPI.wy?.loginQrCheck({
        key: qrk.data.unikey,
        // @ts-ignore
        realIP: "116.25.146.177",
      });
      if (i > 60) {
        clearInterval(t);
      }
      i++;
      switch (qr?.code) {
        case 800:
          tips.value = "二维码已过期";
          codeExpire.value = true;
          clearInterval(t);
          scaned.value = false;
          break;
        case 801:
          tips.value = qr?.message || tips.value;
          break;
        case 802:
          //   tips.value = qr?.nickname || tips.value;
          //   qrImg.value = qr?.data.pic || qrImg.value;
          console.log(qr, "ok");
          scaned.value = true;
          break;
        case 803:
          tips.value = "登录成功！";
          localStorage.setItem("wy-cookie", qr.cookie);
          console.log(qr, "login");
          clearInterval(t);
          break;
      }
    }, 1000);
  } else {
    if (t) clearInterval(t);
  }
};

const handleTabChange = (name: string) => {
  if (name == "code") startLogin();
  else {
    if (t) clearInterval(t);
  }
};

onMounted(() => {
  if (activeName.value == "code") startLogin();
});

onUnmounted(() => {
  if (t) clearInterval(t);
});

const countryCodes = [
  { key: 86, label: "中国(+86)", nameEn: "China" },
  { key: 1, label: "美国(+1)", nameEn: "United States" },
  { key: 44, label: "英国(+44)", nameEn: "United Kingdom" },
  { key: 81, label: "日本(+81)", nameEn: "Japan" },
  { key: 82, label: "韩国(+82)", nameEn: "South Korea" },
  { key: 33, label: "法国(+33)", nameEn: "France" },
  { key: 49, label: "德国(+49)", nameEn: "Germany" },
  { key: 7, label: "俄罗斯(+7)", nameEn: "Russia" },
  { key: 91, label: "印度(+91)", nameEn: "India" },
  { key: 61, label: "澳大利亚(+61)", nameEn: "Australia" },
  { key: 65, label: "新加坡(+65)", nameEn: "Singapore" },
  { key: 60, label: "马来西亚(+60)", nameEn: "Malaysia" },
  { key: 63, label: "菲律宾(+63)", nameEn: "Philippines" },
  { key: 66, label: "泰国(+66)", nameEn: "Thailand" },
  { key: 84, label: "越南(+84)", nameEn: "Vietnam" },
  { key: 852, label: "香港(+852)", nameEn: "Hong Kong" },
  { key: 853, label: "澳门(+853)", nameEn: "Macau" },
  { key: 886, label: "台湾(+886)", nameEn: "Taiwan" },
  { key: 34, label: "西班牙(+34)", nameEn: "Spain" },
  { key: 39, label: "意大利(+39)", nameEn: "Italy" },
  { key: 55, label: "巴西(+55)", nameEn: "Brazil" },
  { key: 52, label: "墨西哥(+52)", nameEn: "Mexico" },
  { key: 971, label: "阿联酋(+971)", nameEn: "United Arab Emirates" },
  { key: 90, label: "土耳其(+90)", nameEn: "Turkey" },
  { key: 31, label: "荷兰(+31)", nameEn: "Netherlands" },
  { key: 41, label: "瑞士(+41)", nameEn: "Switzerland" },
  { key: 46, label: "瑞典(+46)", nameEn: "Sweden" },
  { key: 358, label: "芬兰(+358)", nameEn: "Finland" },
  { key: 47, label: "挪威(+47)", nameEn: "Norway" },
  { key: 64, label: "新西兰(+64)", nameEn: "New Zealand" },
];
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
