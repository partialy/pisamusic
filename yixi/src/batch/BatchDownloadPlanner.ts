import type { Song } from "@/types/song";
import { batchSongKey } from "@/composables/useBatchSelection";
import { isQualitySource, type QualitySource } from "@/utils/musicQuality";

export function planBatchDownloads(songs: readonly Song[]) {
  const groups = new Map<QualitySource, Song[]>();
  const keys = new Set<string>();
  let skipped = 0;
  for (const song of songs) {
    const key = batchSongKey(song);
    if (!isQualitySource(song.source) || song.playable === false || keys.has(key)) { skipped++; continue; }
    keys.add(key);
    const group = groups.get(song.source) ?? [];
    group.push(song);
    groups.set(song.source, group);
  }
  return { groups, skipped, count: keys.size, total: songs.length };
}
