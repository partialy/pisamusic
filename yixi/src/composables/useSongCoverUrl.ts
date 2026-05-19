import { computed, ref, watch, type Ref } from "vue";
import type { Song } from "@/types/song";
import electronAPI from "@/utils/electron";
import { defaultSongCover, getSongCover } from "@/utils/common";

type CoverSize = 120 | 240 | 360 | 480;

export function useSongCoverUrl(song: Ref<Song | null | undefined>, size: CoverSize = 120) {
  const localCoverUrl = ref("");

  const coverUrl = computed(() => {
    const current = song.value;
    if (!current) return defaultSongCover;
    if (current.source === "local") return localCoverUrl.value || defaultSongCover;
    return getSongCover(current, size);
  });

  watch(
    () => localSongPath(song.value),
    async (filePath) => {
      localCoverUrl.value = "";
      if (!filePath) return;
      const requestPath = filePath;
      const cover = await electronAPI.getLocalSongCover(requestPath).catch(() => "");
      if (localSongPath(song.value) === requestPath) {
        localCoverUrl.value = cover || "";
      }
    },
    { immediate: true }
  );

  return coverUrl;
}

function localSongPath(song?: Song | null) {
  if (song?.source !== "local") return "";
  return song.filePath || song.urlParam || "";
}
