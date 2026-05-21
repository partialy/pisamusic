<template>
  <div class="lyric-container">
    <Transition name="fade" mode="out-in">
      <n-scrollbar @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave" @wheel.passive="handleWheel">
        <template #default>
          <div class="lyric-wrapper">
            <div
              v-for="item in displayLyrics"
              :id="`lyric-${item.index}`"
              :key="item.line.startTime"
              class="lyric-item"
              :class="{ active: currentIndex === item.index }"
              :style="getItemStyle()"
              @click="playerStore.seek(item.time)">
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
import { debounce, formatDuration } from "@/utils/common";
import type { LyricWord } from "@/utils/common/LyricParser";
import {
  findLyricLineIndex,
  getLyricLineEndTime,
  getLyricLineText,
  normalizePlaybackTimeToMs,
} from "@/utils/lyricLine";
import { NScrollbar } from "naive-ui";
import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, ref, watch } from "vue";

const playerStore = useAudioStore();
const lyricStore = useLyricStore();
const { currentTime, isPlaying } = storeToRefs(playerStore);

const cursorIn = ref(false);
const userScroll = ref(false);
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

const lyricsScroll = (index: number) => {
  if (userScroll.value || index < 0) return;
  const row = document.getElementById(`lyric-${index}`);
  row?.scrollIntoView({ behavior: "smooth", block: "center" });
};

watch(currentIndex, (newVal, oldVal) => {
  if (newVal === oldVal) return;
  lyricsScroll(newVal);
});

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
    lyricsScroll(currentIndex.value);
  }
);

onBeforeUnmount(stopAnimation);

const handleMouseEnter = () => {
  cursorIn.value = true;
};

const handleMouseLeave = () => {
  cursorIn.value = false;
  userScroll.value = false;
};

const handleWheel = () => {
  userScroll.value = true;
  endScroll();
};

const endScroll = debounce(() => {
  userScroll.value = false;
}, 2000);
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
      transition: opacity 0.2s ease;
    }
  }

  .lyric-text {
    display: inline-block;
    max-width: calc(100% - 96px);
    background-clip: text;
    -webkit-background-clip: text;
    transition: color 0.2s ease;
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
