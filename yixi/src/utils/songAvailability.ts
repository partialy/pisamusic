import type { Song } from "@/types/song";
const localSyncId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function isSongPlayable(song: Song | null | undefined): boolean {
  return Boolean(song && song.playable !== false && (song.source !== "local" || (!localSyncId.test(song.id) && Boolean(song.filePath))));
}
export async function resolvePlayableSongs(songs: Song[]): Promise<Song[]> {
  const tracks = songs.map(song => ({ ...song }));
  if (!tracks.some(song => song.source === "local")) return tracks;
  const resolved = await window.electronAPI.resolveLocalTracks(tracks);
  return resolved as Song[];
}
