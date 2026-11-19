<template>
  <div
    ref="containerRef"
    class="lyric-container"
    :class="{ pure: lyricStore.setting.pureLyricMode, 'show-time': lyricStore.setting.showTime, 'effect-mode': effectStyle }"
    :style="{ opacity: lyricStore.setting.lyricFontOpacity }">
    <Transition name="fade" mode="out-in">
      <n-scrollbar ref="scrollbarRef" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave" @wheel.passive="handleWheel">
        <template #default>
          <div ref="wrapperRef" class="lyric-wrapper" :style="wrapperStyle">
            <div
              v-for="item in displayLyrics"
              :data-lyric-index="item.index"
              :key="`${item.index}-${item.line.startTime}`"
              class="lyric-item"
              :class="{ active: currentIndex === item.index }"
              :style="getItemStyle()"
              role="button"
              tabindex="0"
              :aria-label="`跳转至 ${formatDuration(item.time)}，${item.text}`"
              :aria-current="currentIndex === item.index ? 'true' : undefined"
              @click="playbackCommands.seekSeconds(item.line.startTime / 1000)"
              @keydown.enter.prevent="playbackCommands.seekSeconds(item.line.startTime / 1000)"
              @keydown.space.prevent="playbackCommands.seekSeconds(item.line.startTime / 1000)">
              <PlayerEffectLyricLine
                v-if="effectStyle"
                class="lyric-text effect-text"
                :line="item.line"
                :end-time-ms="item.endTime"
                :active="currentIndex === item.index"
                :effect-style="effectStyle"
                :config="lyricStore.setting.styles[effectStyle]"
                :font="effectFont"
                :text-color="effectTextColor"
                :centered="lyricStore.setting.pureLyricMode"
                :word-mode="useWordProgress"
                :time-ms="currentIndex === item.index ? currentTimeMs : 0"
                :layout-revision="layoutRevision"
                :reduced-motion="reducedMotion"
                @layout="realignCurrentLine" />
              <span v-else-if="useWordProgress" class="lyric-text word-line">
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
} from "@/utils/lyricLine";
import { NScrollbar, type ScrollbarInst } from "naive-ui";
import { storeToRefs } from "pinia";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import PlayerEffectLyricLine from "./PlayerEffectLyricLine.vue";
import { getPlayerStyleTextColor, isPlayerEffectStyle } from "@/lyricStyles/playerLyricConfig";
import { getLyricStyleEffectPadding, type EffectFont } from "@/lyricStyles/lyricStyleEffects";
import { FrameRateLimiter } from "@/utils/frameRateLimiter";

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
const layoutRevision = ref(0);
const inheritedFont = ref("sans-serif");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const reducedMotion = ref(motionPreference.matches);
let disposed = false;
let mounted = false;
let resizeObserver: ResizeObserver | undefined;
let observedRow: HTMLElement | undefined;
let scrollTimeout: ReturnType<typeof setTimeout> | undefined;
const getViewport = () => containerRef.value?.querySelector<HTMLElement>(".n-scrollbar-container");
const wrapperStyle = computed(() => ({
  paddingTop: `${viewportHeight.value * lyricStore.setting.alignPosition}px`,
  paddingBottom: `${viewportHeight.value * (1 - lyricStore.setting.alignPosition)}px`,
}));
const secondsToMs = (seconds: number) => Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : 0;
const readAudioTimeMs = () => {
  const seek = playerStore.player?.seek();
  return secondsToMs(typeof seek === "number" ? seek : currentTime.value);
};
const currentTimeMs = ref(secondsToMs(currentTime.value));
const useWordProgress = computed(() => lyricStore.isKaraokeLyricEnabled);
const effectStyle = computed(() => isPlayerEffectStyle(lyricStore.setting.style) ? lyricStore.setting.style : null);
const effectTextColor = computed(() => getPlayerStyleTextColor(lyricStore.setting.style, lyricStore.setting.styles));
const effectFont = computed<EffectFont>(() => ({
  fontSize: lyricStore.setting.lyricFontSize,
  fontFamily: lyricStore.setting.lyricFont === "follow" ? inheritedFont.value : lyricStore.setting.lyricFont,
  fontWeight: lyricStore.setting.lyricFontWeight ? 700 : 400,
  shadowEnabled: lyricStore.setting.lyricFontShadow,
  autoOutline: false,
}));

let anchorTimeMs = currentTimeMs.value;
let anchorRafTimeMs = 0;
let rafId: number | null = null;

const displayLyrics = computed(() =>
  lyricStore.preferredLyrics.map((line, index) => ({
    index,
    line,
    text: getLyricLineText(line),
    time: line.startTime / 1000,
    endTime: getLyricLineEndTime(lyricStore.preferredLyrics, index),
  }))
);

const currentIndex = computed(() =>
  findLyricLineIndex(lyricStore.preferredLyrics, currentTimeMs.value)
);

const frameLimiter = new FrameRateLimiter(lyricStore.setting.fps);

watch(
  () => lyricStore.setting.fps,
  (fps) => {
    frameLimiter.setTargetFps(fps);
  },
);

const stopAnimation = () => {
  if (rafId === null) return;
  cancelAnimationFrame(rafId);
  rafId = null;
};

const renderFrame = (now: number) => {
  if (!isPlaying.value || document.hidden || reducedMotion.value || disposed) {
    stopAnimation();
    return;
  }
  if (frameLimiter.shouldDraw(now)) {
    currentTimeMs.value = anchorTimeMs + (now - anchorRafTimeMs);
  }
  rafId = requestAnimationFrame(renderFrame);
};

const startAnimation = () => {
  if (!mounted || !isPlaying.value || document.hidden || reducedMotion.value || disposed || rafId !== null) return;
  frameLimiter.reset();
  anchorTimeMs = readAudioTimeMs();
  currentTimeMs.value = anchorTimeMs;
  anchorRafTimeMs = performance.now();
  rafId = requestAnimationFrame(renderFrame);
};

const syncTimeAnchor = (timeMs = readAudioTimeMs()) => {
  anchorTimeMs = timeMs;
  currentTimeMs.value = anchorTimeMs;
  anchorRafTimeMs = performance.now();
};

const getItemStyle = () => ({
  fontSize: `${lyricStore.setting.lyricFontSize}px`,
  fontWeight: lyricStore.setting.lyricFontWeight ? "bold" : "normal",
  fontFamily: lyricStore.setting.lyricFont !== "follow" ? lyricStore.setting.lyricFont : "",
  paddingInline: effectStyle.value
    ? `min(${getLyricStyleEffectPadding(effectStyle.value, lyricStore.setting.styles[effectStyle.value], lyricStore.setting.lyricFontSize)}px, 12%)`
    : undefined,
});

const getLineTextStyle = (index: number) => ({
  color: currentIndex.value === index
    ? lyricStore.setting.styles.default.highlightColor
    : lyricStore.setting.styles.default.textColor,
  textShadow: lyricStore.setting.lyricFontShadow ? "0 2px 10px rgba(0, 0, 0, 0.18)" : "none",
});

const getWordStyle = (index: number, word: LyricWord) => {
  const baseColor = lyricStore.setting.styles.default.textColor;
  const activeColor = lyricStore.setting.styles.default.highlightColor;
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
  const nextRow = findRow(currentIndex.value) ?? undefined;
  if (nextRow === observedRow) return;
  if (observedRow) resizeObserver?.unobserve(observedRow);
  observedRow = nextRow;
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
    behavior: reducedMotion.value ? "auto" : "smooth",
  });
};

const realignCurrentLine = () => {
  if (disposed) return;
  observeCurrentRow();
  lyricsScroll(currentIndex.value);
};

const refreshLayout = () => {
  if (disposed) return;
  inheritedFont.value = containerRef.value
    ? getComputedStyle(containerRef.value).fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "")
    : "sans-serif";
  viewportHeight.value = getViewport()?.clientHeight ?? containerRef.value?.clientHeight ?? 0;
  layoutRevision.value++;
  void nextTick(realignCurrentLine);
};

const handleVisibilityChange = () => {
  stopAnimation();
  syncTimeAnchor();
  if (!document.hidden) {
    startAnimation();
    void nextTick(realignCurrentLine);
  }
};

const handleMotionChange = () => {
  reducedMotion.value = motionPreference.matches;
  stopAnimation();
  syncTimeAnchor();
  startAnimation();
};

watch(currentIndex, (newVal, oldVal) => {
  if (newVal === oldVal) return;
  observeCurrentRow();
  lyricsScroll(newVal);
}, { flush: "post" });

watch(
  currentTime,
  (time) => {
    syncTimeAnchor(secondsToMs(time));
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
      syncTimeAnchor();
    }
  },
  { immediate: true }
);

watch(
  () => lyricStore.preferredLyrics,
  () => {
    syncTimeAnchor();
    clearTimeout(scrollTimeout);
    userScroll.value = false;
    layoutRevision.value++;
    observeCurrentRow();
    lyricsScroll(currentIndex.value);
  },
  { flush: "post" }
);

watch(
  () => [lyricStore.setting.style, lyricStore.setting.showTime, lyricStore.setting.alignPosition, lyricStore.setting.alignAnchor, lyricStore.setting.pureLyricMode, lyricStore.setting.lyricFontSize, lyricStore.setting.lyricFont, lyricStore.setting.lyricFontWeight],
  refreshLayout,
  { flush: "post" }
);

onMounted(() => {
  mounted = true;
  resizeObserver = new ResizeObserver(() => {
    // 高度变化只需重新对齐；宽度与字号变化由当前行自己的观察器重排。
    viewportHeight.value = getViewport()?.clientHeight ?? containerRef.value?.clientHeight ?? 0;
    void nextTick(realignCurrentLine);
  });
  if (containerRef.value) resizeObserver.observe(containerRef.value);
  if (wrapperRef.value) resizeObserver.observe(wrapperRef.value);
  observeCurrentRow();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  motionPreference.addEventListener("change", handleMotionChange);
  document.fonts?.addEventListener("loadingdone", refreshLayout);
  void document.fonts?.ready.then(refreshLayout);
  refreshLayout();
  startAnimation();
});

onBeforeUnmount(() => {
  disposed = true;
  mounted = false;
  stopAnimation();
  resizeObserver?.disconnect();
  clearTimeout(scrollTimeout);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  motionPreference.removeEventListener("change", handleMotionChange);
  document.fonts?.removeEventListener("loadingdone", refreshLayout);
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
    padding-block: 40px !important;
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
    box-sizing: border-box;
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
    cursor: pointer;
    line-height: 1.45;
    overflow-wrap: anywhere;

    &:focus-visible {
      outline: 2px solid var(--text-accent);
      outline-offset: -2px;
    }

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
    white-space: pre-wrap;
    overflow-wrap: anywhere;
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

  &.effect-mode .lyric-item { opacity: 0.65; }
  .effect-text { display: block; }
  &.pure .effect-text { margin-inline: auto; }
}

:deep(.n-scrollbar-rail) {
  opacity: 0;
}

:deep(.n-scrollbar-container) {
  transition: all 0.5s var(--ease-out-back);
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  .lyric-container .lyric-item { transition: none; transform: none; }
  :deep(.n-scrollbar-container) { scroll-behavior: auto; transition: none; }
}
</style>
