import type {
  CloudMusicSearchResult,
  CloudMusicSummary,
  CloudMusicTrackDto,
} from "@/types/cloudMusic";

export async function getCloudSummary(): Promise<CloudMusicSummary> {
  return window.electronAPI.getCloudMusicSummary();
}

export async function searchCloudMusic(params?: {
  keyword?: string;
  offset?: number;
  limit?: number;
}): Promise<CloudMusicSearchResult> {
  return window.electronAPI.searchCloudMusic(params);
}

export async function getCloudTrack(uuid: string): Promise<CloudMusicTrackDto> {
  return window.electronAPI.getCloudMusicTrack(uuid);
}
