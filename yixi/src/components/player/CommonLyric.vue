<template>
    <div class="lyric-container">
        <Transition name="fade" mode="out-in">
            <n-scrollbar ref="scrollbarRef" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
                <template #default>
                    <div class="lyric-wrapper">
                        <div v-for="item in displayLyrics" :id="`lyric-${item.index}`" class="lyric-item"
                            @click="playerStore.seek(item.time)" :class="{ 'active': currentIndex === item.index }"
                            :key="item.time" :style="{
                                'font-size':
                                    lyricStore.setting.lyricFontSize + 'px',
                                'font-weight': lyricStore.setting.lyricFontWeight ? 'bold' : 'normal',
                                'font-family':
                                    lyricStore.setting.lyricFont !== 'follow'
                                        ? lyricStore.setting.lyricFont
                                        : '',
                            }">
                            <span
                                class="lyric-text"
                                :class="{ 'karaoke-active': currentIndex === item.index }"
                                :ref="(el) => setLyricTextRef(item.index, el as HTMLElement | null)"
                                :style="getLyricTextStyle(item)">
                                {{ item.text }}
                            </span>
                            <span v-if="lyricStore.setting.showTime" class="time"
                                :style="{ opacity: cursorIn ? 0.6 : 0 }">
                                {{ formatDuration(item.time) }}</span>
                        </div>
                    </div>
                </template>
            </n-scrollbar>
        </Transition>
        <span ref="measurerRef" class="lyric-measurer"></span>
    </div>
</template>

<script setup lang="ts">

import { useAudioStore, useLyricStore } from '@/store';
import { debounce, formatDuration } from '@/utils/common';
import { NScrollbar } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { MyLyricLine, MyWordTiming } from '@/utils/lyricUtil';


const playerStore = useAudioStore()
const lyricStore = useLyricStore()
const { currentTime } = storeToRefs(playerStore)
const { parsedLrc, parsedKrc } = storeToRefs(lyricStore)
const currentIndex = ref(0)
const scrollbarRef = ref<HTMLElement | null>(null)
const userScroll = ref(false)
const lyricTextRefs = ref<Record<number, HTMLElement | null>>({})
const lyricProgress = ref<Record<number, number>>({})
const textWidthCache = new Map<string, number>()
const measurerRef = ref<HTMLSpanElement | null>(null)

watch(currentTime, (newVal, oldVal) => {
    if (newVal < oldVal) {
        currentIndex.value = 0
    }
    if (newVal < 1) {
        currentIndex.value = 0
        return
    }
    if (currentIndex.value == displayLyrics.value.length - 1) {
        return
    }
    currentIndex.value = displayLyrics.value.findIndex(line => line.time <= newVal && line.endTime!! >= newVal)
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

const displayLyrics = computed<MyLyricLine[]>(() => {
    const source =
        lyricStore.setting.useKRC && parsedKrc.value.length > 0
            ? parsedKrc.value
            : parsedLrc.value
    return source.map(normalizeDisplayLine)
})

const currentLine = computed(() => displayLyrics.value[currentIndex.value] || null)

const setLyricTextRef = (index: number, el: HTMLElement | null) => {
    lyricTextRefs.value[index] = el
}

const getLyricTextStyle = (item: MyLyricLine) => {
    const baseColor = lyricStore.setting.lyricFontColor || '#ffffff'
    const activeColor = lyricStore.setting.currentLyricColor || '#ffffff'
    if (currentIndex.value !== item.index) {
        return {
            color: baseColor,
            backgroundImage: `linear-gradient(to right, ${baseColor}, ${baseColor})`,
        }
    }

    const percent = lyricProgress.value[item.index] ?? 0
    return {
        color: 'transparent',
        backgroundImage: `linear-gradient(to right, ${activeColor} ${percent}%, ${baseColor} ${percent}%)`,
    }
}

const syncLyricProgress = async () => {
    const line = currentLine.value
    if (!line) return
    await nextTick()
    lyricProgress.value[line.index] = getLineHighlightPercent(line, currentTime.value)
}

const getLineHighlightPercent = (line: MyLyricLine, timeSeconds: number) => {
    const timeline = buildCharTimeline(line)
    if (!timeline.length) return 0

    const displayTime = timeSeconds * 1000
    const fullText = timeline.map((item) => item.char).join('')
    const totalWidth = getTextWidth(fullText, line.index)
    if (totalWidth <= 0) return 0

    let highlightWidth = 0
    for (const item of timeline) {
        if (displayTime >= item.end) {
            highlightWidth += getTextWidth(item.char, line.index)
        } else if (displayTime >= item.start) {
            const progress = (displayTime - item.start) / Math.max(item.end - item.start, 1)
            highlightWidth += getTextWidth(item.char, line.index) * Math.max(0, Math.min(1, progress))
            break
        } else {
            break
        }
    }

    return Math.min(100, (highlightWidth / totalWidth) * 100)
}

const buildCharTimeline = (line: MyLyricLine) => {
    const words = getLineWords(line)
    const chars: Array<{ char: string; start: number; end: number }> = []
    words.forEach((word) => {
        const text = String(word.word || '')
        const len = Math.max(text.length, 1)
        const startTime = Number(word.startTime || line.time * 1000 || 0)
        const endTime = Number(word.endTime || getFallbackLineEnd(line))
        const duration = Math.max(endTime - startTime, 1)
        for (let i = 0; i < text.length; i += 1) {
            chars.push({
                char: text[i],
                start: startTime + (duration / len) * i,
                end: startTime + (duration / len) * (i + 1),
            })
        }
    })
    return chars
}

const getLineWords = (line: MyLyricLine): MyWordTiming[] => {
    if (Array.isArray(line.words) && line.words.length > 0) {
        return line.words.map((word) => ({
            ...word,
            startTime: line.time * 1000 + Number(word.startTime || 0),
            endTime: line.time * 1000 + Number(word.endTime || 0),
        }))
    }

    return [{
        word: line.text,
        startTime: line.time * 1000,
        endTime: getFallbackLineEnd(line),
        duration: Math.max(getFallbackLineEnd(line) - line.time * 1000, 1),
    }]
}

const getFallbackLineEnd = (line: MyLyricLine) => {
    const nextLine = displayLyrics.value.find((item) => item.time > line.time)
    const fallbackSeconds = Number(line.endTime ?? nextLine?.time ?? line.time + 3)
    return fallbackSeconds * 1000
}

const normalizeDisplayLine = (line: MyLyricLine): MyLyricLine => {
    const isMillisecondLine = line.time > 1000 || Number(line.endTime ?? 0) > 1000
    if (!isMillisecondLine) return line
    return {
        ...line,
        time: line.time / 1000,
        endTime: line.endTime ? line.endTime / 1000 : undefined,
    }
}

const getTextWidth = (text: string, index: number) => {
    const target = lyricTextRefs.value[index]
    const style = target ? window.getComputedStyle(target) : null
    const cacheKey = [
        text,
        style?.fontSize || '',
        style?.fontFamily || '',
        style?.fontWeight || '',
    ].join('|')
    const cached = textWidthCache.get(cacheKey)
    if (cached !== undefined) return cached

    const measurer = measurerRef.value
    if (!measurer) return text.length
    measurer.textContent = text
    if (style) {
        measurer.style.fontSize = style.fontSize
        measurer.style.fontFamily = style.fontFamily
        measurer.style.fontWeight = style.fontWeight
        measurer.style.letterSpacing = style.letterSpacing
    }
    const width = measurer.getBoundingClientRect().width
    textWidthCache.set(cacheKey, width)
    return width
}

watch(currentTime, () => {
    void syncLyricProgress()
})

watch(currentIndex, () => {
    void syncLyricProgress()
})

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

    .lyric-text {
        display: inline-block;
        max-width: calc(100% - 96px);
        background-clip: text;
        -webkit-background-clip: text;
        transition: background-image 0.08s linear, color 0.2s ease;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
    }

    .karaoke-active {
        color: transparent;
    }

    .lyric-measurer {
        position: fixed;
        top: -9999px;
        left: -9999px;
        visibility: hidden;
        white-space: pre;
        pointer-events: none;
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
