<template>
  <Transition>
    <div 
      :key="amLyricsData?.[0]?.startTime"
      :class="['lyric-am', { pure: lyricStore.setting.pureLyricMode }]">
      <LyricPlayer
        :lyricLines="amLyricsData"
        :currentTime="
          Math.round(currentTime * 1000)
        "
        :playing="isPlaying"
        :enableSpring="lyricStore.setting.useAMSpring"
        :enableScale="lyricStore.setting.useAMScale"
        :alignPosition="lyricStore.setting.alignPosition"
        :enableBlur="lyricStore.setting.useAMBlur"
        :style="{
          '--amll-lyric-view-color': lyricStore.setting.lyricFontColor,
          '--amll-lyric-player-font-size':
            lyricStore.setting.lyricFontSize + 'px',
          'font-weight': lyricStore.setting.lyricFontWeight ? 'bold' : 'normal',
          'font-family':
            lyricStore.setting.lyricFont !== 'follow'
              ? lyricStore.setting.lyricFont
              : '',
        }"
        class="am-lyric"
        @line-click="jumpSeek" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { LyricPlayer } from "@applemusic-like-lyrics/vue";
import type { LyricLine as AMLyricLine } from "@applemusic-like-lyrics/core";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useLyricStore, useAudioStore, useListenTogetherStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";

const lyricStore = useLyricStore();
const playerStore = useAudioStore();
const listenTogether = useListenTogetherStore();
const playbackCommands = usePlaybackCommands();
const { isPlaying, currentTime } = storeToRefs(playerStore);

// 当前歌词
const amLyricsData = computed<AMLyricLine[]>(() => {
  return lyricStore.preferredAmLyrics;
});

// 进度跳转（统一播放命令层：一起听模式服从房间权限与同步）
const jumpSeek = (line: any) => {
  if (!line?.line?.lyricLine?.startTime) return;
  const time = line.line.lyricLine.startTime;
  playbackCommands.seekSeconds(time > 1000 ? time / 1000 : time);
  if (!listenTogether.enabled) playerStore.isPlaying = true;
};
</script>

<style lang="scss" scoped>
.lyric-am {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  filter: drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.2));
  mask: linear-gradient(
    180deg,
    hsla(0, 0%, 100%, 0) 0,
    hsla(0, 0%, 100%, 0.6) 5%,
    #fff 10%,
    #fff 75%,
    hsla(0, 0%, 100%, 0.6) 85%,
    hsla(0, 0%, 100%, 0)
  );

  :deep(.am-lyric) {
    width: 100%;
    height: 100%;
    position: absolute;
    left: 0;
    top: 0;
    padding-left: 10px;
    padding-right: 80px;
    margin-left: -2rem;
  }

  &.pure {
    text-align: center;

    :deep(.am-lyric) {
      margin: 0;
      padding: 0 80px;

      div {
        transform-origin: center;
      }
    }
  }
}
</style>
