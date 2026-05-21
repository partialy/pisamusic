<template>
  <span class="player-bar-karaoke" :title="lineText">
    <span
      v-for="(word, index) in words"
      :key="`${word.startTime}-${index}-${word.word}`"
      class="karaoke-word"
      :style="getWordStyle(word)">
      {{ word.word }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { LyricLine, LyricWord } from "@/utils/common/LyricParser";
import { EMPTY_LYRIC_TEXT, getLyricLineText, normalizePlaybackTimeToMs } from "@/utils/lyricLine";

const props = withDefaults(
  defineProps<{
    line: LyricLine | null;
    currentTime: number;
    activeColor?: string;
    baseColor?: string;
  }>(),
  {
    activeColor: "var(--color-primary)",
    baseColor: "var(--color-text-secondary)",
  }
);

const currentTimeMs = computed(() => normalizePlaybackTimeToMs(props.currentTime));
const words = computed(() => props.line?.words ?? []);
const lineText = computed(() => getLyricLineText(props.line) || EMPTY_LYRIC_TEXT);

const getWordStyle = (word: LyricWord) => {
  const startTime = Number(word.startTime || props.line?.startTime || 0);
  const endTime = Number(word.endTime || props.line?.endTime || startTime);
  const duration = Math.max(endTime - startTime, 1);
  const progress = Math.max(0, Math.min(1, (currentTimeMs.value - startTime) / duration));
  const percent = progress * 100;

  return {
    backgroundImage: `linear-gradient(to right, ${props.activeColor} ${percent}%, ${props.baseColor} ${percent}%)`,
  };
};
</script>

<style scoped lang="scss">
.player-bar-karaoke {
  display: block;
  width: 100%;
  height: 28px;
  line-height: 28px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  .karaoke-word {
    display: inline;
    color: transparent;
    background-clip: text;
    -webkit-background-clip: text;
    transition: background-image 0.04s linear;
  }
}
</style>
