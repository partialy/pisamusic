import { ref } from "vue";
import type { Song } from "@/types/song";
import type DownloadSongDialog from "@/components/player/DownloadSongDialog.vue";

export function useSongDownload() {
  const downloadDialogRef = ref<InstanceType<typeof DownloadSongDialog> | null>(null);

  function openDownloadDialog(song: Song | null | undefined) {
    void downloadDialogRef.value?.open(song);
  }

  return {
    downloadDialogRef,
    openDownloadDialog,
  };
}
