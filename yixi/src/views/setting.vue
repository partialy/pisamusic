<template>
  <div class="setting-con">
    <n-tabs v-model:value="activeName" type="line" animated>
      <n-tab-pane name="basic" tab="基本设置">
        <BasicSetting></BasicSetting>
      </n-tab-pane>
      <n-tab-pane name="local" tab="本地设置">
        <LocalSetting></LocalSetting>
      </n-tab-pane>
      <n-tab-pane name="lyric" tab="歌词设置">
        <LyricSetting></LyricSetting>
      </n-tab-pane>
      <n-tab-pane name="shortcut" tab="快捷键设置">
        <ShortcutSetting></ShortcutSetting>
      </n-tab-pane>
      <n-tab-pane name="advance" tab="高级设置">
        <AdvanceSetting></AdvanceSetting>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { LyricSetting, BasicSetting, AdvanceSetting, LocalSetting, ShortcutSetting } from "@/components/setting";
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
  overflow: auto;
  padding-right: 8px;
}
</style>
