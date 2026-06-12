<template>
  <n-dropdown
    class="song-list-menu"
    placement="bottom-start"
    trigger="manual"
    style="border-radius: 8px; max-width: 220px"
    :x="x"
    :y="y"
    :show="show"
    :options="options"
    @select="show = false"
    @clickoutside="show = false" />
  <MediaDetailDialog ref="detailDialogRef" />
</template>

<script lang="ts" setup>
import { nextTick, ref } from "vue";
import { NDropdown, type DropdownOption } from "naive-ui";
import type { CommonPlaylist, Song } from "@/types/song";
import {
  AddToPlaylist,
  CollectIcon,
  DeleteIcon,
  MusicIcon,
  NextPlayIcon,
  PlayStatic,
  PlaylistAdd,
  SingerIcon,
} from "@/icons";
import { Download, Info } from "lucide-vue-next";
import { useCollectStore } from "@/store";
import { renderIcon } from "@/utils/common";
import { fetchAllPlaylistTracks } from "@/utils/playlistTracks";
import MediaDetailDialog from "@/components/common/MediaDetailDialog.vue";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";

const x = ref(0);
const y = ref(0);
const show = ref(false);
const options = ref<DropdownOption[]>([]);
const collector = useCollectStore();
const playbackCommands = usePlaybackCommands();
const detailDialogRef = ref<InstanceType<typeof MediaDetailDialog> | null>(null);
const props = withDefaults(defineProps<{
  removable?: boolean;
}>(), {
  removable: false,
});
const emit = defineEmits<{
  removeSong: [song: Song];
  downloadSong: [song: Song];
  detailSong: [song: Song];
  addToPlaylist: [song: Song];
}>();

const openContextMenu = (
  e: MouseEvent,
  prop: {
    type: "song" | "playlist";
    data: Song | CommonPlaylist | null;
  }
) => {
  e.preventDefault();
  nextTick().then(() => {
    options.value = prop.type === "song"
      ? createSongOptions(prop.data as Song)
      : createPlaylistOptions(prop.data as CommonPlaylist);
    x.value = e.clientX;
    y.value = e.clientY;
    show.value = true;
  });
};

const createSongOptions = (song: Song) => {
  const songOptions: DropdownOption[] = [
    {
      label: song.name,
      disabled: true,
      props: { title: song.name },
      icon: renderIcon(MusicIcon, {}, { size: 24 }),
      key: "music",
    },
    {
      label: song.singer,
      disabled: true,
      props: { title: song.singer },
      icon: renderIcon(SingerIcon, {}, { size: 24 }),
      key: "singer",
    },
    { type: "divider", key: "divider" },
    {
      label: "播放",
      props: {
        title: "播放",
        onClick: () => {
          playbackCommands.playSingle(song);
        },
      },
      icon: renderIcon(PlayStatic, {}, { size: 24 }),
      key: "play",
    },
    {
      label: "下一首播放",
      props: {
        title: "下一首播放",
        onClick: () => {
          playbackCommands.playNext(song);
        },
      },
      icon: renderIcon(NextPlayIcon, {}, { size: 24 }),
      key: "nextplay",
    },
    {
      label: "添加到播放列表",
      props: {
        title: "添加到播放列表",
        onClick: async () => {
          if (await playbackCommands.appendToPlaylist([song])) {
            window.$message.success(`已将 ${song.name} 添加到播放列表`);
          }
        },
      },
      icon: renderIcon(AddToPlaylist, {}, { size: 24 }),
      key: "add",
    },
    {
      label: "添加到歌单",
      props: {
        title: "添加到歌单",
        onClick: () => emit("addToPlaylist", song),
      },
      icon: renderIcon(PlaylistAdd, {}, { size: 24 }),
      key: "add-to-mine-playlist",
    },
    {
      label: collector.containsSong(song) ? "取消收藏" : "添加到收藏",
      props: {
        title: collector.containsSong(song) ? "取消收藏" : "添加到收藏",
        onClick: () => {
          collector.collectSong(song);
          window.$message.success(
            collector.containsSong(song)
              ? `已将 ${song.name} 从收藏中移除`
              : `已将 ${song.name} 添加到收藏`
          );
        },
      },
      icon: renderIcon(
        CollectIcon,
        {},
        { size: 24, color: collector.containsSong(song) ? "red" : "#999" }
      ),
      key: "collect",
    },
  ];

  if (song.source !== "local") {
    songOptions.push({
      label: "下载",
      props: {
        title: "下载",
        onClick: () => emit("downloadSong", song),
      },
      icon: renderIcon(Download, {}, { size: 22 }),
      key: "download",
    });
  }

  songOptions.push({
    label: "详情",
    props: {
      title: "详情",
      onClick: () => detailDialogRef.value?.openSong(song),
    },
    icon: renderIcon(Info, {}, { size: 22 }),
    key: "detail",
  });

  if (props.removable) {
    songOptions.push(
      { type: "divider", key: "remove-divider" },
      {
        label: "移除",
        props: {
          title: "移除",
          onClick: () => emit("removeSong", song),
        },
        icon: renderIcon(DeleteIcon, {}, { size: 24 }),
        key: "remove",
      }
    );
  }

  return songOptions;
};

const createPlaylistOptions = (playlist: CommonPlaylist) => {
  return [
    {
      label: "播放全部",
      props: {
        title: "播放全部",
        onClick: () => handlePlayPlaylist(playlist),
      },
      icon: renderIcon(PlayStatic, {}, { size: 24 }),
      key: "playlist-play-all",
    },
    {
      label: "添加到播放列表",
      props: {
        title: "添加到播放列表",
        onClick: () => handleAddPlaylist(playlist),
      },
      icon: renderIcon(AddToPlaylist, {}, { size: 24 }),
      key: "playlist-add",
    },
    {
      label: collector.containsPlaylist(playlist) ? "取消收藏" : "添加到收藏",
      props: {
        title: collector.containsPlaylist(playlist) ? "取消收藏" : "添加到收藏",
        onClick: () => collector.collectList(playlist),
      },
      icon: renderIcon(
        CollectIcon,
        {},
        { size: 24, color: collector.containsPlaylist(playlist) ? "red" : "#999" }
      ),
      key: "playlist-collect",
    },
    {
      label: "详情",
      props: {
        title: "详情",
        onClick: () => detailDialogRef.value?.openPlaylist(playlist),
      },
      icon: renderIcon(Info, {}, { size: 22 }),
      key: "playlist-detail",
    },
  ] as DropdownOption[];
};

const handlePlayPlaylist = async (playlist: CommonPlaylist) => {
  const loading = window.$message.loading("正在获取歌单歌曲...");
  try {
    const songs = await fetchAllPlaylistTracks(playlist);
    if (!songs.length) {
      window.$message.warning("歌单暂无可播放歌曲");
      return;
    }

    if (await playbackCommands.playAll(songs)) {
      window.$message.success(`已开始播放 ${songs.length} 首歌曲`);
    }
  } catch (error) {
    window.$message.error(getPlaylistActionError(error, "播放全部失败"));
  } finally {
    loading.close();
  }
};

const handleAddPlaylist = async (playlist: CommonPlaylist) => {
  const loading = window.$message.loading("正在获取歌单歌曲...");
  try {
    const songs = await fetchAllPlaylistTracks(playlist);
    if (!songs.length) {
      window.$message.warning("歌单暂无可添加歌曲");
      return;
    }

    if (await playbackCommands.appendToPlaylist(songs)) {
      window.$message.success(`已添加 ${songs.length} 首歌曲到播放列表`);
    }
  } catch (error) {
    window.$message.error(getPlaylistActionError(error, "添加到播放列表失败"));
  } finally {
    loading.close();
  }
};

const getPlaylistActionError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

defineExpose({ openContextMenu, handlePlayPlaylist });
</script>

<style>
.song-list-menu {
  max-width: 220px;
  overflow: hidden;
}

.song-list-menu .n-dropdown-option {
  max-width: 220px;
}

.song-list-menu .n-dropdown-option-body {
  max-width: 220px;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.song-list-menu .n-dropdown-option-body__prefix {
  flex: 0 0 auto;
}

.song-list-menu .n-dropdown-option-body__label {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
