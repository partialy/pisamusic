<template>
  <div class="settings-stack shortcut-setting">
    <SettingSection title="快捷键开关" description="控制应用内与系统全局快捷键。">
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">开启快捷键</div>
        <div class="setting-desc">关闭后，App 内与全局快捷键都不会触发。</div>
      </div>
      <n-switch
        :value="shortcutStore.setting.enabled"
        @update:value="shortcutStore.updateEnabled" />
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">全局可用</div>
        <div class="setting-desc">开启后，PisaMusic 在后台时也可以响应快捷键。</div>
      </div>
      <n-switch
        :value="shortcutStore.setting.global"
        :disabled="!shortcutStore.setting.enabled"
        @update:value="shortcutStore.updateGlobal" />
    </div>

    </SettingSection>
    <SettingSection title="快捷键绑定" description="点击快捷键后按下新组合键，Esc 取消录入。">
    <n-alert
      v-if="shortcutStore.setting.enabled && shortcutStore.setting.global && shortcutStore.failedRegistrationResults.length"
      type="warning"
      :bordered="false"
      class="shortcut-alert">
      部分快捷键注册失败，可能已被系统或其他应用占用。
    </n-alert>

    <div class="shortcut-list">
      <div
        v-for="item in shortcutActions"
        :key="item.action"
        class="shortcut-row">
        <div class="setting-info">
          <div class="setting-title">{{ item.label }}</div>
          <div class="setting-desc">{{ item.description }}</div>
        </div>
        <div class="shortcut-control">
          <n-tag
            v-if="failedResultMap.has(item.action)"
            type="warning"
            size="small"
            :bordered="false">
            {{ failedResultMap.get(item.action)?.reason || "注册失败" }}
          </n-tag>
          <n-button
            secondary
            class="shortcut-button"
            :type="recordingAction === item.action ? 'primary' : 'default'"
            @click="startRecording(item.action)">
            {{ recordingAction === item.action ? "按下快捷键..." : shortcutStore.setting.bindings[item.action] }}
          </n-button>
        </div>
      </div>
    </div>

    <div class="setting-actions">
      <n-button secondary @click="shortcutStore.resetDefaults">
        恢复默认
      </n-button>
      <span class="setting-tip">点击快捷键后按下新组合键，Esc 取消录入。</span>
    </div>
    </SettingSection>
  </div>
</template>

<script setup lang="ts">
import SettingSection from "../SettingSection.vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { NAlert, NButton, NSwitch, NTag } from "naive-ui";
import {
  formatShortcutFromKeyboardEvent,
  SHORTCUT_ACTIONS,
  useShortcutStore,
} from "@/store/shortcut";
import type { ShortcutAction } from "@/types/shortcut";

const shortcutStore = useShortcutStore();
const shortcutActions = SHORTCUT_ACTIONS;
const recordingAction = ref<ShortcutAction | null>(null);

const failedResultMap = computed(() => {
  return new Map(
    shortcutStore.failedRegistrationResults.map((item) => [item.action, item])
  );
});

onMounted(() => {
  void shortcutStore.init();
});

onBeforeUnmount(() => {
  stopRecording();
});

function startRecording(action: ShortcutAction) {
  stopRecording();
  recordingAction.value = action;
  window.addEventListener("keydown", handleRecordingKeydown, true);
}

function stopRecording() {
  window.removeEventListener("keydown", handleRecordingKeydown, true);
  recordingAction.value = null;
}

async function handleRecordingKeydown(event: KeyboardEvent) {
  if (!recordingAction.value) return;
  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    stopRecording();
    return;
  }

  const accelerator = formatShortcutFromKeyboardEvent(event);
  if (!accelerator) {
    window.$message?.warning("请至少按下一个修饰键和一个普通按键");
    return;
  }

  const saved = await shortcutStore.updateBinding(recordingAction.value, accelerator);
  if (saved) stopRecording();
}
</script>

<style lang="scss" scoped>
@use "../settingLayout.scss";
.shortcut-alert { margin-bottom: 12px; }
.shortcut-control { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.shortcut-button { min-width: 180px; justify-content: center; }
.setting-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 12px 14px; }
.setting-tip { color: var(--text-secondary); font-size: 12px; }
</style>
