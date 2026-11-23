import type { CommonPlaylist } from "@/types/song";
import { useMineLibraryStore } from "@/store";
import { captureLibraryRevision, isCurrentLibraryRevision } from "@/utils/libraryIdentity";

export function usePlaylistManagement() {
  const store = useMineLibraryStore();

  async function confirmDelete(playlist: CommonPlaylist, onDeleted?: () => void) {
    const isLocal = playlist.source === "local";
    const revision = await captureLibraryRevision();
    window.$dialog.warning({
      title: isLocal ? "删除自建歌单？" : "移除导入歌单？",
      content: isLocal
        ? `将删除「${playlist.name}」及歌单内的歌曲关系，不删除音频文件。此操作会同步至当前账号其他设备。`
        : `将从我的歌单移除「${playlist.name}」，不会影响第三方平台原歌单。`,
      positiveText: isLocal ? "删除歌单" : "移除歌单",
      negativeText: "取消",
      onPositiveClick: async () => {
        if (!isCurrentLibraryRevision(revision)) {
          window.$message.warning("账号已变化，请重新确认");
          return false;
        }
        try {
          const removed = await store.removePlaylist(
            { source: playlist.source, id: playlist.id },
            revision
          );
          if (!isCurrentLibraryRevision(revision)) return false;
          if (!removed) {
            window.$message.warning("歌单已不存在");
            onDeleted?.();
            return;
          }
          window.$message.success(isLocal ? "歌单已删除" : "歌单已移除");
          onDeleted?.();
        } catch (error) {
          if (isCurrentLibraryRevision(revision)) {
            window.$message.error(
              error instanceof Error ? error.message : isLocal ? "删除歌单失败" : "移除歌单失败"
            );
          }
          return false;
        }
      },
    });
  }

  return { confirmDelete };
}
