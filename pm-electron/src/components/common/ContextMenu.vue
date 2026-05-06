<!-- src/components/ContextMenu.vue -->
<template>
    <n-dropdown style="border-radius: 8px;" :x="x" :y="y" :show="show" :options="options" class="song-list-menu" placement="bottom-start"
        trigger="manual" @select="show = false" @clickoutside="show = false">
    </n-dropdown>
</template>

<script lang="ts" setup>
import { nextTick, ref } from "vue";
import { NDropdown, type DropdownOption } from "naive-ui";
import type { Song, CommonPlaylist } from "@/types/song";
import { AddToPlaylist, CollectIcon, MusicIcon, NextPlayIcon, PlayStatic, SingerIcon } from "@/icons";
import { useAudioStore, useCollectStore } from "@/store";
import { storeToRefs } from "pinia";
import { renderIcon } from "@/utils/common";

const x = ref(0);
const y = ref(0);
const show = ref(false);
const options = ref<DropdownOption[]>([]);
const collector = useCollectStore();
const player = useAudioStore();
const { songMap, playlistMap } = storeToRefs(collector);

const openContextMenu = (
    e: MouseEvent,
    prop: {
        type: "song" | "playlist";
        data: Song | CommonPlaylist | null;
    }
) => {
    e.preventDefault();
    nextTick().then(() => {
        switch (prop.type) {
            case "song":
                options.value = creatSongOptions(prop.data as Song);
                break;
            case "playlist":
                options.value = creatPlaylistOptions(prop.data as CommonPlaylist);
                break;
        }
        console.log(prop);
        x.value = e.clientX;
        y.value = e.clientY;
        show.value = true;
    })

};
const creatSongOptions = (song: Song) => {
    return [
        {
            label: song.name,
            props: {
                onClick: () => {
                    window.$message.success("show detail")
                },
            },
            icon: renderIcon(MusicIcon,{},{size: 24}),
            key: "music",
        },
        {
            label: song.singer,
            disabled: true,
            icon: renderIcon(SingerIcon,{},{size: 24}),
            key: "singer",
        },
        {
            type: "divider",
            key: "divider",
        
        },
        {
            label: `播放`,
            props: {
                onClick: () => {
                    player.setPlaylist([song],true);
                },
            },
            icon: renderIcon(PlayStatic,{},{ size: 24 }),
            key: "play",
        },
        {
            label: "下一首播放",
            props: {
                onClick: () => {
                    console.log("下一首播放");
                },
            },
            icon: renderIcon(NextPlayIcon,{},{size: 24}),
            key: "nextplay",
        },,
        {
            label: "添加到列表",
            props: {
                onClick: () => {
                    player.setPlaylist([song])
                },
            },
            icon: renderIcon(AddToPlaylist,{},{size: 24}),
            key: "add",
        },
        {
            label: songMap.value.has(song.id) ? "取消收藏" : "添加到收藏",
            props: {
                onClick: () => {
                    collector.collectSong(song)
                },
            },
            icon: renderIcon(CollectIcon,{},{size: 24, color: songMap.value.has(song.id) ? "red" : "#999"}),
            key: "collect",
        },
    ] as DropdownOption[];
};

const creatPlaylistOptions = (playlist: CommonPlaylist) => {
    return [
        {
            label: "播放全部",
            props: {
                onClick: () => {
                    console.log("播放全部");
                },
            },

        },
        {
            label: "添加到播放列表",
            props: {
                onClick: () => {
                    console.log("添加到播放列表");
                },
            },
        },
        {
            label: playlistMap.value.has(playlist.id) ? "取消收藏" : "添加到收藏",
            props: {
                onClick: () => {
                    collector.collectList(playlist);
                },
            },
        }
    ] as DropdownOption[];
}

defineExpose({ openContextMenu });

</script>
