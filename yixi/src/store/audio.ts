import { defineStore } from "pinia";
import { Howl } from "howler"; // 音频播放库
import { ref, computed, watch } from "vue";
import type { Song } from "@/types/song";
import { getKgImage } from "../utils/common";
import { getDynamicCover, getPlayableUrlByMusicApi } from "@/utils/api/musicAPI";
import electronAPI from "@/utils/electron";
import { normalizeSong } from "@/utils/song";
import { useLibraryStore } from "./library";
import { reportError } from "@/utils/errorReporter";


// 定义重复播放模式的类型
export type RepeatMode = "all" | "none" | "single" | "random";

type AudioStateSnapshot = {
  volume: number;
  repeatMode: RepeatMode;
  playlist: Song[];
  currentSongId?: string;
};

export const useAudioStore = defineStore("audio", () => {
  const libraryStore = useLibraryStore();
  // State (状态)
  const player = ref<Howl | null>(null); // Howl音频播放器实例
  const currentSong = ref<Song | null>(null); // 当前播放的歌曲
  const playlist = ref<Song[]>([]); // 播放列表
  const interCount = ref(0);
  const isPlaying = ref(false); // 是否正在播放
  const currentTime = ref(0); // 当前播放时间(秒)
  const duration = ref(0); // 歌曲总时长(秒)
  const volume = ref(0.8); // 音量(0-1)
  const repeatMode = ref<RepeatMode>("all"); // 重复模式
  const loading = ref(false); // 音频加载状态
  const firstPlay = ref(true);

  // 私有变量 - 用于更新播放进度的定时器
  // @ts-ignore
  let progressInterval: NodeJS.Timeout | null = null;
  let restoringState = false;
  let handlingPlaybackFailure = false;
  let failureSkipCount = 0;

  // Getters (计算属性)
  const progress = computed<number>(() => {
    return duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0;
  });

  const origin = computed(() => {
    if (currentSong.value) {
      return currentSong.value.source;
    }
    return "kg";
  });

  // 格式化后的时间显示(MM:SS)
  const formattedTime = computed<string>(() => {
    return formatTime(currentTime.value);
  });

  // Actions (操作方法)

  /**
   * 初始化音频播放器
   * @param url 音频文件URL
   */
  const initPlayer = (url: string): void => {
    destroyPlayer(); // 先销毁现有的播放器

    player.value = new Howl({
      src: [url],
      html5: true, // 使用HTML5 Audio API
      volume: volume.value,
      onplay: () => {
        failureSkipCount = 0;
        handlingPlaybackFailure = false;
        isPlaying.value = true;
        startProgressUpdate(); // 开始更新播放进度
      },
      onpause: () => {
        isPlaying.value = false;
      },
      onstop: () => {
        isPlaying.value = false;
      },
      onend: handleTrackEnd, // 歌曲结束时的处理
      onload: () => {
        if (player.value) {
          duration.value = player.value.duration(); // 获取歌曲总时长
          initMediaSession();
          player.value.play();
        }
      },
      onseek: () => {
        updateCurrentTime();
      }, // 跳转时的处理
      onloaderror: handlePlaybackFailure,
      onplayerror: handlePlaybackFailure,
    });
  };

  /**
   * 初始化 MediaSession
   */
  const initMediaSession = () => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => play());
    navigator.mediaSession.setActionHandler("pause", () => pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    // 跳转进度
    navigator.mediaSession.setActionHandler("seekto", (event) => {
      if (event.seekTime) seek(event.seekTime);
    });
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: currentSong.value?.name,
      artist: currentSong.value?.singer,
      album: currentSong.value?.album,
      artwork: [
        {
          src: getKgImage(currentSong.value?.cover, 240),
          sizes: "240x240",
          type: "image/png",
        },
      ],
    });
  };

  /**
   * 播放歌曲
   * @param song 要播放的歌曲(可选)
   */
  const play = async (song?: Song | null): Promise<void> => {
    let shouldSignalPlay = false;
    try {
      loading.value = true;
      if (firstPlay.value) {
        firstPlay.value = false;
        if (!song) {
          song = currentSong.value || playlist.value[0] || null;
        }
      }
      if (song) {
        currentTime.value = 0;
        duration.value = 0;
        song.url = await getPlayableUrlByMusicApi(song);
        if (!song.url) {
          throw new Error("play url is empty");
        }
        currentSong.value = song;
        recordPlayHistory(song);
        initPlayer(song.url); // 初始化播放器并加载歌曲
        shouldSignalPlay = true;
        return;
      }

      if (player.value) {
        player.value.play(); // 开始播放
        shouldSignalPlay = true;
      }
    } catch (error) {
      loading.value = false;
      console.error("播放歌曲失败:", error);
      void electronAPI.reportError(error, {
        scope: "audio",
        action: "play",
        songId: song?.id || currentSong.value?.id,
        source: song?.source || currentSong.value?.source,
      });
      handlePlaybackFailure();
    } finally {
      loading.value = false;
      if (shouldSignalPlay) {
        electronAPI.mediaControl("play");
        electronAPI.isPlaying(true);
      }
    }
  };

  // 暂停播放
  const pause = (): void => {
    if (player.value) {
      player.value.pause();
      isPlaying.value = false;
      electronAPI.mediaControl("pause");
      electronAPI.isPlaying(false);
    }
  };

  // 切换播放/暂停状态
  const togglePlay = (): void => {
    isPlaying.value ? pause() : play();
  };

  /**
   *
   * @param list 播放列表
   * @param _play 是否播放
   */
  const setPlaylist = async (list: Song[], _play?: Boolean) => {
    if (playlist.value.length == 0) {
      playlist.value = list;
    } else {
      playlist.value = [...playlist.value, ...list];
    }

    if (_play && list.length) {
      await play(list[0]);
    }
  };

  /**
   * 切换列表
   * @param list song[]
   * @param autoPlay default = true
   */
  const switchPlayList = async (list: Song[], autoPlay: Boolean = true) => {
    playlist.value = list;
    if (list.length && autoPlay) {
      await play(list[0]);
    }
  };

  /**
   * 移除歌曲
   * @param song
   */
  const removeFromPlaylist = (song: Song): void => {
    playlist.value = playlist.value.filter((s) => s.id !== song.id);
  };

  /**
   * 插播
   * @param song
   */
  const nextPlay = (song: Song): void => {
    const currentIndex = getCurrentIndex();
    if (currentIndex === -1) {
      playlist.value.push(song);
    } else {
      interCount.value++;
      playlist.value.splice(currentIndex + 1, 0, song);
    }
  };

  /**
   * 销毁播放器实例
   */
  const reset = (): void => {
    destroyPlayer(); // 销毁播放器
    playlist.value = []; // 清空播放列表
    currentSong.value = null; // 清空当前歌曲
    currentTime.value = 0; // 重置当前播放时间
    duration.value = 0; // 重置歌曲总时长
    volume.value = 0.8; // 重置音量
    repeatMode.value = "all"; // 重置重复模式
  };

  /**
   * 播放下一首
   */
  const next = (): void => {
    if (!playlist.value.length) return;
    if (playlist.value.length === 1 || repeatMode.value === "single") {
      play(playlist.value[0]);
      return;
    }
    if (repeatMode.value == "none") {
      const index = playlist.value.findIndex(
        (s) => s.id === currentSong.value?.id
      );
      if (index == playlist.value.length - 1) {
        pause();
        destroyPlayer();
        return;
      }
    }

    let nextIndex: number;
    if (repeatMode.value === "random") {
      if (interCount.value > 0) {
        const currentIndex = getCurrentIndex();
        nextIndex = (currentIndex + 1) % playlist.value.length;
        interCount.value--;
      } else {
        nextIndex = getRandomIndex();
      }
    } else {
      // 顺序播放模式下获取下一首索引
      const currentIndex = getCurrentIndex();
      nextIndex = (currentIndex + 1) % playlist.value.length;
    }
    play(playlist.value[nextIndex]);
  };

  /**
   * 播放上一首
   */
  const prev = (): void => {
    if (!playlist.value.length) return;
    if (playlist.value.length === 1) {
      play(playlist.value[0]);
      return;
    }

    const currentIndex = playlist.value.findIndex(
      (s) => s.id === currentSong.value?.id
    );
    // 计算上一首的索引(循环处理)
    const prevIndex =
      (currentIndex - 1 + playlist.value.length) % playlist.value.length;
    play(playlist.value[prevIndex]);
  };

  /**
   * 跳转到指定时间
   * @param time 要跳转的时间(秒)
   */
  const seek = (time: number): void => {
    if (player.value) {
      player.value.seek(time);
      updateCurrentTime();
    }
  };

  /**
   * 设置音量
   * @param val 音量值(0-1)
   */
  const setVolume = (val: number): void => {
    volume.value = val;
    if (player.value) {
      player.value.volume(val);
    }
  };

  watch(()=> volume.value,()=>{
    setVolume(volume.value)
  })

  // 切换重复播放模式
  const toggleRepeat = (): void => {
    const modes: RepeatMode[] = ["single", "random", "all"];
    const currentIndex = modes.indexOf(repeatMode.value);
    repeatMode.value = modes[(currentIndex + 1) % modes.length];
  };

  // 私有方法

  /**
   * 开始更新播放进度(每秒更新一次)
   */
  const startProgressUpdate = (): void => {
    stopProgressUpdate();
    progressInterval = setInterval(updateCurrentTime, 300);
  };

  // 停止更新播放进度
  const stopProgressUpdate = (): void => {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  };

  // 更新当前播放时间
  const updateCurrentTime = (): void => {
    if (player.value) {
      currentTime.value = player.value.seek();
    }
  };

  /**
   * 处理歌曲结束时的逻辑
   */
  const handleTrackEnd = (): void => {
    if (repeatMode.value === "single") {
      // 单曲循环模式下重新播放当前歌曲
      play(currentSong.value);
    } else if (repeatMode.value === "all" || repeatMode.value === "random") {
      // 列表循环或随机播放模式下播放下一首
      next();
    } else {
      // 其他情况停止播放
      isPlaying.value = false;
    }
  };

  // 销毁播放器实例
  const destroyPlayer = (): void => {
    stopProgressUpdate();
    if (player.value) {
      player.value.off(); // 移除所有事件监听
      player.value.stop(); // 停止播放
      player.value = null;
    }
  };

  /**
   * 格式化时间为MM:SS格式
   * @param seconds 总秒数
   * @returns 格式化后的时间字符串
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  /**
   * 获取随机索引(用于随机播放)
   * @returns 随机索引
   */
  const getRandomIndex = (): number => {
    return Math.floor(Math.random() * playlist.value.length);
  };

  // 监听状态变化并持久化到localStorage
  watch(
    [volume, repeatMode, playlist, currentSong],
    () => {
      saveState();
    },
    { deep: true }
  );

  const fetchWYCover = async () => {
    const song = currentSong.value;
    if (!song || song.source != "wy") return;

    try {
      const res: any = await getDynamicCover(song.id);
      if (currentSong.value?.id !== song.id) return;
      currentSong.value.d_cover = res?.data?.videoPlayUrl || undefined;
    } catch (error) {
      void reportError(error, {
        scope: "audio",
        action: "fetchWYCover",
        songId: song.id,
        source: song.source,
      });
    }
  };

  watch(() => currentSong.value?.id, fetchWYCover);

  // 状态持久化

  /**
   * 将状态保存到localStorage
   */
  const saveState = (): void => {
    if (restoringState) return;
    const state = {
      volume: volume.value,
      repeatMode: repeatMode.value,
      playlist: playlist.value,
      currentSongId: currentSong.value?.id,
    };
    localStorage.setItem("audioState", JSON.stringify(state));
    void electronAPI.setSetting("audioState", {
      volume: volume.value,
      repeatMode: repeatMode.value,
      currentSongId: currentSong.value?.id,
    });
    void libraryStore.saveQueueSnapshot(
      getCurrentIndex(),
      playlist.value.map(toPersistedSong)
    );
  };

  const handlePlaybackFailure = (): void => {
    if (handlingPlaybackFailure) return;
    handlingPlaybackFailure = true;
    loading.value = false;
    isPlaying.value = false;
    electronAPI.isPlaying(false);
    destroyPlayer();
    window.$notification?.error({
      title: "播放失败，可尝试切换其他音源",
      duration: 2000,
    });

    void electronAPI.reportError(new Error("playback failed"), {
      scope: "audio",
      action: "handlePlaybackFailure",
      songId: currentSong.value?.id,
      source: currentSong.value?.source,
    });

    if (playlist.value.length > 1 && failureSkipCount < playlist.value.length - 1) {
      failureSkipCount += 1;
      setTimeout(() => {
        handlingPlaybackFailure = false;
        next();
      }, 300);
      return;
    }

    failureSkipCount = 0;
    handlingPlaybackFailure = false;
  };

  /**
   * 从localStorage加载状态
   */
  const loadState = async (): Promise<void> => {
    restoringState = true;
    try {
      restoreFromLocalStorage();
      const [setting, queueSnapshot] = await Promise.all([
        electronAPI.getSetting<Pick<AudioStateSnapshot, "volume" | "repeatMode" | "currentSongId">>("audioState"),
        libraryStore.loadQueueSnapshot(),
      ]);
      if (setting?.value) {
        volume.value = setting.value.volume ?? volume.value;
        repeatMode.value = setting.value.repeatMode ?? repeatMode.value;
      }
      if (queueSnapshot.queue.length) {
        playlist.value = queueSnapshot.queue as unknown as Song[];
        currentSong.value =
          playlist.value[queueSnapshot.currentIndex] || playlist.value[0] || null;
      } else if (setting?.value?.currentSongId) {
        currentSong.value =
          playlist.value.find((s) => s.id === setting.value.currentSongId) ||
          currentSong.value;
      }
    } finally {
      restoringState = false;
    }
  };

  const restoreFromLocalStorage = (): void => {
    const saved = localStorage.getItem("audioState");
    if (!saved) return;
    try {
      const state = JSON.parse(saved) as AudioStateSnapshot;
      volume.value = state.volume ?? volume.value;
      repeatMode.value = state.repeatMode ?? repeatMode.value;
      playlist.value = state.playlist ?? [];
      if (state.currentSongId) {
        // 从播放列表中查找当前歌曲
        currentSong.value =
          playlist.value.find((s) => s.id === state.currentSongId) || null;
      }
    } catch {
      localStorage.removeItem("audioState");
    }
  };

  const toPersistedSong = (song: Song): Song => normalizeSong(song);

  const recordPlayHistory = (song: Song): void => {
    void libraryStore.addPlayHistory(toPersistedSong(song));
  };

  const getCurrentIndex = (): number => {
    if (!playlist.value.length) return -1;
    return playlist.value.findIndex((s) => s.id == currentSong.value?.id);
  };

  // 初始化 - 加载保存的状态
  void loadState();

  return {
    // State
    player,
    currentSong,
    origin,
    playlist,
    isPlaying,
    currentTime,
    duration,
    volume,
    repeatMode,
    loading,

    // Getters
    progress,
    formattedTime,

    // Actions
    initPlayer,
    play,
    pause,
    togglePlay,
    nextPlay,
    next,
    prev,
    seek,
    setVolume,
    toggleRepeat,
    destroyPlayer,
    setPlaylist,
    switchPlayList,
    getCurrentIndex,
    removeFromPlaylist,
    reset,
    saveState,
    loadState,
  };
});

// 为store添加类型
export type AudioStore = ReturnType<typeof useAudioStore>;
