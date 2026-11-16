<template>
  <div class="lyric-settings-page">
    <n-tabs v-model:value="scene" type="segment" animated class="scene-tabs">
      <n-tab-pane name="player" tab="主播放器" />
      <n-tab-pane name="desktop" tab="桌面歌词" />
      <n-tab-pane name="playerbar" tab="底栏歌词" />
    </n-tabs>
    <MainPlayerSettings v-if="scene === 'player'" />
    <DesktopLyricSettings v-else-if="scene === 'desktop'" />
    <PlayerBarLyricSettings v-else />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NTabPane, NTabs } from "naive-ui";
import MainPlayerSettings from "./MainPlayerSettings.vue";
import DesktopLyricSettings from "./DesktopLyricSettings.vue";
import PlayerBarLyricSettings from "./PlayerBarLyricSettings.vue";

const scene = ref<"player" | "desktop" | "playerbar">("player");
</script>

<style scoped lang="scss">
.lyric-settings-page { display: grid; gap: 16px; min-width: 0; container-type: inline-size; }
.scene-tabs :deep(.n-tabs-pane-wrapper) { display: none; }
</style>
