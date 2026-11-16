<template>
  <div class="settings-stack main-player-settings">
    <PlayerLyricStyleSettings v-if="!section || section === 'style'" />
    <PlayerLyricTextSettings v-if="!section || section === 'common'" />
    <PlayerLyricLayoutSettings v-if="!section || section === 'common'" />
    <PlayerBackgroundSettings v-if="!section || section === 'background'" />
  </div>
</template>

<script setup lang="ts">
import PlayerBackgroundSettings from "./PlayerBackgroundSettings.vue";
import PlayerLyricStyleSettings from "./PlayerLyricStyleSettings.vue";
import PlayerLyricLayoutSettings from "./PlayerLyricLayoutSettings.vue";
import PlayerLyricTextSettings from "./PlayerLyricTextSettings.vue";
import type { PlayerSettingsSection } from "./lyricSettingOptions";

defineProps<{ section?: PlayerSettingsSection }>();
</script>

<style scoped lang="scss">
@use "../settingLayout.scss";
</style>
