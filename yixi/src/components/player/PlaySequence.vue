<template>
    <div class="play-sequence">
        <div class="sequence-header">
            <span class="header-text">{{ listenTogether.enabled ? "一起听队列" : "播放队列" }}</span>
            <n-button :title="listenTogether.enabled ? '一起听中不能清空队列' : '清空列表'" text circle
                :disabled="listenTogether.enabled" @click="clearSequence">
                <n-icon class="delete-icon" :component="DeleteIcon"></n-icon>
            </n-button>

        </div>
        <div class="sequence-toolbar">
            <div class="toolbar-left">
                <span>共{{ currentList.length }}首</span>
                <n-spin size="mini" spinning v-if="isLoading"></n-spin>
            </div>
            <div class="toolbar-right">
                <n-button text circle title="搜索歌曲" @click="search">
                    <n-icon class="search-icon" :component="SearchIcon"></n-icon>
                </n-button>
            </div>
        </div>

        <div class="sequence-list" ref="sequenceList">
            <VirtList ref="virtListRef" :buffer="2" :start="startIndex" :min-size="64" :list="currentList"
                :style="{ height: height + 'px' }" item-key="key">
                <template #stickyHeader v-if="showSearch">
                    <div class="sequence-search" v-if="showSearch">
                        <n-input round clearable
                        style="background:transparent;"
                         v-model:value="searchValue" placeholder="搜索歌曲">
                         <template #prefix>
                            <n-icon :component="SearchIcon" color="#eee" class="search-icon"></n-icon>
                         </template>
                         </n-input>
                        <span class="clear-search" @click="clearSearch">取消</span>
                    </div>
                </template>
                <template #default="{ itemData, index }">
                    <SequenceItem :item="itemData.song" :queue-item-id="itemData.queueItemId"
                        :index="index" :active="itemData.key === activeItemKey" />
                </template>
                <template #empty>
                    <div class="sequence-empty">
                        <span>{{ searchValue ? '没有找到相关歌曲' : '当前列表为空' }}</span>
                    </div>
                </template>
            </VirtList>

            <n-float-button :right="10" :bottom="20" @click="locate">
                <n-button text circle @click="locate">
                    <n-icon size="24" :component="LocateIcon"></n-icon>
                </n-button>
            </n-float-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { SearchIcon, DeleteIcon, LocateIcon } from '@/icons';
import { ref, computed, nextTick, onMounted, h, useTemplateRef, onUnmounted } from 'vue';
import { NInput, NFloatButton, NButton, NIcon } from 'naive-ui';
import { SequenceItem } from '.';
import { VirtList } from 'vue-virt-list'
import { useAudioStore, useListenTogetherStore } from '@/store';
import { storeToRefs } from 'pinia';
import type { Song } from '@/types/song';
import { fromListenTogetherSong } from '@/listenTogether/listenTogetherSong';
import { usePlaybackCommands } from '@/listenTogether/playbackCommands';

const player = useAudioStore()
const listenTogether = useListenTogetherStore()
const playbackCommands = usePlaybackCommands()
const { playlist, currentSong } = storeToRefs(player)

type SequenceDisplayItem = {
    key: string;
    queueItemId: string | null;
    song: Song;
}

const sourceList = computed<SequenceDisplayItem[]>(() => {
    if (listenTogether.enabled) {
        return listenTogether.queue.items.map((item) => ({
            key: item.queueItemId,
            queueItemId: item.queueItemId,
            song: fromListenTogetherSong(item.song),
        }))
    }
    return playlist.value.map((song, index) => ({
        key: `${song.source}:${song.id}:${index}`,
        queueItemId: null,
        song,
    }))
})

const currentList = computed(() => {
    return searchValue.value ? filterList.value : sourceList.value
})

const sequenceList = useTemplateRef('sequenceList')
const virtListRef = useTemplateRef('virtListRef')
const searchValue = ref('')
const showSearch = ref(false)
const activeItemKey = computed(() => {
    if (listenTogether.enabled) return listenTogether.queue.currentItemId
    const index = playlist.value.findIndex((song) =>
        song.source === currentSong.value?.source && song.id === currentSong.value?.id
    )
    return index >= 0 ? `${playlist.value[index].source}:${playlist.value[index].id}:${index}` : null
})
const startIndex = computed(() => {
    const index = currentList.value.findIndex((item) => item.key === activeItemKey.value)
    return Math.max(index, 0)
})

const clearSequence = () => {
    window.$dialog.create({
        style: { borderRadius: '10px' },
        title: '清空播放列表',
        type: 'error',
        icon: () => h(DeleteIcon),
        content: '确定要清空播放列表吗？',
        // @ts-ignore
        positiveButtonProps: { style: { borderRadius: '8px' } },
        // @ts-ignore
        negativeButtonProps: { style: { borderRadius: '8px' } },
        positiveText: '确定',
        negativeText: '取消',
        onPositiveClick: () => {
            playbackCommands.clearPlaylist()
        }
    })
}

const search = () => {
    showSearch.value = !showSearch.value
    searchValue.value = ''
}

const filterList = computed(() => {
    return sourceList.value.filter(item =>
        item.song.name.includes(searchValue.value) || item.song.singer.includes(searchValue.value)
    )
})

const clearSearch = () => {
    searchValue.value = ''
    showSearch.value = false
}

const height = ref(0)

const observer = new ResizeObserver(entries => {
    if (entries[0]) {
        height.value = entries[0].contentRect.height
    }
})

const renderCurrentWindow = () => {
    const list = virtListRef.value
    if (!list || currentList.value.length === 0) return

    const index = startIndex.value
    const clientSize = list.slotSize?.clientSize || height.value
    const visibleCount = Math.max(Math.ceil(clientSize / 64), 1)
    const renderBegin = Math.max(index - 2, 0)
    const renderEnd = Math.min(index + visibleCount + 2, currentList.value.length - 1)

    list.manualRender(renderBegin, renderEnd)
    list.forceUpdate()
}

const locate = async () => {
    if (!currentSong.value) return
    await nextTick()
    requestAnimationFrame(() => {
        virtListRef.value?.scrollToIndex(startIndex.value)
        requestAnimationFrame(() => {
            renderCurrentWindow()
        })
    })
}

const isLoading = ref(false)

onMounted(async () => {
    sequenceList.value && observer.observe(sequenceList.value)
    await locate()
})

onUnmounted(() => observer.disconnect())
</script>

<style scoped lang="scss">
.light.play-sequence {
    .delete-icon {
        color: #efefef !important;

        &:hover {
            color: red !important;
        }
    }

    .search-icon {
        color: #ddd !important;
        font-size: 20px;

        &:hover {
            color: #fff !important;
        }
    }
    .clear-search {
        color: #ddd !important;
    }
}

.play-sequence {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    color: #eee;

    .sequence-header {
        padding: 15px;
        width: 100%;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: space-between;

        .header-text {
            font-weight: 600;
            display: flex;
            align-items: center;
        }

        .delete-icon {
            color: #efefef !important;
            font-size: 24px;

            &:hover {
                color: red !important;
            }
        }   
    }

    .sequence-toolbar {
        padding: 0 15px;
        width: 100%;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: space-between;

        .toolbar-left {
            font-size: 14px;
            gap: 8px;
            display: flex;
            flex-direction: row;
        }

        .toolbar-right {
            display: flex;
            align-items: center;
            cursor: pointer;
            -webkit-app-region: no-drag;

            .search-icon {
                color: #bbb;
                font-size: 20px;

                &:hover {
                    color: #fff;
                }
            }
        }
    }

    .sequence-search {
        padding: 0 15px;
        width: 100%;
        height: 40px;
        display: flex;
        align-items: center;

        .clear-search {
            cursor: pointer;
            width: 40px;
            margin-left: 10px;
            opacity: 0.7;

            &:hover {
                color: #fff !important;
                opacity: 1;
            }
        }
    }

    .sequence-list {
        flex: 1;
        width: 100%;
        height: 100%;
        overflow-y: auto;
        scroll-behavior: smooth;

        .sequence-empty {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    }
}

:deep(.n-input__placeholder) {
    color: #dedede;
}

:deep(.n-input .n-input__input-el, .n-input .n-input__textarea-el) {
    color: #fff;
}
</style>
