import type { LyricLine } from "@applemusic-like-lyrics/core";
import { parseYrc as amParseYrc } from "@applemusic-like-lyrics/lyric";
import { defineStore } from "pinia";
import type { Song } from "@/types/song";
import { fetchLyricsByMusicApi } from "@/utils/api/musicAPI";
import electronAPI from "@/utils/electron";
import {
  convertKrcToAMLyricLine,
  convertLrcToAMLyricLine,
  parseKrc,
  parseLrc,
  type MyLyricLine,
} from "@/utils/lyricUtil";

export interface LyricSetting {
  useAMLyric: boolean;
  useKRC: boolean;
  alignPosition: number;
  pureLyricMode?: boolean;
  useAMSpring?: boolean;
  useAMScale?: boolean;
  useAMBlur?: boolean;
  lyricFontSize?: number;
  lyricFont?: string;
  lyricFontWeight?: boolean;
  lyricFontColor?: string;
  currentLyricColor?: string;
  lyricFontOpacity?: number;
  lyricFontShadow?: boolean;
  showTime?: boolean;
}

type LyricPayload = {
  krc: string;
  lrc: string;
};

type DesktopLyricSetting = {
  width: number;
  height: number;
  maxSize: number;
  minSize: number;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  highlightColor: string;
  fontWeight: number;
  locked: boolean;
};

const emptyLyric = (): LyricPayload => ({ krc: "", lrc: "" });
const DESKTOP_LYRIC_SETTING_KEY = "desktop-lyric-setting";

export const useLyricStore = defineStore("lyric", {
  state: () => ({
    rawLrc: "",
    rawKrc: "",
    parsedLrc: [] as MyLyricLine[],
    parsedKrc: [] as MyLyricLine[],
    AMKrc: [] as LyricLine[],
    AMLrc: [] as LyricLine[],
    currentId: "",
    currentTime: 0,
    lyricLoading: false,
    currentSong: null as Song | null,
    desktop: false,
    desktopLyric: {
      width: 800,
      height: 120,
      maxSize: 64,
      minSize: 10,
      fontSize: 28,
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      textColor: "#fff",
      highlightColor: "#1871FD",
      fontWeight: 600,
      locked: false,
    },
    setting: {
      useAMLyric: true,
      useKRC: true,
      pureLyricMode: false,
      useAMSpring: true,
      useAMScale: true,
      useAMBlur: true,
      alignPosition: 0.5,
      lyricFontSize: 40,
      lyricFont: "Microsoft YaHei",
      lyricFontWeight: true,
      lyricFontColor: "#ffffff",
      currentLyricColor: "#ffffff",
      lyricFontOpacity: 1,
      lyricFontShadow: true,
      showTime: true,
    } as LyricSetting,

    get currentIndexLRC() {
      return this.parsedLrc.findIndex(
        (item) => item.time <= this.currentTime && item.endTime!! >= this.currentTime
      );
    },
    get currentIndexKRC() {
      return this.parsedKrc.findIndex(
        (item) => item.time <= this.currentTime && item.endTime!! >= this.currentTime
      );
    },
    get currentLineLRC() {
      return this.parsedLrc[this.currentIndexLRC] || null;
    },
    get currentLineKRC() {
      return this.parsedKrc[this.currentIndexKRC] || null;
    },
  }),
  actions: {
    async initLyric() {
      if (!this.currentSong) return;
      if (this.currentSong.id == this.currentId && (this.rawKrc || this.rawLrc)) return;

      this.currentId = this.currentSong.id;
      const lyric = await fetchSongLyric(this.currentSong);
      this.rawKrc = lyric.krc;
      this.rawLrc = lyric.lrc;
      this.parsedKrc = lyric.krc ? parseKrc(lyric.krc) : [];
      this.parsedLrc = lyric.lrc ? parseLrc(lyric.lrc) : [];
      if (this.currentSong.source == "wy") {
        this.AMKrc = lyric.krc ? amParseYrc(this.rawKrc) : [];
      } else {
        this.AMKrc = lyric.krc ? convertKrcToAMLyricLine(this.parsedKrc) : [];
      }
      this.AMLrc = lyric.lrc ? convertLrcToAMLyricLine(this.parsedLrc) : [];
      setTimeout(() => {
        this.sendToLyricWindow();
      }, 100);
    },
    setDesktop(de: boolean) {
      this.desktop = de;
      void electronAPI.setSetting("lyricConfig.desktop", de, 1);
    },
    saveSetting() {
      localStorage.setItem("pisa-lyric-setting", JSON.stringify(this.setting));
    },
    loadSetting() {
      const setting = localStorage.getItem("pisa-lyric-setting");
      if (setting) {
        this.setting = JSON.parse(setting);
      }
    },
    async loadDesktopLyricSetting() {
      const record = await electronAPI.getSetting<Partial<DesktopLyricSetting>>(
        DESKTOP_LYRIC_SETTING_KEY
      );
      if (record?.value) {
        this.desktopLyric = normalizeDesktopLyricSetting({
          ...this.desktopLyric,
          ...record.value,
        });
      } else {
        await this.saveDesktopLyricSetting();
      }
      await this.sendConfig();
      electronAPI.lockLyric(this.desktopLyric.locked);
    },
    async saveDesktopLyricSetting() {
      const setting = normalizeDesktopLyricSetting(this.desktopLyric);
      this.desktopLyric = setting;
      await electronAPI.setSetting(DESKTOP_LYRIC_SETTING_KEY, setting, 1);
    },
    async sendToLyricWindow() {
      await electronAPI.setLyrics({
        type: this.setting.useKRC ? "krc" : "lrc",
        data: this.setting.useKRC ? JSON.stringify(this.AMKrc) : JSON.stringify(this.AMLrc),
      });
      await electronAPI.updateTime(this.currentTime);
    },
    async sendConfig() {
      await electronAPI.setLyricStyle({
        width: this.desktopLyric.width,
        height: this.desktopLyric.height,
        maxSize: this.desktopLyric.maxSize,
        minSize: this.desktopLyric.minSize,
        fontSize: this.desktopLyric.fontSize,
        fontFamily: this.desktopLyric.fontFamily,
        textColor: this.desktopLyric.textColor,
        highlightColor: this.desktopLyric.highlightColor,
        fontWeight: this.desktopLyric.fontWeight,
      });
    },
    setDesktopLocked(locked: boolean) {
      this.desktopLyric.locked = locked;
      electronAPI.lockLyric(locked);
      void this.saveDesktopLyricSetting();
    },
    syncDesktopLocked(locked: boolean) {
      this.desktopLyric.locked = locked;
      void this.saveDesktopLyricSetting();
    },
  },
});

function normalizeDesktopLyricSetting(input: Partial<DesktopLyricSetting>): DesktopLyricSetting {
  return {
    width: Number(input.width ?? 800),
    height: Number(input.height ?? 120),
    maxSize: Number(input.maxSize ?? 64),
    minSize: Number(input.minSize ?? 10),
    fontSize: Number(input.fontSize ?? 28),
    fontFamily: String(input.fontFamily || '"Microsoft YaHei", "PingFang SC", sans-serif'),
    textColor: String(input.textColor || "#fff"),
    highlightColor: String(input.highlightColor || "#1871FD"),
    fontWeight: Number(input.fontWeight ?? 600),
    locked: Boolean(input.locked),
  };
}

async function fetchSongLyric(song: Song): Promise<LyricPayload> {
  try {
    if (song.source === "qq") return emptyLyric();
    return fetchLyricsByMusicApi(song);
  } catch (error: any) {
    void electronAPI.reportError(error, {
      scope: "lyric",
      action: "fetchSongLyric",
      songId: song.id,
      source: song.source,
    });
    return {
      krc: error?.message || "",
      lrc: error?.message || "",
    };
  }
}
