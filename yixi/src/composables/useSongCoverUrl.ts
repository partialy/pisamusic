import { computed, ref, watch, type Ref } from "vue";
import type { Song } from "@/types/song";
import { getSongCoverCandidates } from "@/utils/songCoverUrl";
import electronAPI from "@/utils/electron";
import { defaultSongCover } from "@/utils/common";


export function useSongCoverUrl(song: Ref<Song | null | undefined>, size: number = 240) {
  const candidateIndex = ref(0);
  watch(() => song.value, () => { candidateIndex.value = 0; });
  const localCoverUrl = ref("");

  const coverUrl = computed(() => {
    const current = song.value;
    if (!current) return defaultSongCover;
    if (current.source === "local") return localCoverUrl.value || defaultSongCover;
    return getSongCoverCandidates(current, size)[candidateIndex.value] || defaultSongCover;
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

  function onCoverError() {
    const current = song.value;
    if (!current || current.source === "local") return;
    if (candidateIndex.value < getSongCoverCandidates(current, size).length) {
      candidateIndex.value++;
    }
  }

  return { coverUrl, onCoverError };
}

function localSongPath(song?: Song | null) {
  if (song?.source !== "local") return "";
  return song.filePath || song.urlParam || "";
}
