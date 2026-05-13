<template>
  <div class="setting-con">
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">本地扫描目录</div>
        <div class="setting-desc">选择本地音乐文件的扫描目录，应用后续会基于这里扩展扫描能力。</div>
      </div>
      <div class="path-input">
        <n-input
          class="path-field"
          :value="settingStore.local.scanDirectory"
          placeholder="请选择扫描目录"
          readonly />
        <n-button secondary @click="settingStore.chooseScanDirectory">选择</n-button>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">缓存目录</div>
        <div class="setting-desc">设置音频缓存存储位置，当前先保存配置，后续再对接真实缓存能力。</div>
      </div>
      <div class="path-input">
        <n-input
          class="path-field"
          :value="settingStore.local.cacheDirectory"
          placeholder="请选择缓存目录"
          readonly />
        <n-button secondary @click="settingStore.chooseCacheDirectory">选择</n-button>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">缓存大小限制</div>
        <div class="setting-desc">当前仅保存限制值，默认 10 GB，缓存清理逻辑后续接入。</div>
      </div>
      <n-input-number
        class="size-input"
        :value="settingStore.local.cacheLimitGb"
        :min="0"
        @update:value="handleCacheLimitChange">
        <template #suffix>GB</template>
      </n-input-number>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">下载目录</div>
        <div class="setting-desc">设置下载歌曲的保存位置，当前先建立设置链路。</div>
      </div>
      <div class="path-input">
        <n-input
          class="path-field"
          :value="settingStore.local.downloadDirectory"
          placeholder="请选择下载目录"
          readonly />
        <n-button secondary @click="settingStore.chooseDownloadDirectory">选择</n-button>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">歌曲命名方式</div>
        <div class="setting-desc">下载或缓存歌曲时的文件命名规则，当前默认使用“歌手 - 歌名”。</div>
      </div>
      <n-select
        class="naming-select"
        :value="settingStore.local.songNamingMode"
        :options="songNamingOptions"
        @update:value="handleSongNamingChange" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NInputNumber, NSelect } from "naive-ui";
import { onMounted } from "vue";
import { useSettingStore, type SongNamingMode } from "@/store/settingStore";

const settingStore = useSettingStore();
const songNamingOptions = [
  { label: "歌手 - 歌名", value: "artist-title" },
  { label: "歌名 - 歌手", value: "title-artist" },
  { label: "仅歌曲名", value: "title" },
  { label: "序号 - 歌名 - 歌手", value: "index-title-artist" },
];

const handleCacheLimitChange = (value: number | null) => {
  void settingStore.updateCacheLimitGb(value);
};

const handleSongNamingChange = (value: SongNamingMode) => {
  void settingStore.updateSongNamingMode(value);
};

onMounted(() => {
  void settingStore.initLocalSetting();
});
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

  .naming-select {
    width: 220px;
    flex-shrink: 0;
  }
}
</style>
