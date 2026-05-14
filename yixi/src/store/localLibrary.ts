import { defineStore } from "pinia";
import electronAPI from "@/utils/electron";
import type { Song } from "@/types/song";
import { normalizeSong } from "@/utils/song";
import { reportError } from "@/utils/errorReporter";

type ScanStatus = Awaited<ReturnType<ElectronIpc["getLocalLibraryScanStatus"]>>;

const EMPTY_STATUS: ScanStatus = {
  scanning: false,
  lastStartedAt: "",
  lastFinishedAt: "",
  lastError: "",
  total: 0,
  directories: [],
  skipped: false,
};

export const useLocalLibraryStore = defineStore("localLibrary", {
  state: () => ({
    songs: [] as Song[],
    status: { ...EMPTY_STATUS } as ScanStatus,
    loaded: false,
  }),
  getters: {
    scanning: (state) => state.status.scanning,
  },
  actions: {
    async init() {
      if (this.loaded) return;
      await Promise.all([this.loadSongs(), this.loadStatus()]);
      this.bindScanEvents();
      this.loaded = true;
    },

    async loadSongs() {
      try {
        const songs = await electronAPI.listLocalSongs();
        this.songs = songs.map((song) => normalizeSong(song));
      } catch (error) {
        void reportError(error, { scope: "localLibrary", action: "loadSongs" });
      }
    },

    async loadStatus() {
      try {
        this.status = await electronAPI.getLocalLibraryScanStatus();
      } catch (error) {
        void reportError(error, { scope: "localLibrary", action: "loadStatus" });
      }
    },

    async refresh() {
      this.status = { ...this.status, scanning: true, lastError: "" };
      const nextStatus = await electronAPI.refreshLocalLibrary();
      this.status = nextStatus;
      await this.loadSongs();
    },

    bindScanEvents() {
      electronAPI.onLocalLibraryScanStarted((status) => {
        this.status = status;
      });
      electronAPI.onLocalLibraryScanFinished((status) => {
        this.status = status;
        void this.loadSongs();
      });
      electronAPI.onLocalLibraryScanFailed((status) => {
        this.status = status;
      });
    },
  },
});
