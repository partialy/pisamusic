<template>
  <div class="setting-con">
    <div class="deliver">窗口歌词</div>
    <div class="setting-item">
      <div>使用AM Lyric</div>
      <n-switch v-model:value="setting.useAMLyric" />
    </div>
    <div class="setting-item">
      <div>使用逐字歌词</div>
      <n-switch v-model:value="setting.useKRC" />
    </div>
    <div class="setting-item">
      <div>水平居中</div>
      <n-switch v-model:value="setting.pureLyricMode" />
    </div>
    <div class="setting-item">
      <div>对齐位置(0.5为垂直居中)</div>
      <n-input-number
        style="width: 100px"
        v-model:value="setting.alignPosition"
        :min="0"
        :max="1"
        :step="0.1"
      />
    </div>
    <div class="setting-item">
      <div>放大效果</div>
      <n-switch v-model:value="setting.useAMScale" />
    </div>
    <div class="setting-item">
      <div>模糊效果</div>
      <n-switch v-model:value="setting.useAMBlur" />
    </div>
    <div class="setting-item">
      <div>字体大小</div>
      <n-input-number
        style="width: 100px"
        v-model:value="setting.lyricFontSize"
        :min="12"
        :max="60"
      />
    </div>
    <div class="setting-item">
      <div>字体样式</div>
      <n-select
        style="width: 200px"
        v-model:value="setting.lyricFont"
        :options="fontFamily"
      />
    </div>
    <div class="setting-item">
      <div>字体颜色</div>
      <n-color-picker
        style="width: 100px"
        v-model:value="setting.lyricFontColor"
      />
    </div>
    <div class="setting-item">
      <div>当前行字体颜色(非AM Lyric有效)</div>
      <n-color-picker
        style="width: 100px"
        v-model:value="setting.currentLyricColor"
      />
    </div>
    <div class="setting-item">
      <div>字体加粗</div>
      <n-switch v-model:value="setting.lyricFontWeight" />
    </div>
    <div class="setting-item">
      <div>字体阴影</div>
      <n-switch v-model:value="setting.lyricFontShadow" />
    </div>
    <div class="setting-item">
      <div>字体透明度</div>
      <n-input-number
        style="width: 100px"
        v-model:value="setting.lyricFontOpacity"
        :step="0.1"
        :min="0.01"
        :max="1"
      />
    </div>
    <div class="deliver">桌面歌词</div>
    <div class="setting-item">
      <div>启用桌面歌词</div>
      <n-switch
        v-model:value="desktop"
        v-on:update-value="handleOpenDesktopLyric"
      />
    </div>
    <div class="setting-item">
      <div>字体颜色</div>
      <n-color-picker
        style="width: 100px"
        v-model:value="desktopLyric.textColor"
      />
    </div>
    <div class="setting-item">
      <div>已播放字体颜色</div>
      <n-color-picker
        style="width: 100px"
        v-model:value="desktopLyric.highlightColor"
      />
    </div>
    <div class="setting-item">
      <div>字体粗细(100-900)</div>
      <n-input-number
        v-model:value="desktopLyric.fontWeight"
        :step="100"
        :min="500"
        :max="700"
      />
    </div>
    <div class="setting-item">
      <div>字体大小</div>
      <n-input-number
        style="width: 100px"
        v-model:value="desktopLyric.fontSize"
        :min="desktopLyric.minSize"
        :max="desktopLyric.maxSize"
      />
    </div>
    <div class="setting-item">
      <div>字体样式</div>
      <n-select
        style="width: 200px"
        v-model:value="desktopLyric.fontFamily"
        :options="fontFamily"
        value-field="value"
        label-field="label"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { NSwitch, NInputNumber, NColorPicker } from "naive-ui";
import { useLyricStore } from "@/store/lyricStore";
import { storeToRefs } from "pinia";
import { watch } from "vue";
import electronAPI from "@/utils/electron";
import { debounce } from "@/utils/common";
const lyric = useLyricStore();
const { setting, desktop, desktopLyric } = storeToRefs(lyric);

const fontFamily = [
  { key:1 ,label: "微软雅黑", value: "Microsoft YaHei" },
  { key:2 ,label: "黑体", value: "黑体" },
  { key:3 ,label: "宋体", value: "宋体" },
  { key:4 ,label: "楷体", value: "楷体" },
  { key:5 ,label: "隶书", value: "隶书" },
  { key:6 ,label: "幼圆", value: "幼圆" },
  { key:7 ,label: "方正舒体", value: "方正舒体" },
  { key:8 ,label: "方正姚体", value: "方正姚体" },
  { key:9 ,label: "华文新魏", value: "华文新魏" },
  { key:10 ,label: "华文细黑", value: "华文细黑" },
  { key:11 ,label: "华文楷体", value: "华文楷体" },
  { key:12 ,label: "华文宋体", value: "华文宋体" },
  { key:13 ,label: "华文隶书", value: "华文隶书" },
  { key:14 ,label: "华文彩云", value: "华文彩云" },
  { key:15 ,label: "华文琥珀", value: "华文琥珀" },
  { key:16 ,label: "华文行楷", value: "华文行楷" },
  { key:17 ,label: "华文仿宋", value: "华文仿宋" },
];

watch(
  () => setting.value,
  () => {
    lyric.saveSetting();
  },
  { deep: true }
);

watch(
  () => desktopLyric.value,
  debounce(() => {
    console.log("desktopLyric change", desktopLyric.value);
    lyric.sendConfig();
  }, 500),
  {
    deep: true,
  }
);
const handleOpenDesktopLyric = async (value: boolean) => {
  await electronAPI.openLyricWindow();
  lyric.sendToLyricWindow();
  lyric.setDesktop(value);
};
</script>

<style lang="scss" scoped>
.setting-con {
  .deliver {
    padding: 5px 10px;
    background-color: #f1f1f1;
    border-radius: 8px;
    margin-bottom: 5px;
    font-weight: bold;
  }

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;

    &:hover {
      background: #f5f5f5;
      cursor: pointer;
      border-radius: 8px;
    }
  }
}
</style>
