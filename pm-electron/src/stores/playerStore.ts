import { Howl } from "howler";
import { create } from "zustand";
import type { LyricResult, TrackSearchResult } from "@shared/music";

type PlayerState = {
  queue: TrackSearchResult[];
  currentIndex: number;
  currentTrack: TrackSearchResult | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  progress: number;
  duration: number;
  volume: number;
  lyrics: Record<string, LyricResult>;
  setVolume: (volume: number) => void;
  playTrack: (track: TrackSearchResult, queue?: TrackSearchResult[]) => Promise<void>;
  togglePlay: () => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (seconds: number) => void;
  restoreQueue: (queue: TrackSearchResult[], currentIndex: number) => void;
};

let howl: Howl | null = null;
let progressTimer: number | null = null;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  currentTrack: null,
  isPlaying: false,
  isLoading: false,
  error: null,
  progress: 0,
  duration: 0,
  volume: 0.8,
  lyrics: {},

  setVolume: (volume) => {
    const clamped = Math.min(1, Math.max(0, volume));
    howl?.volume(clamped);
    set({ volume: clamped });
  },

  playTrack: async (track, nextQueue) => {
    const queue = nextQueue?.length ? nextQueue : ensureTrackInQueue(get().queue, track);
    const currentIndex = Math.max(0, queue.findIndex((item) => item.source === track.source && item.id === track.id));
    set({ queue, currentIndex, currentTrack: track, isLoading: true, error: null, progress: 0 });
    await window.pisa.library.saveQueueSnapshot({ queue, currentIndex, updatedAt: Date.now() });
    await startHowl(track);
  },

  togglePlay: () => {
    if (!howl) {
      const track = get().currentTrack;
      if (track) void get().playTrack(track, get().queue);
      return;
    }
    if (get().isPlaying) {
      howl.pause();
      set({ isPlaying: false });
      void window.pisa.player.setPlaybackState({ isPlaying: false, title: get().currentTrack?.title });
    } else {
      howl.play();
      set({ isPlaying: true });
      void window.pisa.player.setPlaybackState({ isPlaying: true, title: get().currentTrack?.title });
    }
  },

  next: async () => {
    const { queue, currentIndex } = get();
    if (!queue.length) return;
    const nextIndex = currentIndex + 1 < queue.length ? currentIndex + 1 : 0;
    await get().playTrack(queue[nextIndex], queue);
  },

  previous: async () => {
    const { queue, currentIndex } = get();
    if (!queue.length) return;
    const previousIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : queue.length - 1;
    await get().playTrack(queue[previousIndex], queue);
  },

  seek: (seconds) => {
    if (!howl) return;
    howl.seek(seconds);
    set({ progress: seconds });
  },

  restoreQueue: (queue, currentIndex) => {
    const currentTrack = queue[currentIndex] ?? null;
    set({ queue, currentIndex, currentTrack });
  },
}));

async function startHowl(track: TrackSearchResult): Promise<void> {
  disposeHowl();
  try {
    const { url } = await window.pisa.music.resolveUrl({ track });
    const state = usePlayerStore.getState();
    howl = new Howl({
      src: [url],
      html5: true,
      volume: state.volume,
      preload: true,
      onload: () => {
        usePlayerStore.setState({ duration: howl?.duration() || track.duration || 0, isLoading: false });
      },
      onplay: () => {
        usePlayerStore.setState({ isPlaying: true, isLoading: false });
        void window.pisa.player.setPlaybackState({ isPlaying: true, title: track.title });
        startProgressTimer();
      },
      onpause: () => {
        usePlayerStore.setState({ isPlaying: false });
        stopProgressTimer();
      },
      onend: () => {
        stopProgressTimer();
        void usePlayerStore.getState().next();
      },
      onloaderror: () => handlePlaybackFailure(),
      onplayerror: () => handlePlaybackFailure(),
    });
    howl.play();
    void window.pisa.library.addPlayHistory(track);
    void window.pisa.music.getLyric({ track }).then((lyric) => {
      usePlayerStore.setState((current) => ({
        lyrics: { ...current.lyrics, [`${track.source}:${track.id}`]: lyric },
      }));
    });
  } catch {
    handlePlaybackFailure();
  }
}

function handlePlaybackFailure(): void {
  disposeHowl();
  usePlayerStore.setState({
    isLoading: false,
    isPlaying: false,
    error: "播放失败，可尝试切换其他音源",
  });
  window.setTimeout(() => {
    void usePlayerStore.getState().next();
  }, 900);
}

function ensureTrackInQueue(queue: TrackSearchResult[], track: TrackSearchResult): TrackSearchResult[] {
  if (queue.some((item) => item.source === track.source && item.id === track.id)) return queue;
  return [...queue, track];
}

function startProgressTimer(): void {
  stopProgressTimer();
  progressTimer = window.setInterval(() => {
    if (!howl) return;
    const seek = howl.seek();
    usePlayerStore.setState({ progress: typeof seek === "number" ? seek : 0, duration: howl.duration() || 0 });
  }, 500);
}

function stopProgressTimer(): void {
  if (progressTimer !== null) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }
}

function disposeHowl(): void {
  stopProgressTimer();
  if (howl) {
    howl.unload();
    howl = null;
  }
}
