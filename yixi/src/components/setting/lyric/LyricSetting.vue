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
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.useAMLyric" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">逐字歌词</div>
            <div class="item-desc">优先使用 KRC 逐字歌词数据。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.useKRC" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">水平居中</div>
            <div class="item-desc">歌词以纯净居中模式显示。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.pureLyricMode" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">对齐位置</div>
            <div class="item-desc">0.5 表示垂直居中。</div>
          </div>
          <div class="setting-control">
            <n-input-number v-model:value="setting.alignPosition" :min="0" :max="1" :step="0.1" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">放大效果</div>
            <div class="item-desc">当前歌词行获得轻微缩放。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.useAMScale" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">模糊效果</div>
            <div class="item-desc">弱化非当前歌词行。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.useAMBlur" />
          </div>
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
          <div class="setting-control">
            <n-input-number v-model:value="setting.lyricFontSize" :min="12" :max="60" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体样式</div>
            <div class="item-desc">选择歌词显示字体。</div>
          </div>
          <div class="setting-control">
            <n-select v-model:value="setting.lyricFont" :options="fontFamily" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体颜色</div>
            <div class="item-desc">普通歌词行颜色。</div>
          </div>
          <div class="setting-control">
            <n-color-picker v-model:value="setting.lyricFontColor" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">当前行颜色</div>
            <div class="item-desc">非 AM Lyric 模式下生效。</div>
          </div>
          <div class="setting-control">
            <n-color-picker v-model:value="setting.currentLyricColor" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体加粗</div>
            <div class="item-desc">增强歌词可读性。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.lyricFontWeight" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体阴影</div>
            <div class="item-desc">在复杂封面背景下更清晰。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="setting.lyricFontShadow" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体透明度</div>
            <div class="item-desc">范围 0.01 到 1。</div>
          </div>
          <div class="setting-control">
            <n-input-number v-model:value="setting.lyricFontOpacity" :step="0.1" :min="0.01" :max="1" />
          </div>
        </div>
      </div>
    </section>

    <section class="setting-card">
      <div class="section-header">
        <div>
          <h3>桌面歌词</h3>
          <p>独立桌面歌词窗口的显示与文字设置。</p>
        </div>
      </div>

      <div class="setting-grid">
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">启用桌面歌词</div>
            <div class="item-desc">打开独立桌面歌词窗口。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="desktop" @update:value="handleOpenDesktopLyric" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">锁定桌面歌词</div>
            <div class="item-desc">锁定后鼠标可穿透歌词窗口，关闭后可拖动和显示控制栏。</div>
          </div>
          <div class="setting-control switch-control">
            <n-switch v-model:value="desktopLyric.locked" @update:value="handleDesktopLyricLock" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">窗口宽度</div>
            <div class="item-desc">桌面歌词窗口宽度，范围 500~1200。</div>
          </div>
          <div class="setting-control">
            <n-input-number v-model:value="desktopLyric.width" :min="500" :max="1200" :step="10" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">窗口高度</div>
            <div class="item-desc">桌面歌词窗口高度，范围 100~200。</div>
          </div>
          <div class="setting-control">
            <n-input-number v-model:value="desktopLyric.height" :min="100" :max="200" :step="10" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体颜色</div>
            <div class="item-desc">未播放歌词颜色。</div>
          </div>
          <div class="setting-control">
            <n-color-picker v-model:value="desktopLyric.textColor" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">已播放颜色</div>
            <div class="item-desc">已唱过部分的高亮色。</div>
          </div>
          <div class="setting-control">
            <n-color-picker v-model:value="desktopLyric.highlightColor" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体粗细</div>
            <div class="item-desc">范围 500 到 700。</div>
          </div>
          <div class="setting-control">
            <n-input-number v-model:value="desktopLyric.fontWeight" :step="100" :min="500" :max="700" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体大小</div>
            <div class="item-desc">桌面歌词字号。</div>
          </div>
          <div class="setting-control">
            <n-input-number
              v-model:value="desktopLyric.fontSize"
              :min="desktopLyric.minSize"
              :max="desktopLyric.maxSize" />
          </div>
        </div>
        <div class="setting-item">
          <div class="item-info">
            <div class="item-title">字体样式</div>
            <div class="item-desc">桌面歌词字体。</div>
          </div>
          <div class="setting-control">
            <n-select
              v-model:value="desktopLyric.fontFamily"
              :options="fontFamily"
              value-field="value"
              label-field="label" />
          </div>
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
  debounce(async () => {
    await lyric.saveDesktopLyricSetting();
    await lyric.sendConfig();
    electronAPI.lockLyric(desktopLyric.value.locked);
  }, 500),
  { deep: true }
);

const handleOpenDesktopLyric = async (value: boolean) => {
  if (value) {
    await electronAPI.openLyricWindow();
    lyric.sendToLyricWindow();
  } else {
    await electronAPI.closeLyricWindow();
  }
  lyric.setDesktop(value);
};

const handleDesktopLyricLock = (value: boolean) => {
  lyric.setDesktopLocked(value);
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
  // background: var(--color-card-bg);
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
  flex: 1 1 auto;
  min-width: 0;
  padding-right: 12px;
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

.setting-control {
  width: 150px;
  flex-shrink: 0;
}

.switch-control {
  width: auto;
  min-width: 46px;
  display: flex;
  justify-content: flex-end;
}

.wide-control {
  width: min(420px, 42vw);
}

:deep(.setting-control .n-input-number),
:deep(.setting-control .n-select),
:deep(.setting-control .n-color-picker) {
  width: 100%;
}

@media (max-width: 1180px) {
  .setting-grid {
    grid-template-columns: 1fr;
  }

  .setting-item.wide {
    grid-column: auto;
  }

  .wide-control {
    width: min(360px, 44vw);
  }
}
</style>
