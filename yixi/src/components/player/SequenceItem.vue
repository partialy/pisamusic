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
import { useCollectStore } from '@/store';
import type { Song } from '@/types/song';
import { usePlaybackCommands } from '@/listenTogether/playbackCommands';

const collector = useCollectStore()
const playbackCommands = usePlaybackCommands()
const props = defineProps<{
    item: Song,
    index: number,
    active: boolean,
    queueItemId?: string | null
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
    playbackCommands.playQueueItem(props.queueItemId ?? null, props.item)
}

const deleteSong = () => {
    playbackCommands.removeQueueItem(props.queueItemId ?? null, props.item)
}

</script>

<style scoped lang="scss">
.sequence-item {
    width: 100%;
    padding: 0 4px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-primary);
    transition:
        background-color 0.18s ease,
        border-color 0.18s ease,
        color 0.18s ease;

    &:hover {
        background: var(--surface-row-hover);

        .delete-btn,
        .collect-btn {
            cursor: pointer;
            display: block !important;

            &:hover {
                color: #ef4444;
            }
        }

        .duration-text {
            display: none !important;
        }

        .delete-btn {
            color: var(--text-tertiary);
        }
    }

    &.active {
        background: var(--surface-row-playing) !important;
        border-color: var(--border-row-playing) !important;

        .index,
        .name {
            color: var(--text-accent) !important;
        }

        .artist,
        .duration {
            color: var(--text-accent) !important;
        }
    }

    .index {
        width: 40px;
        text-align: center;
        color: var(--text-secondary);
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
            color: var(--text-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .artist {
            font-size: 12px;
            color: var(--text-secondary);
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
        color: var(--text-tertiary);
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
