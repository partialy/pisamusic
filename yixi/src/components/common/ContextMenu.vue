<template>
  <n-dropdown
    class="song-list-menu"
    placement="bottom-start"
    trigger="manual"
    style="border-radius: 8px"
    :x="x"
    :y="y"
    :show="show"
    :options="options"
    @select="show = false"
    @clickoutside="show = false" />
</template>

<script lang="ts" setup>
import { nextTick, ref } from "vue";
import { NDropdown, type DropdownOption } from "naive-ui";
import type { CommonPlaylist, Song } from "@/types/song";
import {
  AddToPlaylist,
  CollectIcon,
  MusicIcon,
  NextPlayIcon,
  PlayStatic,
  SingerIcon,
} from "@/icons";
import { useAudioStore, useCollectStore } from "@/store";
import { renderIcon } from "@/utils/common";

const x = ref(0);
const y = ref(0);
const show = ref(false);
const options = ref<DropdownOption[]>([]);
const collector = useCollectStore();
const player = useAudioStore();

const openContextMenu = (
  e: MouseEvent,
  prop: {
    type: "song" | "playlist";
    data: Song | CommonPlaylist | null;
  }
) => {
  e.preventDefault();
  nextTick().then(() => {
    if (prop.type === "song") {
      options.value = createSongOptions(prop.data as Song);
    } else {
      options.value = createPlaylistOptions(prop.data as CommonPlaylist);
    }
    x.value = e.clientX;
    y.value = e.clientY;
    show.value = true;
  });
};

const createSongOptions = (song: Song) => {
  return [
    {
      label: song.name,
      disabled: true,
      icon: renderIcon(MusicIcon, {}, { size: 24 }),
      key: "music",
    },
    {
      label: song.singer,
      disabled: true,
      icon: renderIcon(SingerIcon, {}, { size: 24 }),
      key: "singer",
    },
    { type: "divider", key: "divider" },
    {
      label: "播放",
      props: {
        onClick: () => player.setPlaylist([song], true),
      },
      icon: renderIcon(PlayStatic, {}, { size: 24 }),
      key: "play",
    },
    {
      label: "下一首播放",
      props: {
        onClick: () => player.nextPlay(song),
      },
      icon: renderIcon(NextPlayIcon, {}, { size: 24 }),
      key: "nextplay",
    },
    {
      label: "添加到列表",
      props: {
        onClick: () => player.setPlaylist([song]),
      },
      icon: renderIcon(AddToPlaylist, {}, { size: 24 }),
      key: "add",
    },
    {
      label: collector.containsSong(song) ? "取消收藏" : "添加到收藏",
      props: {
        onClick: () => collector.collectSong(song),
      },
      icon: renderIcon(
        CollectIcon,
        {},
        { size: 24, color: collector.containsSong(song) ? "red" : "#999" }
      ),
      key: "collect",
    },
  ] as DropdownOption[];
};

const createPlaylistOptions = (playlist: CommonPlaylist) => {
  return [
    {
      label: "播放全部",
      disabled: true,
    },
    {
      label: "添加到播放列表",
      disabled: true,
    },
    {
      label: collector.containsPlaylist(playlist) ? "取消收藏" : "添加到收藏",
      props: {
        onClick: () => collector.collectList(playlist),
      },
    },
  ] as DropdownOption[];
};

defineExpose({ openContextMenu });
</script>
