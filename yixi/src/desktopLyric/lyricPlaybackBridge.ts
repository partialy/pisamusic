import { watch } from "vue";
import { useAudioStore } from "@/store/audio";
import { useLyricStore } from "@/store/lyricStore";

const LYRIC_LOAD_DEBOUNCE_MS = 300;

/**
 * 常驻歌词与播放状态同步桥接：
 * 从 PlayerBar 上移到 App 根级，确保低能耗模式卸载主界面 UI 后切歌仍自动拉取歌词并同步时间。
 */
export function setupLyricPlaybackBridge(): () => void {
  const player = useAudioStore();
  const lyric = useLyricStore();

  let loadTimer: ReturnType<typeof setTimeout> | null = null;

  const stopTimeWatch = watch(
    () => player.currentTime,
    (val) => {
      lyric.currentTime = val;
    },
    { immediate: true },
  );

  const scheduleLoadLyric = () => {
    if (loadTimer !== null) {
      clearTimeout(loadTimer);
    }
    loadTimer = setTimeout(() => {
      loadTimer = null;
      lyric.currentSong = player.currentSong;
      void lyric.initLyric();
    }, LYRIC_LOAD_DEBOUNCE_MS);
  };

  const stopSongWatch = watch(
    () => player.currentSong,
    () => {
      scheduleLoadLyric();
    },
    { immediate: true, deep: true },
  );

  return () => {
    stopTimeWatch();
    stopSongWatch();
    if (loadTimer !== null) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }
  };
}
