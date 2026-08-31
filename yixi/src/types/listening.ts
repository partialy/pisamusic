export type ListeningSource = "kg" | "wy" | "kw" | "cloud" | "local";
export type ListeningTerminalReason = "natural_end" | "manual_next" | "stop" | "error" | "app_exit";

export type ListeningTrackSnapshot = {
  source: ListeningSource;
  songId: string;
  title: string;
  artist: string;
  album: string;
  trackDurationMs: number | null;
};

export type ListeningPlaybackObservation = {
  track: ListeningTrackSnapshot | null;
  active: boolean;
  terminalReason: ListeningTerminalReason | null;
};

export type ListeningFragment = ListeningTrackSnapshot & {
  eventId: string;
  playSessionId: string;
  startedAtMs: number;
  endedAtMs: number;
  activeDurationMs: number;
  terminalReason: ListeningTerminalReason | null;
};

export type ListeningSummary = {
  totalMs: number;
  totalMinutes: number;
  level: { level: number; minMinutes: number; maxMinutes: number | null };
};

export type ListeningBatchResult = {
  accepted: string[];
  duplicate: string[];
  rejected: Array<{ eventId: string; reason: string }>;
  summary: ListeningSummary;
  serverTimeMs: number;
};
