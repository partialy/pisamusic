import type { DatabaseSync } from "node:sqlite";
import type { PlaylistSnapshot } from "../database/types";
export const PLAYLIST_COVER_JOBS_KEY = "main/private/playlist-cover-jobs";
export function playlistCoverFingerprint(value: PlaylistSnapshot) { return JSON.stringify([value.cover || "", value.coverResource?.resourceId ?? null, value.coverPreset ?? null]); }
/** Repository 用户事务内更新封面代次对应的最近真实编辑时钟；远端回声不推进。 */
export function notePlaylistUserEdit(db: DatabaseSync, userId: string, playlistId: string, playlist: PlaylistSnapshot, editedAt: string) {
  const row = db.prepare("SELECT value_json FROM settings WHERE key = ?").get(PLAYLIST_COVER_JOBS_KEY) as { value_json: string } | undefined;
  if (!row) return;
  const all = JSON.parse(row.value_json) as Record<string, { expectedLocalCover: string; editedAt: number }>;
  const key = JSON.stringify([userId, playlistId]);
  const job = all[key];
  if (!job) return;
  if (job.expectedLocalCover !== playlistCoverFingerprint(playlist)) delete all[key];
  else job.editedAt = Date.parse(editedAt);
  db.prepare("UPDATE settings SET value_json = ?, updated_at = ? WHERE key = ?").run(JSON.stringify(all), editedAt, PLAYLIST_COVER_JOBS_KEY);
}
