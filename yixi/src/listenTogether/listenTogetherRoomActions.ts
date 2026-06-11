// 一起听房间内用户动作：播放/暂停、seek、上一首/下一首、点播、队列项操作与自然结束。
// 统一播放命令层只与这组动作交互；返回 true 表示动作已被一起听接管（含被权限拦截），
// 返回 false 表示当前不在房间，调用方应走普通本地播放路径。

import type { ComputedRef, Ref } from "vue";
import type { Song } from "@/types/song";
import type {
  ListenTogetherAck,
  ListenTogetherRoom,
  ListenTogetherRoomAckData,
  ListenTogetherSocketCommand,
} from "@/types/listenTogether";
import { LISTEN_TOGETHER_QUEUE_COMMAND } from "@/types/listenTogether";
import {
  clampPositionMs,
  playerSecondsToProtocolMs,
} from "./listenTogetherRules";
import {
  canShareSong,
  songRefOf,
  toListenTogetherSong,
} from "./listenTogetherSong";
import type { ListenTogetherQueueEngine } from "./listenTogetherQueueEngine";

export type ListenTogetherRoomActionsContext = {
  enabled: ComputedRef<boolean>;
  isHost: ComputedRef<boolean>;
  syncingFromRemote: Ref<boolean>;
  room: Ref<ListenTogetherRoom | null>;
  currentUserId: Ref<string>;
  audio: {
    currentSong: () => Song | null;
    isPlaying: () => boolean;
    playPlayer: () => void;
    pausePlayer: () => void;
    seekSeconds: (seconds: number) => void;
    currentTimeSeconds: () => number;
    durationSeconds: () => number;
  };
  engine: ListenTogetherQueueEngine;
  emitCommand: <T = unknown>(command: ListenTogetherSocketCommand) => Promise<ListenTogetherAck<T>>;
  handleRoomAck: (ack: ListenTogetherAck<ListenTogetherRoomAckData>) => void;
  guardControl: () => boolean;
  beginTransition: () => string | null;
  toast: (message: string) => void;
};

export function createListenTogetherRoomActions(ctx: ListenTogetherRoomActionsContext) {
  function protoSongAndPosition(song: Song) {
    const protoSong = toListenTogetherSong(song);
    const durationMs =
      protoSong.duration || playerSecondsToProtocolMs(ctx.audio.durationSeconds());
    const position = clampPositionMs(
      playerSecondsToProtocolMs(ctx.audio.currentTimeSeconds()),
      durationMs,
    );
    return { protoSong, durationMs, position };
  }

  /** 播放/暂停：本地先行，再向房间同步状态 */
  async function setPlayingInRoom(playing: boolean): Promise<boolean> {
    if (!ctx.enabled.value) return false;
    if (!ctx.guardControl()) return true;
    const currentRoom = ctx.room.value;
    const song = ctx.audio.currentSong();
    if (!currentRoom || !song || !canShareSong(song)) return true;
    if (playing) {
      ctx.audio.playPlayer();
    } else {
      ctx.audio.pausePlayer();
    }
    const { protoSong, position } = protoSongAndPosition(song);
    const ack = playing
      ? await ctx.emitCommand<ListenTogetherRoomAckData>({
          type: "play",
          roomId: currentRoom.roomId,
          song: protoSong,
          position,
        })
      : await ctx.emitCommand<ListenTogetherRoomAckData>({
          type: "pause",
          roomId: currentRoom.roomId,
          songRef: songRefOf(protoSong),
          position,
        });
    ctx.handleRoomAck(ack);
    return true;
  }

  /** seek（秒）：本地先行 + 房间同步 */
  async function seekInRoom(seconds: number): Promise<boolean> {
    if (!ctx.enabled.value) return false;
    if (!ctx.guardControl()) return true;
    const currentRoom = ctx.room.value;
    const song = ctx.audio.currentSong();
    if (!currentRoom || !song || !canShareSong(song)) return true;
    ctx.audio.seekSeconds(seconds);
    const { protoSong, durationMs } = protoSongAndPosition(song);
    const ack = await ctx.emitCommand<ListenTogetherRoomAckData>({
      type: "seek",
      roomId: currentRoom.roomId,
      songRef: songRefOf(protoSong),
      position: clampPositionMs(playerSecondsToProtocolMs(seconds), durationMs),
    });
    ctx.handleRoomAck(ack);
    return true;
  }

  /** 上一首/下一首：房主移动权威指针，成员发 QUEUE_COMMAND */
  function offsetTrackInRoom(offset: 1 | -1): boolean {
    if (!ctx.enabled.value) return false;
    if (!ctx.guardControl()) return true;
    const transitionId = ctx.beginTransition();
    if (!transitionId) return true;
    if (ctx.isHost.value) {
      ctx.engine.playOffsetQueueItemAsHost(offset, transitionId);
    } else {
      ctx.engine.emitQueueCommand({
        command:
          offset > 0
            ? LISTEN_TOGETHER_QUEUE_COMMAND.next
            : LISTEN_TOGETHER_QUEUE_COMMAND.previous,
        transitionId,
      });
    }
    return true;
  }

  /** 点播歌曲（ADD_AND_PLAY） */
  function playSongInRoom(song: Song): boolean {
    if (!ctx.enabled.value) return false;
    if (!canShareSong(song)) {
      ctx.toast("本地歌曲暂不支持一起听");
      return true;
    }
    if (!ctx.guardControl()) return true;
    const transitionId = ctx.beginTransition();
    if (!transitionId) return true;
    if (ctx.isHost.value) {
      ctx.engine.addSongAndPlayAsHost(song, ctx.currentUserId.value, transitionId);
    } else {
      ctx.engine.emitQueueCommand({
        command: LISTEN_TOGETHER_QUEUE_COMMAND.addAndPlay,
        song: toListenTogetherSong(song),
        transitionId,
      });
    }
    return true;
  }

  /** 播放房间队列指定项（PLAY_ITEM） */
  function playQueueItemInRoom(queueItemId: string): boolean {
    if (!ctx.enabled.value) return false;
    if (!ctx.guardControl()) return true;
    const transitionId = ctx.beginTransition();
    if (!transitionId) return true;
    if (ctx.isHost.value) {
      ctx.engine.playQueueItemAsHost(queueItemId, transitionId);
    } else {
      ctx.engine.emitQueueCommand({
        command: LISTEN_TOGETHER_QUEUE_COMMAND.playItem,
        queueItemId,
        transitionId,
      });
    }
    return true;
  }

  /** 删除房间队列项（REMOVE_ITEM） */
  function removeQueueItemInRoom(queueItemId: string): boolean {
    if (!ctx.enabled.value) return false;
    if (!ctx.guardControl()) return true;
    if (ctx.isHost.value) {
      ctx.engine.removeQueueItemAsHost(queueItemId);
    } else {
      ctx.engine.emitQueueCommand({
        command: LISTEN_TOGETHER_QUEUE_COMMAND.removeItem,
        queueItemId,
      });
    }
    return true;
  }

  /**
   * 播放自然结束：房主按房间队列推进，无下一项才发 ENDED；
   * 成员不自行 next，等待房主 CHANGE_SONG/ENDED。返回 true 表示已被一起听接管。
   */
  function onTrackEndedInRoom(): boolean {
    if (!ctx.enabled.value) return false;
    if (!ctx.isHost.value) return true;
    if (ctx.syncingFromRemote.value) return true;
    const currentRoom = ctx.room.value;
    if (!currentRoom) return true;
    // 与手动 next 共用防抖窗口，避免歌尾手动切歌撞自动续播出双切
    const transitionId = ctx.beginTransition();
    if (!transitionId) return true;
    if (ctx.engine.playOffsetQueueItemAsHost(1, transitionId)) return true;
    const song = ctx.audio.currentSong();
    if (song && canShareSong(song)) {
      const protoSong = toListenTogetherSong(song);
      void ctx
        .emitCommand<ListenTogetherRoomAckData>({
          type: "ended",
          roomId: currentRoom.roomId,
          songRef: songRefOf(protoSong),
          position: protoSong.duration || playerSecondsToProtocolMs(ctx.audio.durationSeconds()),
          transitionId,
        })
        .then(ctx.handleRoomAck);
    }
    return true;
  }

  return {
    setPlayingInRoom,
    seekInRoom,
    offsetTrackInRoom,
    playSongInRoom,
    playQueueItemInRoom,
    removeQueueItemInRoom,
    onTrackEndedInRoom,
  };
}

export type ListenTogetherRoomActions = ReturnType<typeof createListenTogetherRoomActions>;
