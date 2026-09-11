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
  immersiveMode?: boolean;
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
  backgroundMode?: "default" | "image";
  backgroundImage?: string;
  backgroundBlur?: number;
  backgroundBrightness?: number;
}

type WordLyricFormat = "krc" | "yrc" | null;

type LyricPayload = {
  krc: string;
  lrc: string;
};

type PreferredLyricSource = "word" | "line" | "none";

const emptyLyric = (): LyricPayload => ({ krc: "", lrc: "" });

const defaultLyricSetting = (): LyricSetting => ({

  useAMLyric: true,
  useKRC: true,
  pureLyricMode: false,
  immersiveMode: false,
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
  backgroundMode: "default",
  backgroundImage: "",
  backgroundBlur: 0,
  backgroundBrightness: 100,
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
    saveSetting() {
      localStorage.setItem("pisa-lyric-setting", JSON.stringify(this.setting));
    },
    resetBackgroundToDefault() {
      this.setting.backgroundMode = "default";
      this.setting.backgroundImage = "";
      this.setting.backgroundBlur = 0;
      this.setting.backgroundBrightness = 100;
      this.saveSetting();
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
