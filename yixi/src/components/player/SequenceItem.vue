<template>
    <div class="sequence-item" :class="{'active': active }" @dblclick="playSong">
        <div class="index">
            {{ index + 1 }}
        </div>
        <div class="cover">
            <n-image class="cover-img" :src="cover" preview-disabled />
        </div>
        <div class="info">
            <div class="name" :title="name">{{ name }}</div>
            <div class="artist" :title="item.singer">{{ item.singer }}</div>
        </div>
        <div class="duration">
            <span class="duration-text">{{ formatDuration(item.duration) }}</span>
            <n-button text circle class="collect-btn" @click="collector.collectSong(props.item)" :style="{ color: collector.containsSong(item) ? 'red' : '#666' }" >
                <n-icon size="22" :component="CollectIcon"></n-icon>
            </n-button>
                <n-button text circle @click="deleteSong" title="删除" class="delete-btn">
                    <n-icon size="24" :component="CloseIcon"></n-icon>
                </n-button>
        
        </div>
    </div>
</template>

<script setup lang="ts">
import { CloseIcon, CollectIcon } from '@/icons';
import { NImage, NIcon } from 'naive-ui';
import { computed } from 'vue';
import { formatDuration, getKgImage } from '@/utils/common';
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
    return getKgImage(props.item.cover, 120) || '/images/song.jpg'
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

<style scoped>

.active {
    background-color: var(--color-bg-hover) !important;
}

.sequence-item {
    width: 100%;
    padding: 0 4px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;

    &:hover {
        background-color: var(--color-bg-hover);

        .delete-btn,.collect-btn {
            cursor: pointer;
            display: block !important;

            &:hover {
                color: red;
            }
        }

        .duration-text {
            display: none !important;
        }
    }

    .index {
        width: 40px;
        text-align: center;
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
            color: var(--text-color);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .artist {
            font-size: 12px;
            color: var(--text-color-secondary);
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
        color: var(--text-color-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;

        .delete-btn,.collect-btn {
            display: none;
        }

        .duration-text {
            display: block;
        }
    }
}
</style>
