<template>
  <SettingSection title="通用排版" description="调整歌词来源和在播放界面中的位置。">
    <LyricSettingRow title="逐字歌词" description="优先使用逐字时间信息，同时影响桌面和默认跟随的底栏歌词。">
      <n-switch :value="setting.useKRC" aria-label="逐字歌词"
        @update:value="value => lyric.updateSetting({ useKRC: value })" />
    </LyricSettingRow>
    <LyricSettingRow title="沉浸式播放" description="控制面板隐藏时，同时隐藏封面和歌曲信息。">
      <n-switch :value="setting.immersiveMode" aria-label="沉浸式播放"
        @update:value="value => lyric.updateSetting({ immersiveMode: value })" />
    </LyricSettingRow>
    <LyricSettingRow title="水平居中" description="让歌词文字在歌词区域内居中显示。">
      <n-switch :value="setting.pureLyricMode" aria-label="歌词水平居中"
        @update:value="value => lyric.updateSetting({ pureLyricMode: value })" />
    </LyricSettingRow>
    <LyricSettingRow title="当前行垂直位置" description="从歌词区域顶部计算，50% 为正中。" wide>
      <SettingAdjustment :value="Math.round(setting.alignPosition * 100)" label="当前行垂直位置"
        :min="ranges.alignPosition.min * 100" :max="ranges.alignPosition.max * 100"
        @update:value="value => lyric.updateSetting({ alignPosition: value / 100 })" />
    </LyricSettingRow>
    <LyricSettingRow v-if="setting.style !== 'amlyric'" title="悬停显示时间" description="鼠标移入歌词区域时，显示各行的播放时间。">
      <n-switch :value="setting.showTime" aria-label="悬停显示歌词时间"
        @update:value="value => lyric.updateSetting({ showTime: value })" />
    </LyricSettingRow>
    <n-collapse class="advanced-settings">
      <n-collapse-item title="进阶排版" name="alignment">
        <LyricSettingRow title="歌词对齐锚点" description="使用当前句的顶部、中心或底部，对齐到上面设定的位置。">
          <n-select :value="setting.alignAnchor" :options="anchorOptions"
            @update:value="value => lyric.updateSetting({ alignAnchor: value })" />
        </LyricSettingRow>
      </n-collapse-item>
    </n-collapse>
  </SettingSection>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { NCollapse, NCollapseItem, NSelect, NSwitch } from "naive-ui";
import { useLyricStore } from "@/store/lyricStore";
import { LYRIC_SETTING_RANGES as ranges } from "@/utils/lyricSettings";
import SettingSection from "../SettingSection.vue";
import SettingAdjustment from "../SettingAdjustment.vue";
import LyricSettingRow from "./LyricSettingRow.vue";

const lyric = useLyricStore();
const { setting } = storeToRefs(lyric);
const anchorOptions = [
  { label: "顶部", value: "top" }, { label: "中心", value: "center" }, { label: "底部", value: "bottom" },
];
</script>

<style scoped lang="scss">
.advanced-settings { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
</style>
