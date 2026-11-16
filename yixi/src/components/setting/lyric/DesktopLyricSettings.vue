<template>
  <div class="settings-stack">
    <!-- 第一块：启用桌面歌词、歌词样式、各样式专属手风琴 -->
    <SettingSection>
      <LyricSettingRow title="启用桌面歌词">
        <n-switch
          :value="visible"
          :loading="changingVisibility"
          aria-label="启用桌面歌词"
          @update:value="changeVisibility"
        />
      </LyricSettingRow>
      <LyricSettingRow title="歌词样式" :description="currentStyleMeta.description">
        <n-select
          :value="form.style"
          :options="styleSelectOptions"
          @update:value="changeStyle"
        />
      </LyricSettingRow>
      <n-collapse :key="form.style" class="style-parameters">
        <n-collapse-item :title="`${currentStyleMeta.label}参数`" :name="form.style">
          <DesktopLyricStyleParams
            :style-id="form.style"
            :styles="form.styles"
            @patch-style="patchStyleConfig"
            @reset-style="resetCurrentStyle"
          />
        </n-collapse-item>
      </n-collapse>
    </SettingSection>

    <!-- 第二块：通用设置 -->
    <SettingSection title="通用设置" description="所有歌词样式共用的窗口与文字基础设置。">
      <LyricSettingRow
        title="锁定窗口"
        description="锁定后鼠标穿透；解锁后可以拖动窗口和使用控制栏。"
      >
        <n-switch
          :value="form.locked"
          aria-label="锁定桌面歌词"
          @update:value="(value) => patchImmediately({ locked: value })"
        />
      </LyricSettingRow>
      <LyricSettingRow title="覆盖任务栏" description="允许将歌词窗口拖到任务栏区域。">
        <n-switch
          :value="form.overlayTaskbar"
          aria-label="桌面歌词覆盖任务栏"
          @update:value="(value) => patchImmediately({ overlayTaskbar: value })"
        />
      </LyricSettingRow>
      <LyricSettingRow
        title="尺寸"
        :description="`长 ${boundsLimits.minWidth}–${boundsLimits.maxWidth}px × 高 ${boundsLimits.minHeight}–${boundsLimits.maxHeight}px。`"
        wide
      >
        <div class="bounds-size-inputs">
          <n-input-number
            :value="form.bounds.width"
            :min="boundsLimits.minWidth"
            :max="boundsLimits.maxWidth"
            :step="10"
            aria-label="桌面歌词窗口长度"
            @update:value="(value) => changeBounds('width', value)"
          />
          <span class="bounds-size-sep" aria-hidden="true">×</span>
          <n-input-number
            :value="form.bounds.height"
            :min="boundsLimits.minHeight"
            :max="boundsLimits.maxHeight"
            :step="10"
            aria-label="桌面歌词窗口高度"
            @update:value="(value) => changeBounds('height', value)"
          />
        </div>
      </LyricSettingRow>
      <LyricSettingRow title="字体大小" description="范围 10–64px，可在悬浮窗中快捷微调。">
        <n-input-number
          :value="form.fontSize"
          :min="10"
          :max="64"
          @update:value="(value) => queuePatch({ fontSize: value ?? defaults.fontSize })"
        />
      </LyricSettingRow>
      <LyricSettingRow title="字体系列" description="未安装的字体由系统自动回退。">
        <n-select
          :value="form.fontFamily"
          :options="fontOptions"
          @update:value="(value) => patchImmediately({ fontFamily: value })"
        />
      </LyricSettingRow>
      <LyricSettingRow title="字体粗细" description="范围 100–900，600 为默认字重。">
        <n-input-number
          :value="form.fontWeight"
          :min="100"
          :max="900"
          :step="100"
          @update:value="(value) => queuePatch({ fontWeight: value ?? defaults.fontWeight })"
        />
      </LyricSettingRow>
      <LyricSettingRow title="自动描边" description="在复杂或浅色桌面背景上增强文字辨识度。">
        <n-switch
          :value="form.autoOutline"
          aria-label="桌面歌词自动描边"
          @update:value="(value) => patchImmediately({ autoOutline: value })"
        />
      </LyricSettingRow>
    </SettingSection>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { NCollapse, NCollapseItem, NInputNumber, NSelect, NSwitch, useMessage } from "naive-ui";
import { useDesktopLyricStore } from "@/store/desktopLyric";
import {
  DESKTOP_LYRIC_BOUNDS_LIMITS as boundsLimits,
  DESKTOP_LYRIC_STYLE_OPTIONS,
  getDefaultDesktopLyricSetting,
  getDefaultDesktopLyricStyleSettings,
  mergeDesktopLyricSetting,
} from "@/desktopLyric/desktopLyricDefaults";
import type {
  DesktopLyricSettingPatch,
  DesktopLyricStyleConfigMap,
  DesktopLyricStyleId,
} from "@/types/desktopLyric";
import SettingSection from "../SettingSection.vue";
import DesktopLyricStyleParams from "./DesktopLyricStyleParams.vue";
import LyricSettingRow from "./LyricSettingRow.vue";
import { getLyricFontOptions } from "./lyricSettingOptions";

const desktop = useDesktopLyricStore();
const { setting, visible } = storeToRefs(desktop);
const defaults = getDefaultDesktopLyricSetting();
const form = ref(getDefaultDesktopLyricSetting());
const changingVisibility = ref(false);
const message = useMessage();

const fontOptions = computed(() => getLyricFontOptions(form.value.fontFamily, true));
const styleSelectOptions = DESKTOP_LYRIC_STYLE_OPTIONS.map((item) => ({
  label: item.label,
  value: item.value,
}));
const currentStyleMeta = computed(
  () =>
    DESKTOP_LYRIC_STYLE_OPTIONS.find((item) => item.value === form.value.style) ??
    DESKTOP_LYRIC_STYLE_OPTIONS[0],
);

let pendingPatch: DesktopLyricSettingPatch = {};
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function mergePatch(
  base: DesktopLyricSettingPatch,
  incoming: DesktopLyricSettingPatch,
): DesktopLyricSettingPatch {
  const mergedStyles: DesktopLyricSettingPatch["styles"] =
    base.styles || incoming.styles ? { ...(base.styles ?? {}) } : undefined;
  if (mergedStyles && incoming.styles) {
    for (const [key, val] of Object.entries(incoming.styles)) {
      const styleKey = key as DesktopLyricStyleId;
      mergedStyles[styleKey] = {
        ...(mergedStyles[styleKey] ?? {}),
        ...(val ?? {}),
      } as never;
    }
  }
  return {
    ...base,
    ...incoming,
    ...(base.bounds || incoming.bounds
      ? { bounds: { ...(base.bounds ?? {}), ...(incoming.bounds ?? {}) } }
      : {}),
    ...(mergedStyles ? { styles: mergedStyles } : {}),
  };
}

watch(
  setting,
  (value) => {
    // 本地草稿只覆盖尚未发送的字段，其他字段始终跟随 main 的权威状态。
    form.value = mergeDesktopLyricSetting(value, pendingPatch);
  },
  { immediate: true },
);

function updateForm(patch: DesktopLyricSettingPatch) {
  form.value = mergeDesktopLyricSetting(form.value, patch);
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
  pendingPatch = mergePatch(pendingPatch, patch);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushPatch, 300);
}

function patchImmediately(patch: DesktopLyricSettingPatch) {
  flushPatch();
  updateForm(patch);
  sendPatch(patch);
}

function changeStyle(style: DesktopLyricStyleId) {
  if (style === form.value.style) return;
  patchImmediately({ style });
}

function patchStyleConfig(
  styleId: DesktopLyricStyleId,
  patch: Partial<DesktopLyricStyleConfigMap[DesktopLyricStyleId]>,
  immediate: boolean,
) {
  const fullPatch: DesktopLyricSettingPatch = { styles: { [styleId]: patch } };
  if (immediate) {
    patchImmediately(fullPatch);
  } else {
    queuePatch(fullPatch);
  }
}

function resetCurrentStyle(styleId: DesktopLyricStyleId) {
  const defaultStyle = getDefaultDesktopLyricStyleSettings()[styleId];
  patchImmediately({ styles: { [styleId]: defaultStyle } });
  message.success(`已恢复「${currentStyleMeta.value.label}」默认参数`);
}

function changeBounds(dimension: "width" | "height", value: number | null) {
  queuePatch({ bounds: { [dimension]: value ?? defaults.bounds[dimension] } });
}

async function changeVisibility(enabled: boolean) {
  if (changingVisibility.value) return;
  changingVisibility.value = true;
  flushPatch();
  try {
    await (enabled ? desktop.open() : desktop.close());
  } catch {
    message.error("切换桌面歌词失败，请重试");
  } finally {
    changingVisibility.value = false;
  }
}

onBeforeUnmount(flushPatch);
</script>

<style scoped lang="scss">
@use "../settingLayout.scss";

.style-parameters {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.bounds-size-inputs {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

.bounds-size-inputs :deep(.n-input-number) {
  width: 124px;
  max-width: 100%;
}

.bounds-size-sep {
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
}
</style>
