<template>
  <div class="setting-con">
    <div class="setting-item scan-item">
      <div class="setting-info">
        <div class="setting-title">本地扫描目录</div>
        <div class="setting-desc">最多添加 10 个本地音乐文件夹，修改后会自动重建本地曲库</div>
      </div>
      <div class="scan-list">
        <div
          v-for="(directory, index) in scanDirectories"
          :key="`${directory}-${index}`"
          class="path-input">
          <n-input
            class="path-field"
            :value="directory"
            placeholder="请选择扫描目录"
            readonly />
          <n-button secondary @click="settingStore.chooseScanDirectory(index)">选择</n-button>
          <n-button quaternary type="error" @click="settingStore.removeScanDirectory(index)">删除</n-button>
        </div>
        <div class="path-input">
          <n-button
            secondary
            :disabled="scanDirectories.length >= maxScanDirectories"
            @click="handleAddScanDirectory">
            添加目录
          </n-button>
          <span class="scan-count">{{ scanDirectories.length }}/{{ maxScanDirectories }}</span>
        </div>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">缓存目录</div>
        <div class="setting-desc">设置音频缓存存储位置</div>
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
        <div class="setting-desc">当前仅保存限制值</div>
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
        <div class="setting-desc">设置下载歌曲的保存位置</div>
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
        <div class="setting-desc">下载或缓存歌曲时的文件命名规则</div>
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
import { computed, onMounted } from "vue";
import { useSettingStore, type SongNamingMode } from "@/store/settingStore";

const settingStore = useSettingStore();
const maxScanDirectories = 10;
const scanDirectories = computed(() => settingStore.local.scanDirectories);
const songNamingOptions = [
  { label: "歌手 - 歌名", value: "artist-title" },
  { label: "歌名 - 歌手", value: "title-artist" },
  { label: "仅歌曲名", value: "title" },
  { label: "序号 - 歌名 - 歌手", value: "index-title-artist" },
];

const handleAddScanDirectory = () => {
  settingStore.addScanDirectory();
};

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

  .scan-item {
    align-items: flex-start;
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

  .scan-list {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    flex-shrink: 0;
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

  .scan-count {
    min-width: 42px;
    color: var(--color-text-secondary);
    font-size: 12px;
    text-align: right;
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
