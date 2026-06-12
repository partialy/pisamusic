// 统一播放命令层：所有用户主动播放动作的唯一入口。
// 普通模式委托 useAudioStore()；一起听模式委托 useListenTogetherStore()，
// 由其判断连接、权限、本地歌曲与房主/成员路径。任何 UI（按钮、托盘、快捷键、
// MediaSession、歌词点击、右键菜单、列表双击）都不允许绕过本层直接操作播放器。

import type { Song } from "@/types/song";
import { useAudioStore } from "@/store/audio";
import { useListenTogetherStore } from "@/store/listenTogether";

function toastInfo(message: string): void {
  window.$message?.info?.(message);
}

export function usePlaybackCommands() {
  const audio = useAudioStore();
  const listenTogether = useListenTogetherStore();

  /** 单曲点播（右键“播放”、首页卡片点击等追加语义） */
  const playSingle = (song: Song): void => {
    if (listenTogether.playSongInRoom(song)) return;
    void audio.setPlaylist([song], true);
    window.$message?.success?.(`开始播放 ${song.name}`);
  };

  /** 列表内点播：普通模式整列表切换后播放该曲；一起听模式只点播该曲 */
  const playSongFromList = (songs: Song[], song: Song): void => {
    if (listenTogether.playSongInRoom(song)) return;
    void audio.switchPlayList(songs, false);
    void audio.play(song);
  };

  /**
   * 播放全部：普通模式切换整个播放列表；
   * 一起听模式 PM 协议无批量队列命令，降级为点播首曲并提示。
   * 返回 true 表示普通模式整列表已生效（调用方可据此提示）。
   */
  const playAll = async (songs: Song[], autoPlay: boolean = true): Promise<boolean> => {
    if (songs.length === 0) return false;
    if (listenTogether.enabled) {
      toastInfo("一起听中暂不支持整列表播放，已为你点播第一首");
      listenTogether.playSongInRoom(songs[0]);
      return false;
    }
    await audio.switchPlayList(songs, autoPlay);
    return true;
  };

  /**
   * 添加到播放列表（不播放）：一起听协议无 ADD_ONLY，房间内禁用。
   * 返回 true 表示普通模式已添加（调用方可据此提示）。
   */
  const appendToPlaylist = async (songs: Song[]): Promise<boolean> => {
    if (listenTogether.enabled) {
      toastInfo("一起听中暂不支持仅添加到队列，请直接点播");
      return false;
    }
    await audio.setPlaylist(songs);
    return true;
  };

  /** 下一首播放（插播）：一起听协议无 PLAY_NEXT，房间内禁用 */
  const playNext = (song: Song): void => {
    if (listenTogether.enabled) {
      toastInfo("一起听中暂不支持插播，请直接点播");
      return;
    }
    audio.nextPlay(song);
  };

  /** 播放队列项：一起听按 queueItemId 定位，普通模式按歌曲播放 */
  const playQueueItem = (queueItemId: string | null, song: Song): void => {
    if (queueItemId && listenTogether.playQueueItemInRoom(queueItemId)) return;
    void audio.play(song);
  };

  /** 删除队列项：一起听按 queueItemId 删除，普通模式沿用本地列表删除 */
  const removeQueueItem = (queueItemId: string | null, song: Song): void => {
    if (queueItemId && listenTogether.removeQueueItemInRoom(queueItemId)) return;
    audio.removeFromPlaylist(song);
  };

  /** 播放/暂停切换 */
  const togglePlayPause = (): void => {
    if (listenTogether.enabled) {
      void listenTogether.setPlayingInRoom(!audio.isPlaying);
      return;
    }
    audio.togglePlay();
  };

  /** 明确设置播放状态（托盘/媒体事件） */
  const setPlaying = (playing: boolean): void => {
    if (listenTogether.enabled) {
      void listenTogether.setPlayingInRoom(playing);
      return;
    }
    if (playing) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  const next = (): void => {
    if (listenTogether.offsetTrackInRoom(1)) return;
    audio.next();
  };

  const prev = (): void => {
    if (listenTogether.offsetTrackInRoom(-1)) return;
    audio.prev();
  };

  /** 进度跳转（秒）：进度条、歌词点击/拖动共用 */
  const seekSeconds = (seconds: number): void => {
    if (listenTogether.enabled) {
      void listenTogether.seekInRoom(seconds);
      return;
    }
    audio.seek(seconds);
  };

  /** 清空播放队列：一起听房间内禁用 */
  const clearPlaylist = (): boolean => {
    if (listenTogether.enabled) {
      toastInfo("一起听中不支持清空队列");
      return false;
    }
    audio.reset();
    return true;
  };

  return {
    playSingle,
    playSongFromList,
    playAll,
    appendToPlaylist,
    playNext,
    playQueueItem,
    removeQueueItem,
    togglePlayPause,
    setPlaying,
    next,
    prev,
    seekSeconds,
    clearPlaylist,
  };
}

export type PlaybackCommands = ReturnType<typeof usePlaybackCommands>;

/**
 * 安装播放器内部旁路桥接：MediaSession、自然结束续播、失败自动跳过
 * 这三类不是用户直接点击的入口，由 audio store 在内部回调本桥接，
 * 一起听模式下交给房间状态机接管。应用启动时调用一次。
 */
export function setupPlaybackBridge(): void {
  const audio = useAudioStore();
  const listenTogether = useListenTogetherStore();
  listenTogether.ensureListeners();
  audio.setPlaybackBridge({
    onTrackEnded: () => listenTogether.onTrackEndedInRoom(),
    // 一起听中播放失败不允许本地自动跳到下一曲，避免成员与房间脱节
    onPlaybackFailureAutoSkip: () => listenTogether.enabled,
    mediaPlay: () => {
      if (!listenTogether.enabled) return false;
      void listenTogether.setPlayingInRoom(true);
      return true;
    },
    mediaPause: () => {
      if (!listenTogether.enabled) return false;
      void listenTogether.setPlayingInRoom(false);
      return true;
    },
    mediaNext: () => listenTogether.offsetTrackInRoom(1),
    mediaPrev: () => listenTogether.offsetTrackInRoom(-1),
    mediaSeek: (seconds: number) => {
      if (!listenTogether.enabled) return false;
      void listenTogether.seekInRoom(seconds);
      return true;
    },
  });
}
