import { defineStore } from "pinia";
import type { Song } from "@/types/song";
import electronAPI from "@/utils/electron";

type SearchHistoryView = {
  id: number;
  text: string;
  time: number;
};

type LegacySearchHistory = {
  text: string;
  time: number;
};

const SEARCH_HISTORY_MIGRATED_KEY = "search-history-sqlite-migrated";

export const useLibraryStore = defineStore("library", {
  state: () => ({
    searchHistory: [] as SearchHistoryView[],
    searchHistoryLoaded: false,
  }),
  actions: {
    async loadSearchHistory() {
      await this.migrateLegacySearchHistory();
      const list = await electronAPI.listSearchHistory(10);
      this.searchHistory = list.map((item) => ({
        id: item.id,
        text: item.keyword,
        time: Date.parse(item.createdAt) || Date.now(),
      }));
      this.searchHistoryLoaded = true;
    },

    async addSearchHistory(keyword: string, source?: string | null) {
      const text = keyword.trim();
      if (!text) return;
      await electronAPI.addSearchHistory({ keyword: text, source });
      await this.loadSearchHistory();
    },

    async deleteSearchHistory(id: number) {
      await electronAPI.deleteSearchHistory(id);
      await this.loadSearchHistory();
    },

    async clearSearchHistory() {
      await electronAPI.clearSearchHistory();
      this.searchHistory = [];
      localStorage.setItem("search-history", JSON.stringify([]));
    },

    async saveQueueSnapshot(currentIndex: number, queue: Song[]) {
      await electronAPI.saveQueueSnapshot({ currentIndex, queue });
    },

    async loadQueueSnapshot() {
      return electronAPI.getQueueSnapshot();
    },

    async addPlayHistory(song: Song) {
      await electronAPI.addPlayHistory(song);
    },

    async migrateLegacySearchHistory() {
      if (localStorage.getItem(SEARCH_HISTORY_MIGRATED_KEY) === "true") return;
      const raw = localStorage.getItem("search-history");
      if (!raw) {
        localStorage.setItem(SEARCH_HISTORY_MIGRATED_KEY, "true");
        return;
      }
      try {
        const legacy = JSON.parse(raw) as LegacySearchHistory[];
        const sorted = legacy
          .filter((item) => item.text?.trim())
          .sort((a, b) => a.time - b.time);
        for (const item of sorted) {
          await electronAPI.addSearchHistory({ keyword: item.text.trim() });
        }
      } catch {
        // 旧数据损坏时不阻塞新 SQLite 历史。
      }
      localStorage.setItem(SEARCH_HISTORY_MIGRATED_KEY, "true");
    },
  },
});
