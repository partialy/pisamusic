<template>
  <div class="settings-stack main-player-settings">
    <PlayerBackgroundSettings v-if="!section || section === 'background'" />
    <PlayerLyricLayoutSettings v-if="!section || section === 'layout'" />
    <PlayerLyricTextSettings v-if="!section || section === 'text'" />
  </div>
</template>

<script setup lang="ts">
import PlayerBackgroundSettings from "./PlayerBackgroundSettings.vue";
import PlayerLyricLayoutSettings from "./PlayerLyricLayoutSettings.vue";
import PlayerLyricTextSettings from "./PlayerLyricTextSettings.vue";
import type { PlayerSettingsSection } from "./lyricSettingOptions";

defineProps<{ section?: PlayerSettingsSection }>();
</script>

<style scoped lang="scss">
@use "../settingLayout.scss";
</style>
