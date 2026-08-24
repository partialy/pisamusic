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
        <div class="setting-desc">{{ cacheDirectoryDescription }}</div>
      </div>
      <div class="path-input">
        <n-input
          class="path-field"
          :value="effectiveCacheDirectory"
          placeholder="使用应用默认缓存目录"
          readonly />
        <n-button secondary @click="handleChooseCacheDirectory">选择</n-button>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">缓存大小限制</div>
        <div class="setting-desc">{{ cacheUsageDescription }}</div>
      </div>
      <div class="cache-actions">
        <n-input-number
          class="size-input"
          :value="settingStore.local.cacheLimitGb"
          :min="0"
          @update:value="handleCacheLimitChange">
          <template #suffix>GB</template>
        </n-input-number>
        <n-popconfirm
          positive-text="清理"
          negative-text="取消"
          @positive-click="handleClearCache">
          <template #trigger>
            <n-button secondary type="warning" :loading="clearingCache">清理缓存</n-button>
          </template>
          只清理播放缓存，不会删除下载歌曲、收藏或账号数据。
        </n-popconfirm>
      </div>
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

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">写入封面标签</div>
        <div class="setting-desc">下载歌曲时将封面写入音频文件元数据</div>
      </div>
      <n-switch
        :value="settingStore.local.embedDownloadCover"
        @update:value="settingStore.updateEmbedDownloadCover" />
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">写入歌词标签</div>
        <div class="setting-desc">下载歌曲时将歌词写入音频文件元数据</div>
      </div>
      <n-switch
        :value="settingStore.local.embedDownloadLyrics"
        @update:value="settingStore.updateEmbedDownloadLyrics" />
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-title">下载歌词到同目录</div>
        <div class="setting-desc">下载歌曲时在歌曲文件旁生成同名 .lrc 文件</div>
      </div>
      <n-switch
        :value="settingStore.local.saveDownloadLyricsFile"
        @update:value="settingStore.updateSaveDownloadLyricsFile" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NInputNumber, NPopconfirm, NSelect, NSwitch, useMessage } from "naive-ui";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useSettingStore, type SongNamingMode } from "@/store/settingStore";
import electronAPI from "@/utils/electron";

const settingStore = useSettingStore();
const message = useMessage();
const maxScanDirectories = 10;
const scanDirectories = computed(() => settingStore.local.scanDirectories);
const cacheStatus = ref<MediaCacheStatus | null>(null);
const clearingCache = ref(false);
let cacheStatusTimer: ReturnType<typeof setInterval> | null = null;
const effectiveCacheDirectory = computed(() =>
  cacheStatus.value?.directory || settingStore.local.cacheDirectory
);
const cacheDirectoryDescription = computed(() => {
  if (cacheStatus.value?.fallbackDirectory && settingStore.local.cacheDirectory) {
    return "所选目录不可用，当前已回退应用默认目录";
  }
  return "音频分片写入 PisaMusic 专属目录，不影响下载歌曲";
});
const cacheUsageDescription = computed(() => {
  const status = cacheStatus.value;
  if (!status) return "正在读取缓存用量";
  if (!status.enabled) return `播放缓存已关闭，当前占用 ${formatBytes(status.usedBytes)}`;
  const writing = status.writingCount > 0 ? `，正在写入 ${status.writingCount} 项` : "";
  return `${formatBytes(status.usedBytes)} / ${formatBytes(status.limitBytes)}，${status.entryCount} 首歌曲（${status.readyCount} 首完整）${writing}`;
});
const songNamingOptions = [
  { label: "歌手 - 歌名", value: "artist-title" },
  { label: "歌名 - 歌手", value: "title-artist" },
  { label: "仅歌曲名", value: "title" },
  { label: "序号 - 歌名 - 歌手", value: "index-title-artist" },
];

const handleAddScanDirectory = () => {
  settingStore.addScanDirectory();
};

const handleCacheLimitChange = async (value: number | null) => {
  await settingStore.updateCacheLimitGb(value);
  await refreshCacheStatus();
};

const handleChooseCacheDirectory = async () => {
  await settingStore.chooseCacheDirectory();
  await refreshCacheStatus();
};

const handleClearCache = async () => {
  if (clearingCache.value) return;
  clearingCache.value = true;
  try {
    cacheStatus.value = await electronAPI.clearMediaCache();
    message.success("播放缓存已清理");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "缓存清理失败");
  } finally {
    clearingCache.value = false;
  }
};

const refreshCacheStatus = async () => {
  cacheStatus.value = await electronAPI.getMediaCacheStatus().catch(() => cacheStatus.value);
};

const handleSongNamingChange = (value: SongNamingMode) => {
  void settingStore.updateSongNamingMode(value);
};

onMounted(async () => {
  await settingStore.initLocalSetting();
  await refreshCacheStatus();
  cacheStatusTimer = setInterval(() => void refreshCacheStatus(), 5_000);
});

onUnmounted(() => {
  if (cacheStatusTimer) clearInterval(cacheStatusTimer);
});

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}
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

  .cache-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .naming-select {
    width: 220px;
    flex-shrink: 0;
  }
}
</style>
