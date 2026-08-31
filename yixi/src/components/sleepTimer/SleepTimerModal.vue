<template>
  <n-modal
    :show="show"
    preset="card"
    class="sleep-timer-dialog"
    :mask-closable="true"
    @update:show="handleVisibleChange"
  >
    <template #header>
      <div class="modal-header-title">
        <n-icon :component="SleepTimerIcon" :size="20" class="header-icon" />
        <span>定时关闭</span>
      </div>
    </template>

    <div class="sleep-timer-content">
      <!-- 运行中状态卡片 -->
      <div v-if="sleepTimerStore.isActive" class="active-status-card">
        <div class="status-left">
          <div class="status-tag" :class="{ waiting: sleepTimerStore.isWaitingForSongEnd }">
            <span class="status-dot"></span>
            {{ sleepTimerStore.isWaitingForSongEnd ? "等待播完中" : "倒计时进行中" }}
          </div>
          <div class="remaining-time">
            {{ sleepTimerStore.formattedRemaining }}
          </div>
          <div class="status-desc">
            <template v-if="sleepTimerStore.isWaitingForSongEnd">
              倒计时已结束，将在当前歌曲播放完成后停止
            </template>
            <template v-else>
              设定时长 {{ formatDurationLabel(sleepTimerStore.durationMinutes) }}
              <span v-if="sleepTimerStore.waitCurrentSong" class="sub-tip">· 播完整首后停止</span>
            </template>
          </div>
        </div>
        <div class="status-right">
          <n-button size="small" type="error" ghost @click="handleCancelTimer">
            取消定时
          </n-button>
        </div>
      </div>

      <!-- 快捷时间区 -->
      <div class="section-container">
        <div class="section-title-row">
          <span class="section-title">快捷时间</span>
          <span class="section-count">{{ sleepTimerStore.customPresets.length }}/8</span>
        </div>

        <div class="preset-chips-container">
          <button
            v-for="mins in sleepTimerStore.customPresets"
            :key="mins"
            type="button"
            class="preset-chip"
            :class="{ active: selectedTotalMinutes === mins }"
            @click="selectPreset(mins)"
          >
            <span class="chip-label">{{ formatDurationLabel(mins) }}</span>
            <span
              v-if="sleepTimerStore.customPresets.length > 1"
              class="chip-delete"
              title="删除此快捷时间"
              @click.stop="handleRemovePreset(mins)"
            >
              &times;
            </span>
          </button>

          <!-- 添加快捷时间 -->
          <div v-if="sleepTimerStore.customPresets.length < 8" class="add-preset-wrapper">
            <n-popover
              v-model:show="showAddPopover"
              trigger="click"
              placement="bottom"
              :show-arrow="true"
            >
              <template #trigger>
                <button type="button" class="preset-chip add-chip">
                  <span class="plus-icon">+</span> 自定义快捷
                </button>
              </template>
              <div class="add-popover-content">
                <div class="popover-title">添加快捷时间 (分钟)</div>
                <div class="popover-form">
                  <n-input-number
                    v-model:value="newPresetMinutes"
                    :min="1"
                    :max="1439"
                    size="small"
                    placeholder="1 ~ 1439"
                    :show-button="false"
                  >
                    <template #suffix>分钟</template>
                  </n-input-number>
                  <n-button
                    size="small"
                    type="primary"
                    :disabled="!newPresetMinutes || newPresetMinutes < 1"
                    @click="handleAddPresetConfirm"
                  >
                    添加
                  </n-button>
                </div>
              </div>
            </n-popover>
          </div>
        </div>
      </div>

      <!-- 自定义时间区 -->
      <div class="section-container">
        <div class="section-title-row">
          <span class="section-title">自定义时间</span>
          <span class="section-tip">最大 23 小时 59 分钟</span>
        </div>

        <div class="custom-time-row">
          <div class="time-input-group">
            <n-input-number
              v-model:value="customHours"
              :min="0"
              :max="23"
              size="medium"
              class="time-input"
              @update:value="onCustomTimeChange"
            />
            <span class="time-unit">小时</span>
          </div>

          <span class="time-separator">:</span>

          <div class="time-input-group">
            <n-input-number
              v-model:value="customMinutes"
              :min="0"
              :max="59"
              size="medium"
              class="time-input"
              @update:value="onCustomTimeChange"
            />
            <span class="time-unit">分钟</span>
          </div>

          <div class="time-summary">
            合计：<strong>{{ formatDurationLabel(selectedTotalMinutes) }}</strong>
          </div>
        </div>
      </div>

      <!-- 播完整首再停止开关 -->
      <div class="switch-card">
        <div class="switch-info">
          <div class="switch-title">播完整首再停止</div>
          <div class="switch-desc">
            倒计时结束时，如果正在播放歌曲，将等待当前歌曲播放完成后再停止
          </div>
        </div>
        <n-switch v-model:value="waitSongOption" />
      </div>

      <!-- 底部操作按钮 -->
      <div class="dialog-actions">
        <n-button @click="handleClose">
          {{ sleepTimerStore.isActive ? "关闭" : "取消" }}
        </n-button>
        <n-button
          type="primary"
          :disabled="selectedTotalMinutes < 1"
          @click="handleApplyTimer"
        >
          {{ sleepTimerStore.isActive ? "更新定时" : "开始定时" }}
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NButton, NIcon, NInputNumber, NModal, NPopover, NSwitch } from "naive-ui";
import { SleepTimerIcon } from "@/icons";
import { useSleepTimerStore } from "@/store";

defineOptions({ name: "SleepTimerModal" });

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (event: "update:show", value: boolean): void;
}>();

const sleepTimerStore = useSleepTimerStore();

const customHours = ref(0);
const customMinutes = ref(30);
const selectedTotalMinutes = ref(30);
const waitSongOption = ref(false);

const showAddPopover = ref(false);
const newPresetMinutes = ref<number | null>(15);

// 打开弹窗时初始化表单值
watch(
  () => props.show,
  (visible) => {
    if (visible) {
      if (sleepTimerStore.isActive) {
        const total = sleepTimerStore.durationMinutes;
        selectedTotalMinutes.value = total;
        customHours.value = Math.floor(total / 60);
        customMinutes.value = total % 60;
        waitSongOption.value = sleepTimerStore.waitCurrentSong;
      } else {
        const defaultMins = sleepTimerStore.customPresets[1] || sleepTimerStore.customPresets[0] || 30;
        selectedTotalMinutes.value = defaultMins;
        customHours.value = Math.floor(defaultMins / 60);
        customMinutes.value = defaultMins % 60;
        waitSongOption.value = false;
      }
    }
  }
);

function handleVisibleChange(value: boolean) {
  emit("update:show", value);
}

function handleClose() {
  emit("update:show", false);
}

function selectPreset(minutes: number) {
  selectedTotalMinutes.value = minutes;
  customHours.value = Math.floor(minutes / 60);
  customMinutes.value = minutes % 60;
}

function onCustomTimeChange() {
  const h = Math.max(0, Math.min(23, Number(customHours.value) || 0));
  const m = Math.max(0, Math.min(59, Number(customMinutes.value) || 0));
  const total = h * 60 + m;
  selectedTotalMinutes.value = total;
}

function handleRemovePreset(mins: number) {
  sleepTimerStore.removeCustomPreset(mins);
}

function handleAddPresetConfirm() {
  if (!newPresetMinutes.value || newPresetMinutes.value < 1) return;
  const ok = sleepTimerStore.addCustomPreset(newPresetMinutes.value);
  if (ok) {
    selectPreset(newPresetMinutes.value);
    showAddPopover.value = false;
    newPresetMinutes.value = null;
  }
}

function handleApplyTimer() {
  if (selectedTotalMinutes.value < 1) {
    window.$message?.warning?.("请设置至少 1 分钟的定时时长");
    return;
  }
  sleepTimerStore.startTimer(selectedTotalMinutes.value, waitSongOption.value);
  emit("update:show", false);
}

function handleCancelTimer() {
  sleepTimerStore.cancelTimer(true);
  emit("update:show", false);
}

function formatDurationLabel(minutes: number): string {
  if (!minutes || minutes <= 0) return "0分钟";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}小时${m}分钟`;
  if (h > 0) return `${h}小时`;
  return `${m}分钟`;
}
</script>

<style scoped lang="scss">
.modal-header-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-default);

  .header-icon {
    color: var(--color-primary);
  }
}

.sleep-timer-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 运行中卡片 */
.active-status-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-secondary));
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, transparent);

  .status-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .status-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary);

    &.waiting {
      color: #f59e0b;

      .status-dot {
        background: #f59e0b;
      }
    }
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-primary);
    box-shadow: 0 0 8px currentColor;
    animation: pulse 1.6s infinite ease-in-out;
  }

  .remaining-time {
    font-size: 26px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-default);
    line-height: 1.1;
    letter-spacing: 0.5px;
  }

  .status-desc {
    font-size: 12px;
    color: var(--color-text-secondary);

    .sub-tip {
      color: var(--color-primary);
      margin-left: 2px;
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.8);
  }
}

/* 分区通用 */
.section-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text-default);
  }

  .section-count,
  .section-tip {
    font-size: 12px;
    color: var(--color-text-third);
  }
}

/* 快捷药丸标签 */
.preset-chips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--color-text-default);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-default);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);

    .chip-delete {
      opacity: 1;
    }
  }

  &.active {
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-default));
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }

  .chip-label {
    line-height: 1;
  }

  .chip-delete {
    margin-left: 6px;
    font-size: 14px;
    line-height: 1;
    color: var(--color-text-third);
    opacity: 0.6;
    transition: opacity 0.2s, color 0.2s;

    &:hover {
      color: #ef4444;
      opacity: 1;
    }
  }
}

.add-chip {
  border-style: dashed;
  color: var(--color-text-secondary);

  .plus-icon {
    font-weight: 700;
    margin-right: 3px;
  }

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
}

.add-popover-content {
  padding: 4px 2px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 180px;

  .popover-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-default);
  }

  .popover-form {
    display: flex;
    gap: 6px;
  }
}

/* 自定义时间输入行 */
.custom-time-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-default);

  .time-input-group {
    display: flex;
    align-items: center;
    gap: 6px;

    .time-input {
      width: 80px;
    }

    .time-unit {
      font-size: 13px;
      color: var(--color-text-secondary);
    }
  }

  .time-separator {
    font-size: 16px;
    font-weight: 800;
    color: var(--color-text-third);
    margin-top: -2px;
  }

  .time-summary {
    margin-left: auto;
    font-size: 13px;
    color: var(--color-text-secondary);

    strong {
      color: var(--color-primary);
      font-weight: 700;
    }
  }
}

/* 播完整首再停止开关卡片 */
.switch-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-default);

  .switch-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-right: 12px;

    .switch-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-text-default);
    }

    .switch-desc {
      font-size: 12px;
      color: var(--color-text-third);
      line-height: 1.4;
    }
  }
}

/* 底部操作 */
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}
</style>

<style lang="scss">
.sleep-timer-dialog {
  width: min(500px, calc(100vw - 32px)) !important;
  border-radius: 14px !important;
}
</style>
