import type { LyricLine as AMLyricLine } from "@applemusic-like-lyrics/core";
import { defineStore } from "pinia";
import type { Song } from "@/types/song";
import { fetchLyricsByMusicApi } from "@/utils/api/musicAPI";
import { LyricParser, type LyricLine } from "@/utils/common/LyricParser";
import electronAPI from "@/utils/electron";
import { getDefaultLyricSetting, normalizeLyricSetting, type LyricSetting } from "@/utils/lyricSettings";
export type { LyricSetting } from "@/utils/lyricSettings";
import {
  findLyricLineIndex,
  getLyricLineText,
  normalizePlaybackTimeToMs,
} from "@/utils/lyricLine";

type WordLyricFormat = "krc" | "yrc" | null;

type LyricPayload = {
  krc: string;
  lrc: string;
};

type PreferredLyricSource = "word" | "line" | "none";

const emptyLyric = (): LyricPayload => ({ krc: "", lrc: "" });

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
    setting: getDefaultLyricSetting(),
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
      if (!state.setting.useKRC) {
        // 只有逐字源时合并为单词行，让 AM 按整句模式展示。
        return state.AMWordLyrics.map((line) => ({
          ...line,
          words: [{ startTime: line.startTime, endTime: line.endTime, word: line.words.map((word) => word.word).join("") }],
        }));
      }
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
      Object.assign(this.setting, normalizeLyricSetting(this.setting));
      localStorage.setItem("pisa-lyric-setting", JSON.stringify(this.setting));
    },
    updateSetting(patch: Partial<LyricSetting>) {
      Object.assign(this.setting, normalizeLyricSetting({ ...this.setting, ...patch }));
      this.saveSetting();
    },
    resetBackgroundToDefault() {
      const defaults = getDefaultLyricSetting();
      this.updateSetting({
        backgroundMode: defaults.backgroundMode,
        backgroundImage: defaults.backgroundImage,
        backgroundBlur: defaults.backgroundBlur,
        backgroundBrightness: defaults.backgroundBrightness,
        backgroundFlowSpeed: defaults.backgroundFlowSpeed,
        backgroundFps: defaults.backgroundFps,
        backgroundRenderScale: defaults.backgroundRenderScale,
      });
    },
    loadSetting() {
      try {
        const setting = localStorage.getItem("pisa-lyric-setting");
        Object.assign(this.setting, normalizeLyricSetting(setting ? JSON.parse(setting) : null));
      } catch (error) {
        Object.assign(this.setting, getDefaultLyricSetting());
        void electronAPI.reportError(error, { scope: "lyric", action: "loadSetting" });
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
