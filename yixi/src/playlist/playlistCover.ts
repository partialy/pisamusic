import type { CommonPlaylist } from "@/types/song";
import { PLAYLIST_COVER_PRESETS } from "@/types/playlistCover";
import { getKgImageUrl, getWyCoverSizeUrl, normalizeCoverOriginal } from "@/utils/songCoverUrl";
import defaultCover from "@/assets/images/default-created-playlist-cover.svg";
const names = ["轻松", "专注", "游戏", "爵士", "流行", "运动"];
const colors = ["#59847a", "#596e99", "#8c67ab", "#9d7654", "#b56f8f", "#b88154"];
export const playlistCoverPresets = PLAYLIST_COVER_PRESETS.map((id, index) => ({ id, name: names[index], image: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480"><rect width="480" height="480" fill="${colors[index]}"/><circle cx="240" cy="210" r="125" fill="none" stroke="white" stroke-opacity=".18" stroke-width="42"/><path d="M285 118v173a44 44 0 1 1-24-39V160l-105 23v137a44 44 0 1 1-24-39V153z" fill="white" fill-opacity=".88"/><text x="240" y="422" fill="white" text-anchor="middle" font-family="sans-serif" font-size="32">${names[index]}</text></svg>`)}` }));
export function getPlaylistCover(playlist?: CommonPlaylist | null, size = 480) {
  if (!playlist) return defaultCover;
  if (playlist.coverLocalPreview && playlist.coverUploadStatus?.state !== "synced") return playlist.coverLocalPreview;
  const preset = playlistCoverPresets.find(item => item.id === playlist.coverPreset || item.id === playlist.cover.replace(/^preset:/, ""));
  if (preset) return preset.image;
  if (!playlist.cover) return playlist.coverLocalPreview || defaultCover;
  return getWyCoverSizeUrl(getKgImageUrl(normalizeCoverOriginal("kg", playlist.cover), size), size, defaultCover);
}
export function playlistCoverFallback(event: Event, playlist?: CommonPlaylist) {
  const image = event.target as HTMLImageElement;
  const fallback = playlist?.coverLocalPreview || defaultCover;
  if (image.src !== fallback) image.src = fallback;
}
