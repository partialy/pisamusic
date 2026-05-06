<template>
    <div class="play-sequence">
        <div class="sequence-header">
            <span>播放队列</span>
            <span title="清空列表">
                <n-button text circle @click="clearSequence">
                    <n-icon size="24" color="red" :component="DeleteIcon"></n-icon>
                </n-button>
            </span>
        </div>
        <div class="sequence-toolbar">
            <div class="toolbar-left">
                <span>共{{ currentList.length }}首</span>
                <n-spin size="mini" spinning v-if="isLoading"></n-spin>
            </div>
            <div class="toolbar-right">
                <n-button text circle title="搜索歌曲" @click="search">
                    <n-icon :component="SearchIcon"></n-icon>
                </n-button>
            </div>
        </div>

        <div class="sequence-list" ref="sequenceList">
            <VirtList ref="virtListRef" :buffer="2" :offset="offset" :min-size="64" :list="currentList"
                :style="{ height: height + 'px' }" item-key="id">
                <template #stickyHeader v-if="showSearch">
                    <div class="sequence-search" v-if="showSearch">
                        <n-input v-model:value="searchValue" placeholder="搜索歌曲" />
                        <span class="clear-search" @click="clearSearch">取消</span>
                    </div>
                </template>
                <template #default="{ itemData, index }">
                    <SequenceItem :item="itemData" :index="index" :active="currentSong?.id == itemData.id" />
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
import { ref, computed, onMounted, h, useTemplateRef, onUnmounted } from 'vue';
import { NInput, NFloatButton, NButton, NIcon } from 'naive-ui';
import { SequenceItem } from '.';
import { VirtList } from 'vue-virt-list'
import { useAudioStore } from '@/store';
import { storeToRefs } from 'pinia';

const player = useAudioStore()
const { playlist, currentSong } = storeToRefs(player)

const currentList = computed(() => {
    return searchValue.value ? filterList.value : playlist.value
})

const sequenceList = useTemplateRef('sequenceList')
const virtListRef = useTemplateRef('virtListRef')
const offset = ref(0)
const searchValue = ref('')
const showSearch = ref(false)

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
            player.reset()
        }
    })
}

const search = () => {
    showSearch.value = !showSearch.value
    searchValue.value = ''
}

const filterList = computed(() => {
    return playlist.value.filter(item => (item.name.includes(searchValue.value)) || item.singer.includes(searchValue.value)) || []
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
const locate = () => {
    if (currentSong.value) {
        const index = currentList.value.findIndex((i) => i.id == currentSong.value?.id)
        virtListRef.value?.scrollToIndex(index)
    }
}

const isLoading = ref(false)

onMounted(async () => {
    offset.value = currentList.value.findIndex((i) => i.id == currentSong.value?.id) || 0
    sequenceList.value && observer.observe(sequenceList.value)
    locate()
})

onUnmounted(() => {
    observer.disconnect()
})
</script>

<style scoped>
.play-sequence {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;

    .sequence-header {
        padding: 15px;
        width: 100%;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: space-between;

        span {
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
        }

        .delete-icon {
            cursor: pointer;

            &:hover {
                color: red;
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
                &:hover {
                    color: var(--color-primary);
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
        background-color: #fff;

        .clear-search {
            cursor: pointer;
            width: 40px;
            margin-left: 10px;
            opacity: 0.6;

            &:hover {
                color: var(--color-primary);
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
</style>
