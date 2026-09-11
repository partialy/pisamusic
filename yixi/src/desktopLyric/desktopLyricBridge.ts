import { watch } from "vue";
import type {
  DesktopLyricLine,
  DesktopLyricPayload,
  DesktopLyricWord,
} from "@/types/desktopLyric";
import { useAudioStore } from "@/store/audio";
import { useLyricStore } from "@/store/lyricStore";
import { useDesktopLyricStore } from "@/store/desktopLyric";

export function secondsToMilliseconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds * 1000);
}

export function buildDesktopLyricPayload(options: {
  useWordTiming: boolean;
  lines: any[];
}): DesktopLyricPayload {
  const { useWordTiming, lines } = options;
  if (!Array.isArray(lines) || lines.length === 0) {
    return {
      kind: "line",
      lines: [],
    };
  }

  if (useWordTiming) {
    const wordLines: DesktopLyricLine[] = [];
    for (const l of lines) {
      if (!l) continue;
      const startTimeMs = Math.round(Number(l.startTime ?? l.startTimeMs ?? 0));
      const endTimeMs = Math.round(Number(l.endTime ?? l.endTimeMs ?? startTimeMs + 3000));
      const rawWords = Array.isArray(l.words) ? l.words : [];
      const words: DesktopLyricWord[] = rawWords.map((w: any) => ({
        text: String(w.word ?? w.text ?? ""),
        startTimeMs: Math.round(Number(w.startTime ?? w.startTimeMs ?? 0)),
        endTimeMs: Math.round(Number(w.endTime ?? w.endTimeMs ?? 0)),
      }));
      const text = l.text ? String(l.text) : words.map((w) => w.text).join("");
      wordLines.push({
        startTimeMs,
        endTimeMs,
        text,
        words,
      });
    }

    const hasAnyWords = wordLines.some((wl) => wl.words.length > 0);
    if (hasAnyWords) {
      return {
        kind: "word",
        lines: wordLines,
      };
    }
  }

  const lineResult: DesktopLyricLine[] = lines.map((l: any) => {
    const startTimeMs = Math.round(Number(l?.startTime ?? l?.startTimeMs ?? 0));
    const endTimeMs = Math.round(Number(l?.endTime ?? l?.endTimeMs ?? startTimeMs + 3000));
    let text = "";
    if (typeof l?.text === "string") {
      text = l.text;
    } else if (Array.isArray(l?.words)) {
      text = l.words.map((w: any) => String(w?.word ?? w?.text ?? "")).join("");
    }
    return {
      startTimeMs,
      endTimeMs,
      text,
      words: [],
    };
  });

  return {
    kind: "line",
    lines: lineResult,
  };
}

export function setupDesktopLyricBridge(): () => void {
  const audioStore = useAudioStore();
  const lyricStore = useLyricStore();
  const desktopLyricStore = useDesktopLyricStore();

  void desktopLyricStore.initialize();

  const unwatchLyric = watch(
    [() => lyricStore.preferredAmLyrics, () => lyricStore.isKaraokeLyricEnabled],
    ([lines, useWordTiming]) => {
      const payload = buildDesktopLyricPayload({
        useWordTiming: Boolean(useWordTiming),
        lines,
      });
      window.electronAPI?.setDesktopLyricPayload?.(payload);
    },
    { immediate: true, deep: false },
  );

  let lastTimeMs = -1;
  const unwatchTime = watch(
    () => audioStore.currentTime,
    (timeSec) => {
      const posMs = secondsToMilliseconds(timeSec);
      if (Math.abs(posMs - lastTimeMs) < 20) return;
      lastTimeMs = posMs;
      window.electronAPI?.syncDesktopLyricClock?.({
        positionMs: posMs,
        isPlaying: audioStore.isPlaying,
        discontinuity: false,
      });
    },
  );

  const unwatchPlaying = watch(
    () => audioStore.isPlaying,
    (isPlaying) => {
      const posMs = secondsToMilliseconds(audioStore.currentTime);
      lastTimeMs = posMs;
      window.electronAPI?.syncDesktopLyricClock?.({
        positionMs: posMs,
        isPlaying,
        discontinuity: false,
      });
    },
  );

  const unwatchSong = watch(
    () => audioStore.currentSong,
    () => {
      lastTimeMs = 0;
      window.electronAPI?.syncDesktopLyricClock?.({
        positionMs: 0,
        isPlaying: audioStore.isPlaying,
        discontinuity: true,
      });
    },
  );

  const unsubs: Array<() => void> = [];

  if (window.electronAPI?.onLyricWindowStatus) {
    unsubs.push(
      window.electronAPI.onLyricWindowStatus((status) => {
        desktopLyricStore.setVisible(status);
      }),
    );
  }

  if (window.electronAPI?.onLyricLockedStatus) {
    unsubs.push(
      window.electronAPI.onLyricLockedStatus((locked) => {
        desktopLyricStore.setting.locked = locked;
      }),
    );
  }

  if (window.electronAPI?.onBoundsChanged) {
    unsubs.push(
      window.electronAPI.onBoundsChanged((bounds) => {
        desktopLyricStore.setting.bounds.width = bounds.width;
        desktopLyricStore.setting.bounds.height = bounds.height;
      }),
    );
  }

  return () => {
    unwatchLyric();
    unwatchTime();
    unwatchPlaying();
    unwatchSong();
    unsubs.forEach((unsub) => unsub());
  };
}
