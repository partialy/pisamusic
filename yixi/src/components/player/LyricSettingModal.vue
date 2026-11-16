<template>
  <AppModal :show="show" title="播放页设置" :icon="Settings2" :width="720"
    @update:show="updateShow" @after-leave="activeSection = 'background'">
    <div class="lyric-settings">
      <n-tabs v-model:value="activeSection" type="segment" animated class="setting-tabs">
        <n-tab-pane v-for="section in PLAYER_SETTINGS_SECTIONS" :key="section.value" :name="section.value" :tab="section.label" />
      </n-tabs>
      <div class="settings-panels">
        <MainPlayerSettings :section="activeSection" />
      </div>
    </div>
  </AppModal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NTabPane, NTabs } from "naive-ui";
import { Settings2 } from "lucide-vue-next";
import AppModal from "@/components/common/AppModal.vue";
import MainPlayerSettings from "@/components/setting/lyric/MainPlayerSettings.vue";
import { PLAYER_SETTINGS_SECTIONS, type PlayerSettingsSection } from "@/components/setting/lyric/lyricSettingOptions";

withDefaults(defineProps<{ show?: boolean }>(), { show: false });
const emit = defineEmits<{ "update:show": [value: boolean]; close: [] }>();
const activeSection = ref<PlayerSettingsSection>("background");

function updateShow(value: boolean) {
  emit("update:show", value);
  if (!value) emit("close");
}
</script>

<style scoped lang="scss">
.lyric-settings { display: grid; gap: 16px; min-width: 0; }
.setting-tabs :deep(.n-tabs-pane-wrapper) { display: none; }
.settings-panels { height: min(460px, calc(100vh - 260px)); min-height: 100px; overflow-y: auto; padding-right: 4px; container-type: inline-size; }
</style>
