<template>
  <Transition>
    <div 
      :key="amLyricsData?.[0]?.startTime"
      :class="['lyric-am', { pure: lyricStore.setting.pureLyricMode }]"
      :style="{
        opacity: lyricStore.setting.lyricFontOpacity,
        filter: lyricStore.setting.lyricFontShadow ? 'drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.2))' : 'none',
      }">
      <LyricPlayer
        :lyricLines="amLyricsData"
        :currentTime="
          Math.round(currentTime * 1000)
        "
        :playing="isPlaying"
        :enableSpring="style.spring"
        :enableScale="style.scale"
        :alignPosition="lyricStore.setting.alignPosition"
        :alignAnchor="lyricStore.setting.alignAnchor"
        :hidePassedLines="style.hidePassedLines"
        :enableBlur="style.blur"
        :style="{
          '--amll-lyric-view-color': style.textColor,
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
import { useLyricStore, useAudioStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";

const lyricStore = useLyricStore();
const playerStore = useAudioStore();
const playbackCommands = usePlaybackCommands();
const { isPlaying, currentTime } = storeToRefs(playerStore);
const style = computed(() => lyricStore.setting.styles.amlyric);

// 当前歌词
const amLyricsData = computed<AMLyricLine[]>(() => {
  return lyricStore.preferredAmLyrics;
});

// 进度跳转（统一播放命令层：一起听模式服从房间权限与同步）
const jumpSeek = (line: any) => {
  const time = line?.line?.lyricLine?.startTime;
  if (typeof time !== "number" || !Number.isFinite(time) || time < 0) return;
  void playbackCommands.seekSeconds(time / 1000);
};
</script>

<style lang="scss" scoped>
.lyric-am {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
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
    transition: padding 0.6s cubic-bezier(0.25, 1, 0.5, 1), margin 0.6s cubic-bezier(0.25, 1, 0.5, 1);
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
