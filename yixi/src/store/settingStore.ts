import { defineStore } from "pinia";
import electronAPI from "@/utils/electron";
import { toRaw } from "vue";

export type SongNamingMode =
  | "artist-title"
  | "title-artist"
  | "title"
  | "index-title-artist";

export type LocalSetting = {
  scanDirectories: string[];
  cacheDirectory: string;
  cacheLimitGb: number;
  downloadDirectory: string;
  songNamingMode: SongNamingMode;
};

const LOCAL_SETTING_KEY = "local-setting";
const MAX_SCAN_DIRECTORIES = 10;
const DEFAULT_LOCAL_SETTING: LocalSetting = {
  scanDirectories: [],
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
      const record = await electronAPI.getSetting<Partial<LocalSetting> & { scanDirectory?: string }>(LOCAL_SETTING_KEY);
      this.local = normalizeLocalSetting(record?.value);
      this.localLoaded = true;
      if (!record?.value || shouldPersistNormalizedSetting(record.value)) {
        await this.persistLocalSetting();
      }
    },

    addScanDirectory() {
      if (this.local.scanDirectories.length >= MAX_SCAN_DIRECTORIES) return;
      this.local.scanDirectories = [...this.local.scanDirectories, ""];
    },

    async chooseScanDirectory(index: number) {
      const selected = await electronAPI.selectDirectory("选择本地扫描目录");
      if (!selected) return;
      const next = [...this.local.scanDirectories];
      next[index] = selected;
      await this.updateScanDirectories(next);
    },

    async removeScanDirectory(index: number) {
      await this.updateScanDirectories(
        this.local.scanDirectories.filter((_, itemIndex) => itemIndex !== index)
      );
    },

    async updateScanDirectories(paths: string[]) {
      this.local.scanDirectories = normalizeScanDirectories(paths);
      await this.persistLocalSetting();
      await electronAPI.refreshLocalLibrary();
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
      const normalized = normalizeLocalSetting(toRaw(this.local));
      this.local = normalized;
      await electronAPI.setSetting(LOCAL_SETTING_KEY, normalized, 1);
    },
  },
});

export default useSettingStore;

function normalizeLocalSetting(
  input?: (Partial<LocalSetting> & { scanDirectory?: unknown }) | null
): LocalSetting {
  return {
    scanDirectories: normalizeScanDirectories(
      Array.isArray(input?.scanDirectories)
        ? input.scanDirectories
        : input?.scanDirectory
          ? [input.scanDirectory]
          : []
    ),
    cacheDirectory: normalizePath(input?.cacheDirectory),
    cacheLimitGb: normalizeCacheLimit(input?.cacheLimitGb ?? DEFAULT_LOCAL_SETTING.cacheLimitGb),
    downloadDirectory: normalizePath(input?.downloadDirectory),
    songNamingMode: isSongNamingMode(input?.songNamingMode)
      ? input.songNamingMode
      : DEFAULT_LOCAL_SETTING.songNamingMode,
  };
}

function shouldPersistNormalizedSetting(
  input: (Partial<LocalSetting> & { scanDirectory?: unknown }) | null
) {
  return Boolean(input && (!Array.isArray(input.scanDirectories) || input.scanDirectory));
}

function normalizeScanDirectories(paths: unknown) {
  if (!Array.isArray(paths)) return [];
  return Array.from(new Set(paths.map(normalizePath).filter(Boolean))).slice(0, MAX_SCAN_DIRECTORIES);
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
