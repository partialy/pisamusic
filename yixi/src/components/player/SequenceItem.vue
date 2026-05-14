<template>
    <div class="sequence-item" :class="{ 'active': active }" @dblclick="playSong">
        <div class="index">
            {{ index + 1 }}
        </div>
        <div class="cover">
            <n-image class="cover-img" :src="cover" :fallback-src="defaultSongCover" preview-disabled />
        </div>
        <div class="info">
            <div class="name" :title="name">{{ name }}</div>
            <div class="artist" :title="item.singer">{{ item.singer }}</div>
        </div>
        <div class="duration">
            <span class="duration-text">{{ formatDuration(item.duration) }}</span>
            <n-button text circle class="collect-btn" @click="collector.collectSong(props.item)"
                :style="{ color: collector.containsSong(item) ? 'red' : '#666' }">
                <n-icon size="22" :component="CollectIcon"></n-icon>
            </n-button>
            <n-button text circle @click="deleteSong" title="删除" class="delete-btn">
                <n-icon size="24" class="icon" :component="CloseIcon"></n-icon>
            </n-button>

        </div>
    </div>
</template>

<script setup lang="ts">
import { CloseIcon, CollectIcon } from '@/icons';
import { NImage, NIcon } from 'naive-ui';
import { computed } from 'vue';
import { defaultSongCover, formatDuration, getSongCover } from '@/utils/common';
import { useAudioStore, useCollectStore } from '@/store';
import type { Song } from '@/types/song';

const collector = useCollectStore()
const player = useAudioStore()
const props = defineProps<{
    item: Song,
    index: number,
    active: boolean
}>()

const cover = computed(() => {
    return getSongCover(props.item, 120)
})

const name = computed(() => {
    if (props.item.name && props.item.name.includes(' - ')) {
        return props.item.name.split(' - ')[1]
    }
    return props.item.name || '未知'
})

const playSong = () => {
    player.play(props.item)
}

const deleteSong = () => {
    player.removeFromPlaylist(props.item)
}

</script>

<style scoped lang="scss">
.active {
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-default)) !important;
    border-color: color-mix(in srgb, var(--color-primary) 34%, var(--color-border-default)) !important;

    .index,
    .name {
        color: color-mix(in srgb, #fff 20%, var(--color-primary)) !important;
    }

    .artist,
    .duration {
        color: color-mix(in srgb, #fff 40%, var(--color-primary)) !important;
    }
}

.light {
    .sequence-item {

        .artist,
        .duration {
            color: #ddd !important;
            ;
        }

        &:hover {
            background: color-mix(in srgb, var(--color-primary) 8%, #efefef30);

            .delete-btn {
                color: #ddd;
            }
        }
    }

    .sequence-item.active {
        background: color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-default)) !important;
        border-color: color-mix(in srgb, var(--color-primary) 34%, var(--color-border-default)) !important;

        .index,
        .name {
            color: color-mix(in srgb, #fff 20%, var(--color-primary)) !important;
        }

        .artist,
        .duration {
            color: color-mix(in srgb, #fff 40%, var(--color-primary)) !important;
        }
    }
}

.sequence-item {
    width: 100%;
    padding: 0 4px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid transparent;
    color: #eee;
    transition:
        background-color 0.18s ease,
        border-color 0.18s ease,
        color 0.18s ease;

    &:hover {
        background: color-mix(in srgb, var(--color-primary) 8%, #efefef30);

        .delete-btn,
        .collect-btn {
            cursor: pointer;
            display: block !important;

            &:hover {
                color: red;
            }
        }

        .duration-text {
            display: none !important;
        }

        .delete-btn {
            color: #bbb;
        }

    }

    .index {
        width: 40px;
        text-align: center;
        color: #eee;
    }

    .cover {
        width: 40px;
        height: 40px;
        overflow: hidden;
        border-radius: 5px;

        .cover-img {
            width: 100%;
            height: 100%;
        }
    }

    .info {
        width: calc(100% - 150px);
        margin-left: 10px;

        .name {
            font-size: 14px;
            color: #eee;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .artist {
            font-size: 12px;
            color: #bbb;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    .duration {
        font-size: 12px;
        text-align: center;
        margin-right: 10px;
        width: 50px;
        color: #bbb;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;

        .delete-btn,
        .collect-btn {
            display: none;
        }

        .duration-text {
            display: block;
        }
    }
}
</style>
