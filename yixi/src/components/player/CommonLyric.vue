<template>
    <div class="lyric-container">
        <Transition name="fade" mode="out-in">
            <n-scrollbar ref="scrollbarRef" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
                <template #default>
                    <div class="lyric-wrapper">
                        <div v-for="item in parsedLrc" :id="`lyric-${item.index}`" class="lyric-item"
                            @click="playerStore.seek(item.time)" :class="{ 'active': currentIndex === item.index }"
                            :key="item.time" :style="{
                                color: currentIndex === item.index ? lyricStore.setting.currentLyricColor : lyricStore.setting.lyricFontColor,
                                'font-size':
                                    lyricStore.setting.lyricFontSize + 'px',
                                'font-weight': lyricStore.setting.lyricFontWeight ? 'bold' : 'normal',
                                'font-family':
                                    lyricStore.setting.lyricFont !== 'follow'
                                        ? lyricStore.setting.lyricFont
                                        : '',
                            }">
                            {{ item.text }}
                            <span v-if="lyricStore.setting.showTime" class="time"
                                :style="{ opacity: cursorIn ? 0.6 : 0 }">
                                {{ formatDuration(item.time) }}</span>
                        </div>
                    </div>
                </template>
            </n-scrollbar>
        </Transition>
    </div>
</template>

<script setup lang="ts">

import { useAudioStore, useLyricStore } from '@/store';
import { debounce, formatDuration } from '@/utils/common';
import { NScrollbar } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { onBeforeUnmount, ref, watch } from 'vue';


const playerStore = useAudioStore()
const lyricStore = useLyricStore()
const { currentTime, origin } = storeToRefs(playerStore)
const { parsedLrc } = storeToRefs(lyricStore)
const currentIndex = ref(0)
const scrollbarRef = ref<HTMLElement | null>(null)
const userScroll = ref(false)

watch(currentTime, (newVal, oldVal) => {
    if (newVal < oldVal) {
        currentIndex.value = 0
    }
    if (newVal < 1) {
        currentIndex.value = 0
        return
    }
    if (currentIndex.value == parsedLrc.value.length - 1) {
        return
    }
    currentIndex.value = parsedLrc.value.findIndex(line => line.time <= newVal && line.endTime!! >= newVal)
})

const activeRow = ref<HTMLElement | null>(null)

// 歌词滚动
const lyricsScroll = (index: number) => {
    // 如果用户手动滚动，则不进行自动滚动
    if (userScroll.value) return
    const lrcItemDom = document.getElementById(`lyric-${index}`);
    if (lrcItemDom && scrollbarRef.value) {
        const container = lrcItemDom.parentElement;
        if (!container) return;
        lrcItemDom?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
};

watch(currentIndex, (newVal, oldVal) => {
    if (newVal == oldVal) {
        return
    }
    activeRow.value = document.getElementById(`lyric-${newVal}`)
    lyricsScroll(newVal)
})

const cursorIn = ref(false)

const handleMouseEnter = () => {
    cursorIn.value = true
    window.addEventListener('wheel', handleWheel)
}

const handleMouseLeave = () => {
    cursorIn.value = false
    window.removeEventListener('wheel', handleWheel)
}

const handleWheel = () => {
    userScroll.value = true
    endScroll()
}

const endScroll = debounce(() => {
    userScroll.value = false
    window.addEventListener('wheel', handleWheel)
}, 2000)

onBeforeUnmount(() => {
    window.removeEventListener('wheel', handleWheel)
})
</script>

<style scoped lang="scss">
.lyric-container {
    width: 100%;
    height: 100%;

    .active {
        padding: 40px 20px !important;
        color: #ffffff;
        opacity: 1 !important;

        transform: scale(1) !important;
    }

    .lyric-wrapper {
        padding: 40vh 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .lyric-item {
        width: 100%;
        padding: 20px;
        border-radius: 10px;
        font-weight: 600;
        opacity: 0.2;
        margin-bottom: 20px;
        transition: all 0.6s ease-out;
        position: relative;
        transform-origin: left center;

        transform: scale(0.9);

        &:hover {
            background-color: #ffffff4f;
            opacity: 0.6;
        }

        .time {
            font-size: 24px;
            font-weight: 400;
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
        }
    }
}

:deep(.n-scrollbar-rail) {
    opacity: 0;
}

/* 添加滚动容器的过渡效果 */
:deep(.n-scrollbar-container) {
    transition: all 0.5s var(--ease-out-back);
    scroll-behavior: smooth;
}
</style>
