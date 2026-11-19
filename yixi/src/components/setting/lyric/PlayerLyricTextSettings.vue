<template>
  <SettingSection title="通用文字" description="七种歌词样式共用的字体和基础显示设置。">
    <LyricSettingRow title="字体大小" description="范围 12–60px。">
      <n-input-number :value="setting.lyricFontSize" v-bind="ranges.fontSize"
        @update:value="value => lyric.updateSetting({ lyricFontSize: value ?? defaults.lyricFontSize })" />
    </LyricSettingRow>
    <LyricSettingRow title="字体系列" description="未安装的字体由系统自动回退。">
      <n-select :value="setting.lyricFont" :options="fontOptions"
        @update:value="value => lyric.updateSetting({ lyricFont: value })" />
    </LyricSettingRow>
    <LyricSettingRow title="字体加粗">
      <n-switch :value="setting.lyricFontWeight" aria-label="歌词字体加粗"
        @update:value="value => lyric.updateSetting({ lyricFontWeight: value })" />
    </LyricSettingRow>
    <LyricSettingRow title="文字阴影" description="控制基础文字阴影；各样式自身的光晕由专属参数控制。">
      <n-switch :value="setting.lyricFontShadow" aria-label="歌词文字阴影"
        @update:value="value => lyric.updateSetting({ lyricFontShadow: value })" />
    </LyricSettingRow>
    <LyricSettingRow title="文字不透明度" description="调整整体歌词文字，同时保留当前行与其他行的明暗层次。" wide>
      <SettingAdjustment :value="Math.round(setting.lyricFontOpacity * 100)" label="歌词文字不透明度"
        :min="ranges.opacity.min * 100" :max="ranges.opacity.max * 100"
        @update:value="value => lyric.updateSetting({ lyricFontOpacity: value / 100 })" />
    </LyricSettingRow>
    <LyricSettingRow title="渲染帧率" description="控制默认及 Canvas 特效歌词的帧率（AMLyric 除外）；无限制将跑满显示器刷新率。">
      <n-select :value="setting.fps" :options="fpsOptions"
        @update:value="value => lyric.updateSetting({ fps: value })" />
    </LyricSettingRow>
  </SettingSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { NInputNumber, NSelect, NSwitch } from "naive-ui";
import { useLyricStore } from "@/store/lyricStore";
import { LYRIC_FPS_OPTIONS } from "@/utils/frameRateLimiter";
import { getDefaultLyricSetting, LYRIC_SETTING_RANGES as ranges } from "@/utils/lyricSettings";
import SettingSection from "../SettingSection.vue";
import SettingAdjustment from "../SettingAdjustment.vue";
import LyricSettingRow from "./LyricSettingRow.vue";
import { getLyricFontOptions } from "./lyricSettingOptions";

const lyric = useLyricStore();
const { setting } = storeToRefs(lyric);
const defaults = getDefaultLyricSetting();
const fontOptions = computed(() => getLyricFontOptions(setting.value.lyricFont));
const fpsOptions = LYRIC_FPS_OPTIONS;
</script>
