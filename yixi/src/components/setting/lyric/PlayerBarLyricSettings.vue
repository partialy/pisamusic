<template>
  <div class="settings-stack">
    <SettingSection title="底栏歌词显示" description="控制 PlayerBar 歌曲信息下方的歌词，不影响主播放器和桌面歌词。">
      <template #actions><n-button secondary size="small" @click="bar.resetSetting">恢复默认</n-button></template>
      <LyricSettingRow title="显示底栏歌词" description="关闭后始终显示歌手。">
        <n-switch :value="setting.enabled" aria-label="显示底栏歌词" @update:value="value => bar.updateSetting({ enabled: value })" />
      </LyricSettingRow>
      <LyricSettingRow title="暂停时保留歌词" description="关闭后暂停播放时显示歌手。">
        <n-switch :value="setting.showWhenPaused" aria-label="暂停时保留底栏歌词" @update:value="value => bar.updateSetting({ showWhenPaused: value })" />
      </LyricSettingRow>
      <LyricSettingRow title="歌词模式" description="没有逐行数据时，逐行模式会将逐字歌词按整句显示。">
        <n-select :value="setting.sourceMode" :options="sourceOptions" @update:value="value => bar.updateSetting({ sourceMode: value })" />
      </LyricSettingRow>
    </SettingSection>
    <SettingSection title="底栏歌词样式" description="字号限制在底栏单行高度内，长歌词自动省略。">
      <LyricSettingRow title="字体大小" description="范围 10–22px。">
        <n-input-number :value="setting.fontSize" :min="limits.minFontSize" :max="limits.maxFontSize"
          @update:value="value => bar.updateSetting({ fontSize: value ?? defaults.fontSize })" />
      </LyricSettingRow>
      <LyricSettingRow title="字体系列">
        <n-select :value="setting.fontFamily" :options="fontOptions" @update:value="value => bar.updateSetting({ fontFamily: value })" />
      </LyricSettingRow>
      <LyricSettingRow title="字体加粗">
        <n-switch :value="setting.bold" aria-label="底栏歌词加粗" @update:value="value => bar.updateSetting({ bold: value })" />
      </LyricSettingRow>
      <LyricSettingRow title="文字不透明度" wide>
        <SettingAdjustment :value="Math.round(setting.opacity * 100)" label="底栏歌词不透明度" :min="1" :max="100"
          @update:value="value => bar.updateSetting({ opacity: value / 100 })" />
      </LyricSettingRow>
      <LyricSettingRow title="颜色跟随主题" description="使用主题次要文字色和强调色。">
        <n-switch :value="setting.followTheme" aria-label="底栏歌词颜色跟随主题" @update:value="value => bar.updateSetting({ followTheme: value })" />
      </LyricSettingRow>
      <template v-if="!setting.followTheme">
        <LyricSettingRow title="文字颜色">
          <n-color-picker :value="setting.textColor" :show-alpha="true" @update:value="value => bar.updateSetting({ textColor: value })" />
        </LyricSettingRow>
        <LyricSettingRow title="逐字高亮颜色" description="仅逐字歌词已唱部分生效。">
          <n-color-picker :value="setting.highlightColor" :show-alpha="true" @update:value="value => bar.updateSetting({ highlightColor: value })" />
        </LyricSettingRow>
      </template>
    </SettingSection>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { NButton, NColorPicker, NInputNumber, NSelect, NSwitch } from "naive-ui";
import { usePlayerBarLyricStore, defaultPlayerBarLyricSetting, PLAYER_BAR_LYRIC_LIMITS as limits } from "@/store/playerBarLyric";
import SettingSection from "../SettingSection.vue";
import SettingAdjustment from "../SettingAdjustment.vue";
import LyricSettingRow from "./LyricSettingRow.vue";
import { getLyricFontOptions } from "./lyricSettingOptions";

const bar = usePlayerBarLyricStore();
const { setting } = storeToRefs(bar);
const defaults = defaultPlayerBarLyricSetting();
const fontOptions = computed(() => getLyricFontOptions(setting.value.fontFamily));
const sourceOptions = [
  { label: "跟随主播放器", value: "follow" },
  { label: "优先逐字", value: "word" },
  { label: "逐行显示", value: "line" },
];
</script>

<style scoped lang="scss">
@use "../settingLayout.scss";
</style>
