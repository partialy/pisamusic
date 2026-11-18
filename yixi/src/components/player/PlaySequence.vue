<template>
    <div class="play-sequence" :class="{ 'is-player-glass': variant === 'player' }">
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

        <Transition name="queue-search">
          <div v-show="showSearch" class="sequence-search-panel" :inert="!showSearch" :aria-hidden="!showSearch">
            <div class="sequence-search">
              <n-input
                round
                clearable
                v-model:value="searchValue"
                placeholder="搜索歌曲"
                :theme-overrides="searchInputThemeOverrides"
              >
                <template #prefix><n-icon :component="SearchIcon" class="search-icon" /></template>
              </n-input>
              <button type="button" class="clear-search" @click="clearSearch">取消</button>
            </div>
          </div>
        </Transition>
        <div class="sequence-list" ref="sequenceList">
            <VirtList ref="virtListRef" :buffer="2" :start="startIndex" :min-size="64" :list="currentList"
                :style="{ height: height + 'px' }" item-key="key">
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

const props = withDefaults(defineProps<{
    variant?: 'default' | 'player'
}>(), {
    variant: 'default'
})

const searchInputThemeOverrides = computed(() =>
    props.variant === 'player'
        ? {
              color: 'rgba(255, 255, 255, 0.1)',
              colorFocus: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderHover: '1px solid rgba(255, 255, 255, 0.3)',
              borderFocus: '1px solid rgba(255, 255, 255, 0.45)',
              boxShadowFocus: 'none',
              textColor: 'rgba(255, 255, 255, 0.94)',
              placeholderColor: 'rgba(255, 255, 255, 0.48)',
              caretColor: '#ffffff',
              clearColor: 'rgba(255, 255, 255, 0.56)',
              clearColorHover: 'rgba(255, 255, 255, 0.92)',
              iconColor: 'rgba(255, 255, 255, 0.68)',
          }
        : undefined
)

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
        style: { borderRadius: "var(--radius-control)" },
        title: '清空播放列表',
        type: 'error',
        icon: () => h(DeleteIcon),
        content: '确定要清空播放列表吗？',
        // @ts-ignore
        positiveButtonProps: { style: { borderRadius: "var(--radius-pill)" } },
        // @ts-ignore
        negativeButtonProps: { style: { borderRadius: "var(--radius-pill)" } },
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
.sequence-search-panel { flex: 0 0 auto; height: 44px; overflow: hidden; }
.queue-search-enter-active, .queue-search-leave-active { transition: height 300ms ease, opacity 300ms ease, transform 300ms ease; }
.queue-search-enter-from, .queue-search-leave-to { height: 0; opacity: 0; transform: translateY(-8px); }
@media (prefers-reduced-motion: reduce) { .queue-search-enter-active, .queue-search-leave-active { transition: none; } }

.play-sequence {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    color: var(--text-primary);
    background: var(--surface-solid);

    .sequence-header {
        padding: 15px;
        width: 100%;
        height: 50px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;

        .header-text {
            font-weight: 600;
            display: flex;
            align-items: center;
        }

        .delete-icon {
            color: var(--text-secondary);
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
        flex-shrink: 0;
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
                color: var(--text-secondary);
                font-size: 20px;

                &:hover {
                    color: var(--text-primary);
                }
            }
        }
    }

    .sequence-search {
        padding: 0 15px;
        width: 100%;
        height: 40px;
        flex-shrink: 0;
        background: var(--surface-solid);
        display: flex;
        align-items: center;

        .clear-search {
            border: 0;
            background: transparent;
            color: var(--text-secondary);
            font: inherit;
            flex-shrink: 0;
            cursor: pointer;
            width: 40px;
            margin-left: 10px;
            opacity: 0.7;

            &:hover {
                color: var(--text-accent);
                opacity: 1;
            }
        }
    }

    .sequence-list {
        flex: 1;
        width: 100%;
        min-height: 0;
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
    color: var(--text-tertiary);
}

:deep(.n-input .n-input__input-el, .n-input .n-input__textarea-el) {
    color: var(--text-primary);
}

.play-sequence.is-player-glass {
    --queue-text-primary: rgba(255, 255, 255, 0.94);
    --queue-text-secondary: rgba(255, 255, 255, 0.68);
    --queue-text-tertiary: rgba(255, 255, 255, 0.46);
    --queue-row-hover: rgba(255, 255, 255, 0.09);
    --queue-row-playing: var(--queue-accent-bg, rgba(255, 255, 255, 0.16));
    --queue-row-playing-border: var(--queue-accent-border, rgba(255, 255, 255, 0.28));
    --queue-accent: var(--queue-accent-color, #ffffff);

    background: transparent;
    color: var(--queue-text-primary);

    .sequence-header {
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);

        .delete-icon {
            color: var(--queue-text-secondary);
        }
    }

    .sequence-toolbar {
        color: var(--queue-text-secondary);

        .toolbar-right .search-icon {
            color: var(--queue-text-secondary);

            &:hover {
                color: var(--queue-text-primary);
            }
        }
    }

    .sequence-search {
        background: transparent;

        .clear-search {
            color: var(--queue-text-secondary);
            opacity: 0.85;

            &:hover {
                color: var(--queue-accent);
                opacity: 1;
            }
        }

        :deep(.n-input .search-icon) {
            color: var(--queue-text-secondary);
        }

        :deep(.n-input .n-input__input-el) {
            color: var(--queue-text-primary);
        }

        :deep(.n-input__placeholder) {
            color: var(--queue-text-tertiary);
        }
    }

    .sequence-list {
        .sequence-empty {
            color: var(--queue-text-secondary);
        }

        &::-webkit-scrollbar {
            width: 5px;
        }

        &::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.18);
            border-radius: 999px;

            &:hover {
                background: rgba(255, 255, 255, 0.32);
            }
        }

        :deep(.n-float-button) {
            background: rgba(255, 255, 255, 0.14);
            border: 1px solid rgba(255, 255, 255, 0.22);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
            color: rgba(255, 255, 255, 0.92);

            .n-button,
            .n-icon {
                color: rgba(255, 255, 255, 0.92);
            }

            &:hover {
                background: rgba(255, 255, 255, 0.24);
                border-color: rgba(255, 255, 255, 0.36);
            }
        }
    }
}
</style>
