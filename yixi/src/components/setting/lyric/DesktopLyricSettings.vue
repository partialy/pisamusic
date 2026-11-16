<template>
  <div class="settings-stack">
    <SettingSection title="桌面窗口" description="独立于主播放器显示，可拖动或锁定在桌面上。">
      <LyricSettingRow title="启用桌面歌词">
        <n-switch :value="visible" :loading="changingVisibility" aria-label="启用桌面歌词" @update:value="changeVisibility" />
      </LyricSettingRow>
      <LyricSettingRow title="锁定窗口" description="锁定后鼠标穿透；解锁后可以拖动窗口和使用控制栏。">
        <n-switch :value="form.locked" aria-label="锁定桌面歌词" @update:value="value => patchImmediately({ locked: value })" />
      </LyricSettingRow>
      <LyricSettingRow title="覆盖任务栏" description="允许将歌词窗口拖到任务栏区域。">
        <n-switch :value="form.overlayTaskbar" aria-label="桌面歌词覆盖任务栏" @update:value="value => patchImmediately({ overlayTaskbar: value })" />
      </LyricSettingRow>
      <LyricSettingRow title="窗口宽度" :description="`${boundsLimits.minWidth}–${boundsLimits.maxWidth}px。`">
        <n-input-number :value="form.bounds.width" :min="boundsLimits.minWidth" :max="boundsLimits.maxWidth" :step="10"
          @update:value="value => changeBounds('width', value)" />
      </LyricSettingRow>
      <LyricSettingRow title="窗口高度" :description="`${boundsLimits.minHeight}–${boundsLimits.maxHeight}px。`">
        <n-input-number :value="form.bounds.height" :min="boundsLimits.minHeight" :max="boundsLimits.maxHeight" :step="10"
          @update:value="value => changeBounds('height', value)" />
      </LyricSettingRow>
    </SettingSection>
    <SettingSection title="桌面歌词文字" description="与主播放器分别保存，可在悬浮窗中快捷调整字号。">
      <LyricSettingRow title="字体大小" description="范围 10–64px。">
        <n-input-number :value="form.fontSize" :min="10" :max="64"
          @update:value="value => queuePatch({ fontSize: value ?? defaults.fontSize })" />
      </LyricSettingRow>
      <LyricSettingRow title="字体系列" description="未安装的字体由系统自动回退。">
        <n-select :value="form.fontFamily" :options="fontOptions"
          @update:value="value => patchImmediately({ fontFamily: value })" />
      </LyricSettingRow>
      <LyricSettingRow title="字体粗细" description="范围 100–900，600 为默认字重。">
        <n-input-number :value="form.fontWeight" :min="100" :max="900" :step="100"
          @update:value="value => queuePatch({ fontWeight: value ?? defaults.fontWeight })" />
      </LyricSettingRow>
      <LyricSettingRow title="未播放颜色">
        <n-color-picker :value="form.textColor" :show-alpha="true" :modes="colorModes"
          @update:value="value => queuePatch({ textColor: value })" />
      </LyricSettingRow>
      <LyricSettingRow title="高亮颜色" description="逐字歌词已经唱过部分的颜色。">
        <n-color-picker :value="form.highlightColor" :show-alpha="true" :modes="colorModes"
          @update:value="value => queuePatch({ highlightColor: value })" />
      </LyricSettingRow>
      <LyricSettingRow title="自动描边" description="在复杂或浅色桌面背景上增强文字辨识度。">
        <n-switch :value="form.autoOutline" aria-label="桌面歌词自动描边" @update:value="value => patchImmediately({ autoOutline: value })" />
      </LyricSettingRow>
    </SettingSection>
    <SettingSection title="桌面歌词动效" description="逐字歌词开关与主播放器共用，可在主播放器分区调整。">
      <LyricSettingRow title="歌词动效" description="控制平滑滚动与换行过渡。">
        <n-switch :value="form.animationEnabled" aria-label="桌面歌词动效" @update:value="value => patchImmediately({ animationEnabled: value })" />
      </LyricSettingRow>
      <LyricSettingRow title="逐字放大" description="正在唱的字轻微放大，仅有逐字时间信息时生效。">
        <n-switch :value="form.wordScaleEnabled" aria-label="桌面歌词逐字放大" @update:value="value => patchImmediately({ wordScaleEnabled: value })" />
      </LyricSettingRow>
    </SettingSection>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { NColorPicker, NInputNumber, NSelect, NSwitch, useMessage } from "naive-ui";
import { useDesktopLyricStore } from "@/store/desktopLyric";
import { DESKTOP_LYRIC_BOUNDS_LIMITS as boundsLimits, getDefaultDesktopLyricSetting, normalizeDesktopLyricSetting } from "@/desktopLyric/desktopLyricDefaults";
import type { DesktopLyricSettingPatch } from "@/types/desktopLyric";
import SettingSection from "../SettingSection.vue";
import LyricSettingRow from "./LyricSettingRow.vue";
import { getLyricFontOptions } from "./lyricSettingOptions";

const desktop = useDesktopLyricStore();
const { setting, visible } = storeToRefs(desktop);
const defaults = getDefaultDesktopLyricSetting();
const form = ref(getDefaultDesktopLyricSetting());
const changingVisibility = ref(false);
const message = useMessage();
const colorModes: Array<"hex" | "rgb" | "hsl"> = ["hex", "rgb", "hsl"];
const fontOptions = computed(() => getLyricFontOptions(form.value.fontFamily, true));
let pendingPatch: DesktopLyricSettingPatch = {};
let saveTimer: ReturnType<typeof setTimeout> | undefined;

watch(setting, value => {
  // 本地草稿只覆盖尚未发送的字段，其他字段始终跟随 main 的权威状态。
  form.value = normalizeDesktopLyricSetting({ ...value, ...pendingPatch, bounds: { ...value.bounds, ...pendingPatch.bounds } });
}, { immediate: true });

function updateForm(patch: DesktopLyricSettingPatch) {
  form.value = normalizeDesktopLyricSetting({ ...form.value, ...patch, bounds: { ...form.value.bounds, ...patch.bounds } });
}

function sendPatch(patch: DesktopLyricSettingPatch) {
  void desktop.patchSetting(patch).catch(() => message.error("保存桌面歌词设置失败，请重试"));
}

function flushPatch() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  if (Object.keys(pendingPatch).length === 0) return;
  const patch = pendingPatch;
  pendingPatch = {};
  sendPatch(patch);
}

function queuePatch(patch: DesktopLyricSettingPatch) {
  updateForm(patch);
  pendingPatch = { ...pendingPatch, ...patch, ...(patch.bounds ? { bounds: { ...pendingPatch.bounds, ...patch.bounds } } : {}) };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushPatch, 300);
}

function patchImmediately(patch: DesktopLyricSettingPatch) {
  flushPatch();
  updateForm(patch);
  sendPatch(patch);
}

function changeBounds(dimension: "width" | "height", value: number | null) {
  queuePatch({ bounds: { [dimension]: value ?? defaults.bounds[dimension] } });
}

async function changeVisibility(enabled: boolean) {
  if (changingVisibility.value) return;
  changingVisibility.value = true;
  flushPatch();
  try { await (enabled ? desktop.open() : desktop.close()); }
  catch { message.error("切换桌面歌词失败，请重试"); }
  finally { changingVisibility.value = false; }
}

onBeforeUnmount(flushPatch);
</script>

<style scoped lang="scss">
@use "../settingLayout.scss";
</style>
