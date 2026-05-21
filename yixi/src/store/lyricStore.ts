import type { LyricLine as AMLyricLine } from "@applemusic-like-lyrics/core";
import { defineStore } from "pinia";
import type { Song } from "@/types/song";
import { fetchLyricsByMusicApi } from "@/utils/api/musicAPI";
import { LyricParser, type LyricLine } from "@/utils/common/LyricParser";
import electronAPI from "@/utils/electron";
import {
  findLyricLineIndex,
  getLyricLineText,
  normalizePlaybackTimeToMs,
} from "@/utils/lyricLine";

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

type WordLyricFormat = "krc" | "yrc" | null;

type LyricPayload = {
  krc: string;
  lrc: string;
};

type DesktopLyricSetting = {
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  highlightColor: string;
  fontWeight: number;
  locked: boolean;
  overlayTaskbar: boolean;
};

type PreferredLyricSource = "word" | "line" | "none";

const emptyLyric = (): LyricPayload => ({ krc: "", lrc: "" });
const DESKTOP_LYRIC_SETTING_KEY = "desktop-lyric-setting";

const defaultLyricSetting = (): LyricSetting => ({
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
});

export const useLyricStore = defineStore("lyric", {
  state: () => ({
    rawWordLyric: "",
    rawLineLyric: "",
    wordLyricFormat: null as WordLyricFormat,
    wordLyrics: [] as LyricLine[],
    lineLyrics: [] as LyricLine[],
    AMWordLyrics: [] as AMLyricLine[],
    AMLineLyrics: [] as AMLyricLine[],
    currentId: "",
    currentLyricKey: "",
    currentTime: 0,
    lyricLoading: false,
    lyricLoaded: false,
    currentSong: null as Song | null,
    desktop: false,
    desktopLyric: {
      width: 800,
      height: 120,
      fontSize: 28,
      fontFamily: "Microsoft YaHei",
      textColor: "#fff",
      highlightColor: "#1871FD",
      fontWeight: 600,
      locked: false,
      overlayTaskbar: false,
    },
    setting: defaultLyricSetting(),
  }),
  getters: {
    rawKrc: (state) => state.rawWordLyric,
    rawLrc: (state) => state.rawLineLyric,
    AMKrc: (state) => state.AMWordLyrics,
    AMLrc: (state) => state.AMLineLyrics,
    currentTimeMs: (state) => normalizePlaybackTimeToMs(state.currentTime),
    hasLyric: (state) => state.wordLyrics.length > 0 || state.lineLyrics.length > 0,
    isKaraokeLyricEnabled: (state) => state.setting.useKRC && state.wordLyrics.length > 0,
    preferredLyrics(state): LyricLine[] {
      if (state.setting.useKRC && state.wordLyrics.length > 0) return state.wordLyrics;
      if (state.lineLyrics.length > 0) return state.lineLyrics;
      return state.wordLyrics;
    },
    preferredAmLyrics(state): AMLyricLine[] {
      if (state.setting.useKRC && state.AMWordLyrics.length > 0) return state.AMWordLyrics;
      if (state.AMLineLyrics.length > 0) return state.AMLineLyrics;
      return state.AMWordLyrics;
    },
    preferredLyricSource(state): PreferredLyricSource {
      if (state.setting.useKRC && state.wordLyrics.length > 0) return "word";
      if (state.lineLyrics.length > 0) return "line";
      if (state.wordLyrics.length > 0) return "word";
      return "none";
    },
    currentIndex(): number {
      return findLyricLineIndex(this.preferredLyrics, this.currentTimeMs);
    },
    currentLine(): LyricLine | null {
      return this.currentIndex >= 0 ? this.preferredLyrics[this.currentIndex] || null : null;
    },
    currentText(): string {
      return getLyricLineText(this.currentLine);
    },
    currentIndexLRC(): number {
      return findLyricLineIndex(this.lineLyrics, this.currentTimeMs);
    },
    currentIndexKRC(): number {
      return findLyricLineIndex(this.wordLyrics, this.currentTimeMs);
    },
    currentLineLRC(): LyricLine | null {
      return this.currentIndexLRC >= 0 ? this.lineLyrics[this.currentIndexLRC] || null : null;
    },
    currentLineKRC(): LyricLine | null {
      return this.currentIndexKRC >= 0 ? this.wordLyrics[this.currentIndexKRC] || null : null;
    },
  },
  actions: {
    async initLyric() {
      if (!this.currentSong) {
        this.resetLyricData();
        return;
      }

      const song = this.currentSong;
      const lyricKey = buildLyricKey(song);
      if (lyricKey === this.currentLyricKey && this.lyricLoaded) return;

      this.currentId = song.id;
      this.currentLyricKey = lyricKey;
      this.lyricLoading = true;

      const lyric = await fetchSongLyric(song);
      if (!this.currentSong || buildLyricKey(this.currentSong) !== lyricKey) {
        return;
      }

      this.applyLyricPayload(song, lyric);
      this.lyricLoading = false;
      setTimeout(() => {
        void this.sendToLyricWindow();
      }, 100);
    },
    applyLyricPayload(song: Song, lyric: LyricPayload) {
      const wordFormat = getWordLyricFormat(song.source, lyric.krc);
      const wordLyrics = parseWordLyrics(lyric.krc, wordFormat);
      const lineLyrics = lyric.lrc ? LyricParser.parseLrc(lyric.lrc) : [];

      this.rawWordLyric = lyric.krc;
      this.rawLineLyric = lyric.lrc;
      this.wordLyricFormat = wordFormat;
      this.wordLyrics = wordLyrics;
      this.lineLyrics = lineLyrics;
      this.AMWordLyrics = LyricParser.toAmLyric(wordLyrics);
      this.AMLineLyrics = LyricParser.toAmLyric(lineLyrics);
      this.lyricLoaded = true;
    },
    resetLyricData() {
      this.rawWordLyric = "";
      this.rawLineLyric = "";
      this.wordLyricFormat = null;
      this.wordLyrics = [];
      this.lineLyrics = [];
      this.AMWordLyrics = [];
      this.AMLineLyrics = [];
      this.currentId = "";
      this.currentLyricKey = "";
      this.lyricLoaded = false;
      this.lyricLoading = false;
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
        this.setting = {
          ...defaultLyricSetting(),
          ...JSON.parse(setting),
        };
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
        type: this.isKaraokeLyricEnabled ? "krc" : "lrc",
        data: JSON.stringify(this.preferredAmLyrics),
      });
      await electronAPI.updateTime(this.currentTime);
    },
    async sendConfig() {
      await electronAPI.setLyricStyle({
        width: this.desktopLyric.width,
        height: this.desktopLyric.height,
        overlayTaskbar: this.desktopLyric.overlayTaskbar,
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
    syncBounds(bounds: { width: number; height: number }) {
      this.desktopLyric.width = bounds.width;
      this.desktopLyric.height = bounds.height;
    },
  },
});

function getWordLyricFormat(source: Song["source"], rawLyric: string): WordLyricFormat {
  if (!rawLyric.trim()) return null;
  if (source === "kg") return "krc";
  if (source === "wy") return "yrc";
  return null;
}

function parseWordLyrics(rawLyric: string, format: WordLyricFormat) {
  if (!rawLyric || !format) return [];
  return format === "yrc" ? LyricParser.parseYrc(rawLyric) : LyricParser.parseKrc(rawLyric);
}

function normalizeDesktopLyricSetting(input: Partial<DesktopLyricSetting>): DesktopLyricSetting {
  return {
    width: Number(input.width ?? 800),
    height: Number(input.height ?? 120),
    fontSize: Number(input.fontSize ?? 28),
    fontFamily: String(input.fontFamily || "Microsoft YaHei"),
    textColor: String(input.textColor || "#fff"),
    highlightColor: String(input.highlightColor || "#1871FD"),
    fontWeight: Number(input.fontWeight ?? 600),
    locked: Boolean(input.locked),
    overlayTaskbar: Boolean(input.overlayTaskbar),
  };
}

function buildLyricKey(song: Song) {
  return `${song.source}:${song.id}:${song.urlParam || ""}`;
}

async function fetchSongLyric(song: Song): Promise<LyricPayload> {
  try {
    if (song.source === "qq" || song.source === "local") return emptyLyric();
    return fetchLyricsByMusicApi(song);
  } catch (error: any) {
    void electronAPI.reportError(error, {
      scope: "lyric",
      action: "fetchSongLyric",
      songId: song.id,
      source: song.source,
    });
    return emptyLyric();
  }
}
