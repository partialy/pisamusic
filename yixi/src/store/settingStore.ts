import { defineStore } from "pinia";
import electronAPI from "@/utils/electron";

export type SongNamingMode =
  | "artist-title"
  | "title-artist"
  | "title"
  | "index-title-artist";

export type LocalSetting = {
  scanDirectory: string;
  cacheDirectory: string;
  cacheLimitGb: number;
  downloadDirectory: string;
  songNamingMode: SongNamingMode;
};

const LOCAL_SETTING_KEY = "local-setting";
const DEFAULT_LOCAL_SETTING: LocalSetting = {
  scanDirectory: "",
  cacheDirectory: "",
  cacheLimitGb: 10,
  downloadDirectory: "",
  songNamingMode: "artist-title",
};

export const useSettingStore = defineStore("setting", {
  state: () => ({
    language: "zh-CN",
    quality: "128",
    directRequest: true,
    local: { ...DEFAULT_LOCAL_SETTING } as LocalSetting,
    localLoaded: false,
  }),
  actions: {
    async initLocalSetting() {
      if (this.localLoaded) return;
      const record = await electronAPI.getSetting<Partial<LocalSetting>>(LOCAL_SETTING_KEY);
      this.local = normalizeLocalSetting(record?.value);
      this.localLoaded = true;
      if (!record?.value) {
        await this.persistLocalSetting();
      }
    },

    async updateScanDirectory(path: string) {
      this.local.scanDirectory = normalizePath(path);
      await this.persistLocalSetting();
    },

    async updateCacheDirectory(path: string) {
      this.local.cacheDirectory = normalizePath(path);
      await this.persistLocalSetting();
    },

    async updateDownloadDirectory(path: string) {
      this.local.downloadDirectory = normalizePath(path);
      await this.persistLocalSetting();
    },

    async updateCacheLimitGb(value: number | null) {
      this.local.cacheLimitGb = normalizeCacheLimit(value);
      await this.persistLocalSetting();
    },

    async updateSongNamingMode(value: SongNamingMode) {
      this.local.songNamingMode = isSongNamingMode(value)
        ? value
        : DEFAULT_LOCAL_SETTING.songNamingMode;
      await this.persistLocalSetting();
    },

    async chooseScanDirectory() {
      const selected = await electronAPI.selectDirectory("选择本地扫描目录");
      if (selected) {
        await this.updateScanDirectory(selected);
      }
    },

    async chooseCacheDirectory() {
      const selected = await electronAPI.selectDirectory("选择缓存目录");
      if (selected) {
        await this.updateCacheDirectory(selected);
      }
    },

    async chooseDownloadDirectory() {
      const selected = await electronAPI.selectDirectory("选择下载目录");
      if (selected) {
        await this.updateDownloadDirectory(selected);
      }
    },

    async persistLocalSetting() {
      this.local = normalizeLocalSetting(this.local);
      await electronAPI.setSetting(LOCAL_SETTING_KEY, this.local, 1);
    },
  },
});

export default useSettingStore;

function normalizeLocalSetting(input?: Partial<LocalSetting> | null): LocalSetting {
  return {
    scanDirectory: normalizePath(input?.scanDirectory),
    cacheDirectory: normalizePath(input?.cacheDirectory),
    cacheLimitGb: normalizeCacheLimit(input?.cacheLimitGb ?? DEFAULT_LOCAL_SETTING.cacheLimitGb),
    downloadDirectory: normalizePath(input?.downloadDirectory),
    songNamingMode: isSongNamingMode(input?.songNamingMode)
      ? input.songNamingMode
      : DEFAULT_LOCAL_SETTING.songNamingMode,
  };
}

function normalizePath(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCacheLimit(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LOCAL_SETTING.cacheLimitGb;
  return Math.max(0, Math.round(parsed * 10) / 10);
}

function isSongNamingMode(value: unknown): value is SongNamingMode {
  return (
    value === "artist-title" ||
    value === "title-artist" ||
    value === "title" ||
    value === "index-title-artist"
  );
}
