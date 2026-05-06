<template>
    <div class="setting-con">
        <div class="setting-item" @click="changeDarkMode">
            <div>深色模式</div>
            <n-switch v-model:value="darkMode" v-on:update-value="changeDarkMode"/>
        </div>
        <div class="setting-item" @click="changeLocalServer">
            <div>使用本地Server</div>
            <n-switch v-model:value="localServer" v-on:update-value="changeLocalServer" />
        </div>
        <div class="setting-item">
            <div @click="electronAPI.reloadWindow" style="color: red;">软件热重载</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NSwitch } from 'naive-ui';
import electronAPI from '@/utils/electron';
const darkMode = ref(false)
const changeDarkMode = () => {
    darkMode.value = !darkMode.value
    localStorage.setItem('pisa-theme',darkMode.value == true ? 'dark' : 'light')
}

const localServer = ref(false)
const changeLocalServer = () => {
    localServer.value = !localServer.value
    localStorage.setItem('pisa-local-server',localServer.value == true ? 'true' : 'false')
}

onMounted(() => {
    darkMode.value = localStorage.getItem('pisa-theme') == 'dark'
    localServer.value = localStorage.getItem('pisa-local-server') == 'true'
})
</script>

<style lang="scss" scoped>
.setting-con {
    .setting-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 20px;
        

        &:hover {
            background: #f5f5f5;
            cursor: pointer;
            border-radius: 8px;
        }
    }
}
</style>