import type { Song } from "@/types/song";
import directAPI from "@/utils/api/directAPI";
import { parseYrc as amParseYrc } from "@applemusic-like-lyrics/lyric";
import {
  convertKrcToAMLyricLine,
  convertLrcToAMLyricLine,
  parseKrc,
  parseLrc,
  type MyLyricLine,
} from "@/utils/lyricUtil";
import type { LyricLine } from "@applemusic-like-lyrics/core";
import { defineStore } from "pinia";
import electronAPI from "@/utils/electron";

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
export const useLyricStore = defineStore("lyric", {
  state: () => ({
    rawLrc: "",
    rawKrc: "",
    parsedLrc: [] as MyLyricLine[],
    parsedKrc: [] as MyLyricLine[],
    AMKrc: [] as LyricLine[],
    AMLrc: [] as LyricLine[],
    currentId: "",
    currentTime: 0, // 秒
    lyricLoading: false,
    currentSong: null as Song | null,
    desktop: false,
    desktopLyric: {
        maxSize: 64,
        minSize: 10,
        fontSize: 28,
        fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
        textColor: "#fff",
        highlightColor: "#1871FD",
        fontWeight: 600,
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
        (item) =>
          item.time <= this.currentTime && item.endTime!! >= this.currentTime
      );
    },
    get currentIndexKRC() {
      return this.parsedKrc.findIndex(
        (item) =>
          item.time <= this.currentTime && item.endTime!! >= this.currentTime
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
      let lyric = { krc: "暂无歌词", lrc: "暂无歌词" };
      if (this.currentSong) {
        if (
          this.currentSong.id == this.currentId &&
          (this.rawKrc || this.rawLrc)
        )
          return;
        this.currentId = this.currentSong.id;
        switch (this.currentSong.source) {
          case "kg":
            lyric = await fetchKGLyric(this.currentSong.urlParam);
            break;
          case "wy":
            lyric = await fetchWYLyric({
              id: this.currentSong.id,
            });
            break;
          case "kw":
            break;
          case "qq":
            break;
          default:
        }
        const { krc, lrc } = lyric;
        this.rawKrc = krc;
        this.rawLrc = lrc;
        this.parsedKrc = krc ? parseKrc(krc) : [];
        this.parsedLrc = lrc ? parseLrc(lrc) : [];
        if (this.currentSong.source == "wy") {
          this.AMKrc = krc ? amParseYrc(this.rawKrc) : [];
        } else {
          this.AMKrc = krc ? convertKrcToAMLyricLine(this.parsedKrc) : [];
        }
        this.AMLrc = lrc ? convertLrcToAMLyricLine(this.parsedLrc) : [];
        setTimeout(() => {
          this.sendToLyricWindow();
        }, 100);
      }
    },
    setDesktop(de:boolean) {
      this.desktop = de;
      electronAPI.setStore("lyricConfig.desktop", de);
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
    async sendToLyricWindow() {
      await electronAPI.setLyrics({
        type: this.setting.useKRC ? "krc" : "lrc",
        data: this.setting.useKRC ? JSON.stringify(this.AMKrc) : JSON.stringify(this.AMLrc),
      });
      await electronAPI.updateTime(this.currentTime);
    },
    async sendConfig() {
      await electronAPI.setLyricStyle({
        maxSize: this.desktopLyric.maxSize,
        minSize: this.desktopLyric.minSize,
        fontSize: this.desktopLyric.fontSize,
        fontFamily: this.desktopLyric.fontFamily,
        textColor: this.desktopLyric.textColor,
        highlightColor: this.desktopLyric.highlightColor,
        fontWeight: this.desktopLyric.fontWeight,
      });
    }
  },
});

async function fetchKGLyric(hash: string): Promise<{
  krc: string;
  lrc: string;
}> {
  try {
    const r1 = await directAPI.kg?.searchLyric(hash);
    if (r1) {
      const [krcRes, lrcRes] = await Promise.all([
        directAPI.kg?.lyric({
          id: r1.candidates[0].id,
          accesskey: r1.candidates[0].accesskey,
          decode: true,
          fmt: "krc",
        }),
        directAPI.kg?.lyric({
          id: r1.candidates[0].id,
          accesskey: r1.candidates[0].accesskey,
          decode: true,
          fmt: "lrc",
        }),
      ]);

      const res = {
        krc: "",
        lrc: "",
      };

      if (krcRes?.decodeContent) {
        res.krc = krcRes.decodeContent;
      }

      if (lrcRes?.decodeContent) {
        res.lrc = lrcRes.decodeContent;
      }
      return res;
    }
    return {
      krc: "网络异常，获取歌词失败",
      lrc: "网络异常，获取歌词失败",
    };
  } catch (error: any) {
    console.log(error);
    return {
      krc: error?.message || "",
      lrc: error?.message || "",
    };
  }
}

async function fetchWYLyric(params: { id: string }) {
  try {
    const [kr, lr] = await Promise.all([
      directAPI.wy?.lyricNew(params),
      directAPI.wy?.lyric(params),
    ]);
    // @ts-ignore
    console.log(kr.yrc?.lyric);
    return {
      // @ts-ignore
      krc: kr?.yrc?.lyric || "",
      lrc: lr?.lrc.lyric,
    };
  } catch (error: any) {
    return {
      krc: error?.message || "",
      lrc: error?.message || "",
    };
  }
}
