export type PlaylistCoverSelection = { assetId: string; preview: string };
export type PlaylistCoverChoice = { kind: "keep" } | { kind: "local"; assetId: string } | { kind: "default" } | { kind: "preset"; preset: string };
export type PlaylistCoverStatus = { state: "local" | "queued" | "uploading" | "failed" | "ready" | "synced"; message: string; canRetry: boolean };
export type PlaylistEditInput = { playlistId?: string; identityRevision: number; name: string; desc: string; tags: { id: string; name: string }[]; coverChoice: PlaylistCoverChoice };
export type PlaylistLocalCoverView = { coverLocalPreview?: string; coverUploadStatus?: PlaylistCoverStatus };
export const PLAYLIST_COVER_PRESETS = ["local_chill", "local_focus", "local_gaming", "local_jazz", "local_pop", "local_workout"] as const;
