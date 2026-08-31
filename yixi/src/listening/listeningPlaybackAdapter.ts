import type { Song } from "@/types/song";
import type {
  ListeningPlaybackObservation,
  ListeningTerminalReason,
  ListeningTrackSnapshot,
} from "@/types/listening";

function toTrackSnapshot(song: Song | null, durationMs?: number): ListeningTrackSnapshot | null {
  if (!song || typeof song !== "object") return null;

  let durMs: number | null = null;
  if (typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0) {
    durMs = Math.round(durationMs);
  } else if (typeof song.duration === "number" && Number.isFinite(song.duration) && song.duration > 0) {
    durMs = Math.round(song.duration > 10000 ? song.duration : song.duration * 1000);
  }

  return {
    source: song.source as any,
    songId: String(song.id ?? "").trim(),
    title: String(song.name ?? "").trim(),
    artist: String(song.singer ?? "").trim(),
    album: String(song.album ?? "").trim(),
    trackDurationMs: durMs,
  };
}

function sendObservation(obs: ListeningPlaybackObservation): void {
  try {
    window.electronAPI?.observeListeningPlayback?.(obs);
  } catch (e) {
    console.warn("[listeningPlaybackAdapter] observe failed:", e);
  }
}

export const listeningPlaybackAdapter = {
  active(song: Song, durationMs?: number): void {
    sendObservation({
      track: toTrackSnapshot(song, durationMs),
      active: true,
      terminalReason: null,
    });
  },

  paused(song: Song | null, durationMs?: number): void {
    sendObservation({
      track: toTrackSnapshot(song, durationMs),
      active: false,
      terminalReason: null,
    });
  },

  terminal(
    song: Song | null,
    durationMs: number | undefined,
    reason: ListeningTerminalReason
  ): void {
    sendObservation({
      track: toTrackSnapshot(song, durationMs),
      active: false,
      terminalReason: reason,
    });
  },

  sync(song: Song | null, isPlaying: boolean, durationMs?: number): void {
    sendObservation({
      track: toTrackSnapshot(song, durationMs),
      active: Boolean(isPlaying && song),
      terminalReason: null,
    });
  },
};
