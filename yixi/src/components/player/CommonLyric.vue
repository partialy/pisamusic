<template>
  <div
    ref="containerRef"
    class="lyric-container"
    :class="{ pure: lyricStore.setting.pureLyricMode, 'show-time': lyricStore.setting.showTime }"
    :style="{ opacity: lyricStore.setting.lyricFontOpacity }">
    <Transition name="fade" mode="out-in">
      <n-scrollbar ref="scrollbarRef" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave" @wheel.passive="handleWheel">
        <template #default>
          <div ref="wrapperRef" class="lyric-wrapper" :style="wrapperStyle">
            <div
              v-for="item in displayLyrics"
              :data-lyric-index="item.index"
              :key="item.line.startTime"
              class="lyric-item"
              :class="{ active: currentIndex === item.index }"
              :style="getItemStyle()"
              @click="playbackCommands.seekSeconds(item.time)">
              <span v-if="useWordProgress" class="lyric-text word-line">
                <span
                  v-for="(word, wordIndex) in item.line.words"
                  :key="`${word.startTime}-${wordIndex}-${word.word}`"
                  class="word"
                  :style="getWordStyle(item.index, word)">
                  {{ word.word }}
                </span>
              </span>
              <span v-else class="lyric-text" :style="getLineTextStyle(item.index)">
                {{ item.text }}
              </span>
              <span
                v-if="lyricStore.setting.showTime"
                class="time"
                :style="{ opacity: cursorIn ? 0.6 : 0 }">
                {{ formatDuration(item.time) }}
              </span>
            </div>
          </div>
        </template>
      </n-scrollbar>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useAudioStore, useLyricStore } from "@/store";
import { formatDuration } from "@/utils/common";
import type { LyricWord } from "@/utils/common/LyricParser";
import {
  findLyricLineIndex,
  getLyricLineEndTime,
  getLyricLineText,
  normalizePlaybackTimeToMs,
} from "@/utils/lyricLine";
import { NScrollbar, type ScrollbarInst } from "naive-ui";
import { storeToRefs } from "pinia";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";

const playerStore = useAudioStore();
const lyricStore = useLyricStore();
const playbackCommands = usePlaybackCommands();
const { currentTime, isPlaying } = storeToRefs(playerStore);

const cursorIn = ref(false);
const userScroll = ref(false);
const containerRef = ref<HTMLDivElement>();
const wrapperRef = ref<HTMLDivElement>();
const scrollbarRef = ref<ScrollbarInst>();
const viewportHeight = ref(0);
let resizeObserver: ResizeObserver | undefined;
let observedRow: HTMLElement | undefined;
let scrollTimeout: ReturnType<typeof setTimeout> | undefined;
const getViewport = () => containerRef.value?.querySelector<HTMLElement>(".n-scrollbar-container");
const wrapperStyle = computed(() => ({
  paddingTop: `${viewportHeight.value * lyricStore.setting.alignPosition}px`,
  paddingBottom: `${viewportHeight.value * (1 - lyricStore.setting.alignPosition)}px`,
}));
const currentTimeMs = ref(normalizePlaybackTimeToMs(currentTime.value));
const useWordProgress = computed(() => lyricStore.isKaraokeLyricEnabled);

let anchorTimeMs = currentTimeMs.value;
let anchorRafTimeMs = 0;
let rafId: number | null = null;

const displayLyrics = computed(() =>
  lyricStore.preferredLyrics.map((line, index) => ({
    index,
    line,
    text: getLyricLineText(line),
    time: line.startTime / 1000,
    endTime: getLyricLineEndTime(lyricStore.preferredLyrics, index) / 1000,
  }))
);

const currentIndex = computed(() =>
  findLyricLineIndex(lyricStore.preferredLyrics, currentTimeMs.value)
);

const stopAnimation = () => {
  if (rafId === null) return;
  cancelAnimationFrame(rafId);
  rafId = null;
};

const renderFrame = (now: number) => {
  if (!isPlaying.value) {
    stopAnimation();
    return;
  }
  currentTimeMs.value = anchorTimeMs + (now - anchorRafTimeMs);
  rafId = requestAnimationFrame(renderFrame);
};

const startAnimation = () => {
  if (!isPlaying.value || rafId !== null) return;
  anchorTimeMs = normalizePlaybackTimeToMs(currentTime.value);
  currentTimeMs.value = anchorTimeMs;
  anchorRafTimeMs = performance.now();
  rafId = requestAnimationFrame(renderFrame);
};

const syncTimeAnchor = (time: number) => {
  anchorTimeMs = normalizePlaybackTimeToMs(time);
  currentTimeMs.value = anchorTimeMs;
  anchorRafTimeMs = performance.now();
};

const getItemStyle = () => ({
  fontSize: `${lyricStore.setting.lyricFontSize}px`,
  fontWeight: lyricStore.setting.lyricFontWeight ? "bold" : "normal",
  fontFamily: lyricStore.setting.lyricFont !== "follow" ? lyricStore.setting.lyricFont : "",
});

const getLineTextStyle = (index: number) => ({
  color: currentIndex.value === index
    ? lyricStore.setting.currentLyricColor || "#ffffff"
    : lyricStore.setting.lyricFontColor || "#ffffff",
  textShadow: lyricStore.setting.lyricFontShadow ? "0 2px 10px rgba(0, 0, 0, 0.18)" : "none",
});

const getWordStyle = (index: number, word: LyricWord) => {
  const baseColor = lyricStore.setting.lyricFontColor || "#ffffff";
  const activeColor = lyricStore.setting.currentLyricColor || "#ffffff";
  const textShadow = lyricStore.setting.lyricFontShadow
    ? "0 2px 10px rgba(0, 0, 0, 0.18)"
    : "none";

  if (currentIndex.value !== index) {
    return {
      color: baseColor,
      textShadow,
      backgroundImage: `linear-gradient(to right, ${baseColor}, ${baseColor})`,
    };
  }

  const startTime = Number(word.startTime || 0);
  const endTime = Number(word.endTime || startTime);
  const duration = Math.max(endTime - startTime, 1);
  const progress = Math.max(0, Math.min(1, (currentTimeMs.value - startTime) / duration));
  const percent = progress * 100;

  return {
    color: "transparent",
    textShadow,
    backgroundImage: `linear-gradient(to right, ${activeColor} ${percent}%, ${baseColor} ${percent}%)`,
  };
};

const findRow = (index: number) => wrapperRef.value?.querySelector<HTMLElement>(`[data-lyric-index="${index}"]`);
const observeCurrentRow = () => {
  if (observedRow) resizeObserver?.unobserve(observedRow);
  observedRow = findRow(currentIndex.value) ?? undefined;
  if (observedRow) resizeObserver?.observe(observedRow);
};

const lyricsScroll = (index: number) => {
  if (userScroll.value || index < 0) return;
  const row = findRow(index);
  const viewport = getViewport();
  if (!row || !viewport) return;
  const anchor = { top: 0, center: 0.5, bottom: 1 }[lyricStore.setting.alignAnchor];
  const wrapper = wrapperRef.value!;
  const rowTop = wrapper.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop + row.offsetTop - wrapper.offsetTop;
  scrollbarRef.value?.scrollTo({
    top: rowTop + row.offsetHeight * anchor - viewport.clientHeight * lyricStore.setting.alignPosition,
    behavior: "smooth",
  });
};

watch(currentIndex, (newVal, oldVal) => {
  if (newVal === oldVal) return;
  observeCurrentRow();
  lyricsScroll(newVal);
}, { flush: "post" });

watch(
  currentTime,
  (time) => {
    syncTimeAnchor(time);
    startAnimation();
  },
  { immediate: true }
);

watch(
  isPlaying,
  (playing) => {
    if (playing) {
      startAnimation();
    } else {
      stopAnimation();
      syncTimeAnchor(currentTime.value);
    }
  },
  { immediate: true }
);

watch(
  () => lyricStore.preferredLyrics,
  () => {
    syncTimeAnchor(currentTime.value);
    observeCurrentRow();
    lyricsScroll(currentIndex.value);
  },
  { flush: "post" }
);

watch(
  () => [lyricStore.setting.alignPosition, lyricStore.setting.alignAnchor, lyricStore.setting.pureLyricMode, lyricStore.setting.lyricFontSize, lyricStore.setting.lyricFont, lyricStore.setting.lyricFontWeight],
  () => lyricsScroll(currentIndex.value),
  { flush: "post" }
);

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    viewportHeight.value = getViewport()?.clientHeight ?? containerRef.value?.clientHeight ?? 0;
    void nextTick(() => lyricsScroll(currentIndex.value));
  });
  if (containerRef.value) resizeObserver.observe(containerRef.value);
  if (wrapperRef.value) resizeObserver.observe(wrapperRef.value);
  observeCurrentRow();
});

onBeforeUnmount(() => {
  stopAnimation();
  resizeObserver?.disconnect();
  clearTimeout(scrollTimeout);
});

const handleMouseEnter = () => {
  cursorIn.value = true;
};

const handleMouseLeave = () => {
  cursorIn.value = false;
  userScroll.value = false;
  clearTimeout(scrollTimeout);
  lyricsScroll(currentIndex.value);
};

const handleWheel = () => {
  userScroll.value = true;
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    userScroll.value = false;
    lyricsScroll(currentIndex.value);
  }, 2000);
};
</script>

<style scoped lang="scss">
.lyric-container {
  width: 100%;
  height: 100%;

  .active {
    padding: 40px 20px !important;
    opacity: 1 !important;
    transform: scale(1) !important;
  }

  .lyric-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  &.pure {
    text-align: center;

    .lyric-item {
      transform-origin: center;
    }
  }

  .lyric-item {
    width: 100%;
    padding: 20px;
    border-radius: var(--radius-control);
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
      color: #ffffff9f;
      transform: translateY(-50%);
      transition: opacity 0.2s ease;
    }
  }

  .lyric-text {
    display: inline-block;
    max-width: 100%;
    background-clip: text;
    -webkit-background-clip: text;
    transition: color 0.2s ease;
  }

  &.show-time .lyric-text {
    max-width: calc(100% - 96px);
  }

  .word-line {
    .word {
      display: inline;
      background-clip: text;
      -webkit-background-clip: text;
      transition: color 0.2s ease;
    }
  }
}

:deep(.n-scrollbar-rail) {
  opacity: 0;
}

:deep(.n-scrollbar-container) {
  transition: all 0.5s var(--ease-out-back);
  scroll-behavior: smooth;
}
</style>
