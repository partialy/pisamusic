<template>
  <div class="setting-con">
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">本地扫描目录</div>
        <div class="setting-desc">选择本地音乐文件的扫描目录，应用将自动扫描该目录下的音频文件。</div>
      </div>
      <div class="path-input">
        <n-input
          class="path-field"
          placeholder="请选择扫描目录"
          readonly />
        <n-button secondary>选择</n-button>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">缓存目录</div>
        <div class="setting-desc">设置音频缓存存储位置，建议选择空间充足的磁盘分区。</div>
      </div>
      <div class="path-input">
        <n-input
          class="path-field"
          placeholder="请选择缓存目录"
          readonly />
        <n-button secondary>选择</n-button>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">缓存大小限制</div>
        <div class="setting-desc">超过限制后自动清理较早的缓存文件。</div>
      </div>
      <n-input-number class="size-input">
        <template #suffix>GB</template>
      </n-input-number>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">下载目录</div>
        <div class="setting-desc">设置下载歌曲的保存位置。</div>
      </div>
      <div class="path-input">
        <n-input
          class="path-field"
          placeholder="请选择下载目录"
          readonly />
        <n-button secondary>选择</n-button>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">歌曲命名方式</div>
        <div class="setting-desc">下载或缓存歌曲时的文件命名规则。</div>
      </div>
      <n-radio-group class="naming-group">
        <n-radio-button value="title-artist">
          歌曲名 - 歌手
        </n-radio-button>
        <n-radio-button value="artist-title">
          歌手 - 歌曲名
        </n-radio-button>
        <n-radio-button value="title">
          仅歌曲名
        </n-radio-button>
        <n-radio-button value="index-title-artist">
          序号 - 歌曲名 - 歌手
        </n-radio-button>
      </n-radio-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NInputNumber, NRadioButton, NRadioGroup } from "naive-ui";
</script>

<style lang="scss" scoped>
.setting-con {
  .setting-item {
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

  .path-input {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    .path-field {
      width: 260px;
    }
  }

  .size-input {
    width: 140px;
    flex-shrink: 0;
  }

  .naming-group {
    flex-shrink: 0;
  }
}
</style>
