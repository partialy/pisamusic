<template>
    <n-card class="login-card">
        <n-tabs default-value="login" animated type="card">
            <template #prefix>
                <n-image :src="logo" preview-disabled class="login-logo" />
                <span class="login-title">Pisa Music</span>
            </template>
            <n-tab-pane name="login" label="登录">
                <n-form :model="loginForm">
                    <n-form-item label="用户名">
                        <n-input round v-model:value="loginForm.username" placeholder="请输入用户名" />
                    </n-form-item>
                    <n-form-item label="密码">
                        <n-input round type="password" v-model:value="loginForm.password" show-password-toggle
                            placeholder="请输入密码" />
                    </n-form-item>
                    <n-form-item style="display: flex; justify-content: center; align-items: center">
                        <n-button :loading="loading" type="primary" class="login-btn" circle @click="login">
                            <template #icon>
                                <n-icon size="22" :component="ArrowForward" />
                            </template>
                        </n-button>
                    </n-form-item>
                </n-form>
            </n-tab-pane>
            <n-tab-pane name="register" label="注册">
                <n-form :model="regForm">
                    <n-form-item label="邮箱">
                        <n-input round v-model:value="regForm.email" placeholder="请输入邮箱" />
                    </n-form-item>
                    <n-form-item label="昵称">
                        <n-input round v-model:value="regForm.username" placeholder="请输入昵称" />
                    </n-form-item>
                    <n-form-item label="密码">
                        <n-input round v-model:value="regForm.password" type="password" show-password-toggle
                            placeholder="请输入密码" />
                    </n-form-item>
                    <n-form-item label="密码">
                        <n-input round v-model:value="regForm.confirmPass" type="password" show-password-toggle
                            placeholder="请再次输入密码" />
                    </n-form-item>
                    <n-form-item>
                        <n-checkbox v-model:checked="regForm.agree">我已阅读并同意<a href="#">用户协议</a></n-checkbox>
                        <n-checkbox v-model:checked="regForm.autoLogin">注册后登录</n-checkbox>
                    </n-form-item>
                    <n-form-item style="display: flex; justify-content: center; align-items: center">
                        <n-button :loading="loading" type="primary" :disabled="!regForm.agree" class="login-btn" circle @click="register">
                            <template #icon>
                                <n-icon size="22" :component="ArrowForward" />
                            </template>
                        </n-button>
                    </n-form-item>
                </n-form>
            </n-tab-pane>
        </n-tabs>

    </n-card>
</template>

<script setup lang="ts">
import { ArrowForward } from "@vicons/ionicons5";
import { reactive, ref } from "vue";
import { NCard, NTabs, NCheckbox } from "naive-ui";
import logo from "@/assets/logo-circle.png";
import { mainAPI } from "@/utils/api/mainAPI";
import { useUserStore } from "@/store";
const userStore = useUserStore();
const loginForm = reactive({
    username: "",
    password: "",
});

const regForm = reactive({
    email: "",
    username: "",
    password: "",
    confirmPass: "",
    agree: false,
    autoLogin: true
});

const loading = ref(false);
const login = async () => {
    loading.value = true
    const res = await mainAPI.login(window.$mainServer, { username: loginForm.username, password: loginForm.password })
    if (res.code == 200) {
        window.$message.success("登录成功");
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("userInfo", JSON.stringify(res.data));
        userStore.token = res.data.token;
        userStore.userInfo = res.data;
        userStore.isLogin = true;
        console.log(userStore);
        window.$modal.destroyAll();
    } else {
        window.$message.error("登录失败：" + res.msg);
    }
    console.log(res);
    loading.value = false
};

const register = async () => {
    loading.value = true
    const res = await mainAPI.register(window.$mainServer, { username: regForm.username, password: regForm.password, email: regForm.email })
    if (res.code == 200) {
        window.$message.success("注册成功");
        if (regForm.autoLogin) {
            loginForm.username = regForm.username;
            loginForm.password = regForm.password;
            login()
        }
    } else {
        window.$message.error("注册失败：" + res.msg);
    }
    loading.value = false
};

</script>

<style lang="scss" scoped>
.login-card {
    border-radius: 10px;
    background: linear-gradient(to top, #efefef, #fff);

    .login-logo {
        width: 40px;
        height: 40px;
        margin-right: 10px;
        vertical-align: middle;
        border-radius: 50%;
    }

    .login-title {
        font-size: 20px;
        font-weight: 600;
        background: linear-gradient(to right, rgb(174, 213, 255), rgb(200, 169, 231), rgb(196, 143, 248));
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        text-shadow: 0 0 1px rgba(255, 255, 255, 0.3);
    }

    .login-btn {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--color-primary);
    }
}
</style>
