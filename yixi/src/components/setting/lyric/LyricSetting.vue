<template>
  <div class="lyric-setting">
    <section class="setting-card">
      <div class="section-header">
        <div>
          <h3>窗口歌词</h3>
          <p>控制主播放器里的歌词渲染效果。</p>
        </div>
      </div>

      <div class="setting-grid">
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">使用 AM Lyric</div>
            <div class="item-desc">启用更细腻的歌词动效渲染。</div>
          </div>
          <n-switch v-model:value="setting.useAMLyric" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">逐字歌词</div>
            <div class="item-desc">优先使用 KRC 逐字歌词数据。</div>
          </div>
          <n-switch v-model:value="setting.useKRC" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">水平居中</div>
            <div class="item-desc">歌词以纯净居中模式显示。</div>
          </div>
          <n-switch v-model:value="setting.pureLyricMode" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">对齐位置</div>
            <div class="item-desc">0.5 表示垂直居中。</div>
          </div>
          <n-input-number v-model:value="setting.alignPosition" :min="0" :max="1" :step="0.1" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">放大效果</div>
            <div class="item-desc">当前歌词行获得轻微缩放。</div>
          </div>
          <n-switch v-model:value="setting.useAMScale" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">模糊效果</div>
            <div class="item-desc">弱化非当前歌词行。</div>
          </div>
          <n-switch v-model:value="setting.useAMBlur" />
        </div>
      </div>
    </section>

    <section class="setting-card">
      <div class="section-header">
        <div>
          <h3>窗口歌词文字</h3>
          <p>调整主播放器歌词的字体、颜色和透明度。</p>
        </div>
      </div>

      <div class="setting-grid">
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体大小</div>
            <div class="item-desc">主播放器歌词字号。</div>
          </div>
          <n-input-number v-model:value="setting.lyricFontSize" :min="12" :max="60" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体样式</div>
            <div class="item-desc">选择歌词显示字体。</div>
          </div>
          <n-select v-model:value="setting.lyricFont" :options="fontFamily" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体颜色</div>
            <div class="item-desc">普通歌词行颜色。</div>
          </div>
          <n-color-picker v-model:value="setting.lyricFontColor" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">当前行颜色</div>
            <div class="item-desc">非 AM Lyric 模式下生效。</div>
          </div>
          <n-color-picker v-model:value="setting.currentLyricColor" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体加粗</div>
            <div class="item-desc">增强歌词可读性。</div>
          </div>
          <n-switch v-model:value="setting.lyricFontWeight" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体阴影</div>
            <div class="item-desc">在复杂封面背景下更清晰。</div>
          </div>
          <n-switch v-model:value="setting.lyricFontShadow" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体透明度</div>
            <div class="item-desc">范围 0.01 到 1。</div>
          </div>
          <n-input-number v-model:value="setting.lyricFontOpacity" :step="0.1" :min="0.01" :max="1" />
        </div>
      </div>
    </section>

    <section class="setting-card">
      <div class="section-header">
        <div>
          <h3>桌面歌词</h3>
          <p>独立桌面歌词窗口的显示与文字设置。</p>
        </div>
        <n-switch v-model:value="desktop" @update:value="handleOpenDesktopLyric" />
      </div>

      <div class="setting-grid">
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体颜色</div>
            <div class="item-desc">未播放歌词颜色。</div>
          </div>
          <n-color-picker v-model:value="desktopLyric.textColor" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">已播放颜色</div>
            <div class="item-desc">已唱过部分的高亮色。</div>
          </div>
          <n-color-picker v-model:value="desktopLyric.highlightColor" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体粗细</div>
            <div class="item-desc">范围 500 到 700。</div>
          </div>
          <n-input-number v-model:value="desktopLyric.fontWeight" :step="100" :min="500" :max="700" />
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体大小</div>
            <div class="item-desc">桌面歌词字号。</div>
          </div>
          <n-input-number
            v-model:value="desktopLyric.fontSize"
            :min="desktopLyric.minSize"
            :max="desktopLyric.maxSize" />
        </div>
        <div class="setting-item wide">
          <div class="item-info">
            <div class="item-title">字体样式</div>
            <div class="item-desc">桌面歌词字体。</div>
          </div>
          <n-select
            v-model:value="desktopLyric.fontFamily"
            :options="fontFamily"
            value-field="value"
            label-field="label" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { NColorPicker, NInputNumber, NSelect, NSwitch } from "naive-ui";
import { useLyricStore } from "@/store/lyricStore";
import { storeToRefs } from "pinia";
import { watch } from "vue";
import electronAPI from "@/utils/electron";
import { debounce } from "@/utils/common";

const lyric = useLyricStore();
const { setting, desktop, desktopLyric } = storeToRefs(lyric);

const fontFamily = [
  { key: 1, label: "微软雅黑", value: "Microsoft YaHei" },
  { key: 2, label: "黑体", value: "黑体" },
  { key: 3, label: "宋体", value: "宋体" },
  { key: 4, label: "楷体", value: "楷体" },
  { key: 5, label: "隶书", value: "隶书" },
  { key: 6, label: "幼圆", value: "幼圆" },
  { key: 7, label: "方正舒体", value: "方正舒体" },
  { key: 8, label: "方正姚体", value: "方正姚体" },
  { key: 9, label: "华文新魏", value: "华文新魏" },
  { key: 10, label: "华文细黑", value: "华文细黑" },
  { key: 11, label: "华文楷体", value: "华文楷体" },
  { key: 12, label: "华文宋体", value: "华文宋体" },
  { key: 13, label: "华文隶书", value: "华文隶书" },
  { key: 14, label: "华文彩云", value: "华文彩云" },
  { key: 15, label: "华文琥珀", value: "华文琥珀" },
  { key: 16, label: "华文行楷", value: "华文行楷" },
  { key: 17, label: "华文仿宋", value: "华文仿宋" },
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
    lyric.sendConfig();
  }, 500),
  { deep: true }
);

const handleOpenDesktopLyric = async (value: boolean) => {
  await electronAPI.openLyricWindow();
  lyric.sendToLyricWindow();
  lyric.setDesktop(value);
};
</script>

<style lang="scss" scoped>
.lyric-setting {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 20px;
}

.setting-card {
  padding: 18px;
  border: 1px solid var(--color-border-default);
  border-radius: 12px;
  background: var(--color-card-bg);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;

  h3 {
    margin: 0;
    color: var(--color-text-default);
    font-size: 16px;
    font-weight: 700;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-text-secondary);
    font-size: 12px;
  }
}

.setting-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.setting-item {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 14px;
  border-radius: 10px;
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--color-setting-hover);
  }

  &.wide {
    grid-column: span 2;
  }
}

.item-info {
  min-width: 0;
}

.item-title {
  color: var(--color-text-default);
  font-size: 14px;
  font-weight: 600;
}

.item-desc {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

:deep(.n-input-number),
:deep(.n-select),
:deep(.n-color-picker) {
  width: 180px;
  flex-shrink: 0;
}

.wide :deep(.n-select) {
  width: 260px;
}
</style>
