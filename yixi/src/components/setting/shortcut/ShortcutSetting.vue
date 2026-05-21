<template>
  <div class="shortcut-setting">
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
  </div>
</template>

<script setup lang="ts">
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
.shortcut-setting {
  width: 100%;
  padding-bottom: 18px;

  .setting-item,
  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 14px 20px;
    border-radius: 8px;

    &:hover {
      background: var(--color-setting-hover);
    }
  }

  .setting-info {
    min-width: 0;
  }

  .setting-title {
    color: var(--color-text-default);
    font-size: 15px;
    font-weight: 600;
  }

  .setting-desc {
    margin-top: 4px;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .shortcut-alert {
    margin: 8px 20px;
  }

  .shortcut-list {
    margin-top: 6px;
  }

  .shortcut-control {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-shrink: 0;
  }

  .shortcut-button {
    width: 180px;
    justify-content: center;
  }

  .setting-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
  }

  .setting-tip {
    color: var(--color-text-secondary);
    font-size: 12px;
  }
}
</style>
