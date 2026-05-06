<template>
  <div class="setting-con">
    <n-tabs :v-model:value="activeName" type="line" animated>
      <n-tab-pane name="basic" tab="基本设置">
        <BasicSetting></BasicSetting>
      </n-tab-pane>
      <n-tab-pane name="lyric" tab="歌词设置">
        <LyricSetting></LyricSetting>
      </n-tab-pane>
      <n-tab-pane name="account" tab="账号设置">
        <AllAccount></AllAccount>
      </n-tab-pane>
      <n-tab-pane name="advance" tab="高级设置">
        <AdvanceSetting></AdvanceSetting>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { LyricSetting, BasicSetting, AllAccount, AdvanceSetting } from "../components/setting";
import { ref } from "vue";
const activeName = ref("basic");
</script>

<style lang="scss" scoped>
.setting-con {
  width: 100%;
  height: 100%;
}
:deep(.n-tabs) {
  display: flex;
  flex-direction: column;
}
:deep(.n-tab-pane) {
  flex: 1;
}
</style>
