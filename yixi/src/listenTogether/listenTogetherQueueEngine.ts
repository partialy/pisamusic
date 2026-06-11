// 一起听房主权威队列引擎：QUEUE_EVENT 协议（快照/增量/命令）收发与房主队列操作。
// 由 listenTogether store 注入上下文创建，本模块不定义 Pinia 状态，便于职责分离与复用。

import type { ComputedRef, Ref } from "vue";
import type { Song } from "@/types/song";
import type {
  ListenTogetherAck,
  ListenTogetherErrorCode,
  ListenTogetherQueueCommand,
  ListenTogetherQueueDelta,
  ListenTogetherQueueEventData,
  ListenTogetherQueueItem,
  ListenTogetherQueueSnapshotChunk,
  ListenTogetherQueueState,
  ListenTogetherRoom,
  ListenTogetherRoomAckData,
  ListenTogetherSocketCommand,
  ListenTogetherSong,
} from "@/types/listenTogether";
import {
  LISTEN_TOGETHER_QUEUE_COMMAND,
  LISTEN_TOGETHER_QUEUE_KIND,
  LISTEN_TOGETHER_QUEUE_SNAPSHOT_CHUNK_DELAY_MS,
} from "@/types/listenTogether";
import {
  appendQueueItem,
  applyQueueDelta,
  applySnapshotChunk,
  buildSnapshotChunks,
  currentQueueIndex,
  removeQueueItem,
  resolveQueuePointer,
  wrapAroundIndex,
  type SnapshotAssembly,
} from "./listenTogetherQueue";
import {
  canShareSong,
  fromListenTogetherSong,
  sanitizeProtocolSong,
  songKeyOf,
  songRefOf,
  toListenTogetherSong,
} from "./listenTogetherSong";
import { playerSecondsToProtocolMs } from "./listenTogetherRules";
import { reportError } from "@/utils/errorReporter";

/** store 注入给队列引擎的上下文：状态引用 + 通信/防抖/加载能力 */
export type ListenTogetherQueueEngineContext = {
  queue: Ref<ListenTogetherQueueState>;
  room: Ref<ListenTogetherRoom | null>;
  currentUserId: Ref<string>;
  isHost: ComputedRef<boolean>;
  audio: {
    currentSong: () => Song | null;
    playlist: () => Song[];
    pausePlayer: () => void;
    currentTimeSeconds: () => number;
  };
  emitCommand: <T = unknown>(command: ListenTogetherSocketCommand) => Promise<ListenTogetherAck<T>>;
  handleRoomAck: (ack: ListenTogetherAck<ListenTogetherRoomAckData>) => void;
  handleAckFailure: (errorMsg: ListenTogetherErrorCode | undefined, message: string) => void;
  beginTransition: () => string | null;
  adoptTransition: (transitionId: string) => void;
  endTransition: (transitionId: string | null | undefined, action: string) => void;
  loadSongGated: (song: Song, options: { autoPlay: boolean; seekMs?: number }) => Promise<boolean>;
  /** 房主切歌执行中标记（心跳跳过 + 旧任务不覆盖新任务），与 store 共享 */
  hostPlayback: { activeTransitionId: string | null };
  toast: (message: string) => void;
  toastError: (message: string) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createListenTogetherQueueEngine(ctx: ListenTogetherQueueEngineContext) {
  let snapshotAssembly: SnapshotAssembly | null = null;

  /** 离开房间/账号切换时重置协议内部状态 */
  function resetProtocol(): void {
    snapshotAssembly = null;
  }

  function makeQueueItem(song: Song, addedByUserId: string): ListenTogetherQueueItem {
    return {
      queueItemId: crypto.randomUUID(),
      song: toListenTogetherSong(song),
      addedByUserId,
      addedAt: Date.now(),
    };
  }

  /** 房主第一次进入房间（或队列为空）时，用当前在线播放列表初始化权威队列 */
  function ensureHostQueueInitialized(): void {
    if (!ctx.isHost.value || ctx.queue.value.items.length > 0) return;
    const currentSong = ctx.audio.currentSong();
    const songs = ctx.audio.playlist().filter((song) => song.source !== "local");
    if (currentSong && canShareSong(currentSong)) {
      const exists = songs.some((song) => songKeyOf(song) === songKeyOf(currentSong));
      if (!exists) songs.unshift(currentSong);
    }
    if (songs.length === 0) return;
    const items = songs.map((song) => makeQueueItem(song, ctx.currentUserId.value));
    const currentItemId = currentSong
      ? (items.find((item) => songKeyOf(item.song) === songKeyOf(currentSong))?.queueItemId ??
        items[0]?.queueItemId ??
        null)
      : (items[0]?.queueItemId ?? null);
    ctx.queue.value = {
      queueVersion: ctx.queue.value.queueVersion + 1,
      currentItemId,
      items,
      syncing: false,
      snapshotId: null,
    };
  }

  // ------------------------------------------------------------------
  // 协议收发
  // ------------------------------------------------------------------
  function handleQueueEvent(data: ListenTogetherQueueEventData): void {
    const kind = data.kind ?? "";
    const fromUserId = data.fromUserId ?? "";
    if (fromUserId && fromUserId === ctx.currentUserId.value) return;
    switch (kind) {
      case LISTEN_TOGETHER_QUEUE_KIND.snapshotRequest:
        if (ctx.isHost.value && fromUserId) void sendQueueSnapshot(fromUserId);
        return;
      case LISTEN_TOGETHER_QUEUE_KIND.snapshotChunk:
        applyIncomingSnapshotChunk(data as ListenTogetherQueueSnapshotChunk);
        return;
      case LISTEN_TOGETHER_QUEUE_KIND.command:
        if (ctx.isHost.value && fromUserId) {
          handleQueueCommandAsHost(fromUserId, data as ListenTogetherQueueCommand);
        }
        return;
      case LISTEN_TOGETHER_QUEUE_KIND.delta: {
        const delta = data as ListenTogetherQueueDelta;
        const next = applyQueueDelta(ctx.queue.value, {
          queueVersion: delta.queueVersion ?? 0,
          currentItemId: delta.currentItemId ?? null,
          items: (delta.items ?? []).map((item) => ({
            ...item,
            song: sanitizeProtocolSong(item.song),
          })),
        });
        if (next) ctx.queue.value = next;
        return;
      }
    }
  }

  function applyIncomingSnapshotChunk(chunk: ListenTogetherQueueSnapshotChunk): void {
    const normalized: ListenTogetherQueueSnapshotChunk = {
      snapshotId: chunk.snapshotId ?? "",
      queueVersion: chunk.queueVersion ?? 0,
      total: chunk.total ?? 0,
      chunkIndex: chunk.chunkIndex ?? 0,
      chunkCount: chunk.chunkCount ?? 0,
      currentItemId: chunk.currentItemId ?? null,
      items: (chunk.items ?? []).map((item) => ({
        ...item,
        song: sanitizeProtocolSong(item.song),
      })),
    };
    if (!normalized.snapshotId || normalized.chunkCount <= 0) return;
    if (snapshotAssembly?.snapshotId !== normalized.snapshotId) {
      ctx.queue.value = { ...ctx.queue.value, syncing: true, snapshotId: normalized.snapshotId };
    }
    const result = applySnapshotChunk(snapshotAssembly, normalized);
    snapshotAssembly = result.assembly;
    if (result.completed) {
      ctx.queue.value = result.completed;
      // 快照落地后让指针尽力对齐当前房间歌曲。
      // 注意这里不能因“无法精确定位”再触发快照请求，否则重复歌曲场景会形成请求死循环；
      // 精确对齐统一由下一次 CHANGE_SONG 的 queueItemId 完成。
      if (!result.completed.currentItemId) {
        const resolution = resolveQueuePointer(
          result.completed,
          ctx.room.value?.song ?? null,
          null,
        );
        if (resolution.queueItemId) {
          ctx.queue.value = { ...ctx.queue.value, currentItemId: resolution.queueItemId };
        }
      }
    }
  }

  function requestQueueSnapshot(): void {
    const currentRoom = ctx.room.value;
    if (!currentRoom || ctx.isHost.value) return;
    ctx.queue.value = { ...ctx.queue.value, syncing: true };
    void ctx
      .emitCommand({
        type: "queue",
        roomId: currentRoom.roomId,
        kind: LISTEN_TOGETHER_QUEUE_KIND.snapshotRequest,
        targetUserId: currentRoom.hostUserId,
      })
      .then((ack) => {
        if (!ack.success) ctx.handleAckFailure(ack.errorMsg, ack.msg || "请求房间队列失败");
      });
  }

  async function sendQueueSnapshot(targetUserId: string): Promise<void> {
    const currentRoom = ctx.room.value;
    if (!currentRoom || !ctx.isHost.value) return;
    ensureHostQueueInitialized();
    const chunks = buildSnapshotChunks(ctx.queue.value, crypto.randomUUID());
    for (let i = 0; i < chunks.length; i += 1) {
      await ctx.emitCommand({
        type: "queue",
        roomId: currentRoom.roomId,
        kind: LISTEN_TOGETHER_QUEUE_KIND.snapshotChunk,
        targetUserId,
        data: { ...chunks[i] },
      });
      if (i < chunks.length - 1) await sleep(LISTEN_TOGETHER_QUEUE_SNAPSHOT_CHUNK_DELAY_MS);
    }
  }

  function emitQueueDelta(): void {
    const currentRoom = ctx.room.value;
    if (!currentRoom || !ctx.isHost.value) return;
    void ctx.emitCommand({
      type: "queue",
      roomId: currentRoom.roomId,
      kind: LISTEN_TOGETHER_QUEUE_KIND.delta,
      data: {
        queueVersion: ctx.queue.value.queueVersion,
        currentItemId: ctx.queue.value.currentItemId,
        items: ctx.queue.value.items,
      },
    });
  }

  /** 成员把队列操作定向发给当前房主 */
  function emitQueueCommand(command: ListenTogetherQueueCommand): void {
    const currentRoom = ctx.room.value;
    if (!currentRoom) return;
    void ctx
      .emitCommand({
        type: "queue",
        roomId: currentRoom.roomId,
        kind: LISTEN_TOGETHER_QUEUE_KIND.command,
        targetUserId: currentRoom.hostUserId,
        data: {
          command: command.command,
          ...(command.queueItemId ? { queueItemId: command.queueItemId } : {}),
          ...(command.song ? { song: command.song } : {}),
          ...(command.transitionId ? { transitionId: command.transitionId } : {}),
        },
      })
      .then((ack) => {
        if (!ack.success) ctx.handleAckFailure(ack.errorMsg, ack.msg || "一起听队列操作失败");
      });
  }

  function handleQueueCommandAsHost(fromUserId: string, command: ListenTogetherQueueCommand): void {
    const currentRoom = ctx.room.value;
    if (!currentRoom) return;
    // 房主端再次确认成员操作权限，关闭时直接忽略
    if (!currentRoom.memberOperation) return;
    const transitionId = command.transitionId || crypto.randomUUID();
    switch (command.command) {
      case LISTEN_TOGETHER_QUEUE_COMMAND.addAndPlay: {
        const song = command.song ? fromListenTogetherSong(command.song) : null;
        if (!song || !canShareSong(song)) return;
        ctx.adoptTransition(transitionId);
        addSongAndPlayAsHost(song, fromUserId, transitionId);
        return;
      }
      case LISTEN_TOGETHER_QUEUE_COMMAND.playItem:
        if (!command.queueItemId) return;
        ctx.adoptTransition(transitionId);
        playQueueItemAsHost(command.queueItemId, transitionId);
        return;
      case LISTEN_TOGETHER_QUEUE_COMMAND.removeItem:
        if (!command.queueItemId) return;
        removeQueueItemAsHost(command.queueItemId);
        return;
      case LISTEN_TOGETHER_QUEUE_COMMAND.next:
        ctx.adoptTransition(transitionId);
        playOffsetQueueItemAsHost(1, transitionId);
        return;
      case LISTEN_TOGETHER_QUEUE_COMMAND.previous:
        ctx.adoptTransition(transitionId);
        playOffsetQueueItemAsHost(-1, transitionId);
        return;
    }
  }

  // ------------------------------------------------------------------
  // 房主队列操作
  // ------------------------------------------------------------------
  function addSongAndPlayAsHost(song: Song, addedByUserId: string, transitionId: string): void {
    if (!canShareSong(song)) {
      ctx.toast("本地歌曲暂不支持一起听");
      return;
    }
    ensureHostQueueInitialized();
    const item = makeQueueItem(song, addedByUserId);
    ctx.queue.value = appendQueueItem(ctx.queue.value, item);
    void playQueueSongAsHost(item, transitionId, true);
  }

  function playQueueItemAsHost(queueItemId: string, transitionId: string): void {
    ensureHostQueueInitialized();
    const item = ctx.queue.value.items.find((entry) => entry.queueItemId === queueItemId);
    if (!item) return;
    // 纯指针移动不 bump queueVersion、不发 DELTA：接收端靠 CHANGE_SONG 的 queueItemId 对齐
    ctx.queue.value = {
      ...ctx.queue.value,
      currentItemId: item.queueItemId,
      syncing: false,
      snapshotId: null,
    };
    void playQueueSongAsHost(item, transitionId, false);
  }

  function playOffsetQueueItemAsHost(offset: number, transitionId: string): boolean {
    ensureHostQueueInitialized();
    const items = ctx.queue.value.items;
    if (items.length === 0) return false;
    let currentIndex = currentQueueIndex(ctx.queue.value);
    if (currentIndex < 0) {
      const currentSong = ctx.audio.currentSong();
      currentIndex = currentSong
        ? Math.max(
            0,
            items.findIndex((item) => songKeyOf(item.song) === songKeyOf(currentSong)),
          )
        : 0;
    }
    const target = items[wrapAroundIndex(items.length, currentIndex, offset)];
    if (!target) return false;
    playQueueItemAsHost(target.queueItemId, transitionId);
    return true;
  }

  function removeQueueItemAsHost(queueItemId: string): void {
    ensureHostQueueInitialized();
    const result = removeQueueItem(ctx.queue.value, queueItemId);
    if (!result) return;
    ctx.queue.value = result.queue;
    emitQueueDelta();
    if (!result.removedCurrent) return;
    const nextItem = result.queue.items.find(
      (item) => item.queueItemId === result.queue.currentItemId,
    );
    if (nextItem) {
      const transitionId = ctx.beginTransition() ?? crypto.randomUUID();
      ctx.adoptTransition(transitionId);
      void playQueueSongAsHost(nextItem, transitionId, false);
      return;
    }
    // 删空队列：暂停并向房间广播 PAUSE
    ctx.audio.pausePlayer();
    const song = ctx.audio.currentSong();
    const currentRoom = ctx.room.value;
    if (song && canShareSong(song) && currentRoom) {
      void ctx
        .emitCommand<ListenTogetherRoomAckData>({
          type: "pause",
          roomId: currentRoom.roomId,
          songRef: songRefOf(song),
          position: playerSecondsToProtocolMs(ctx.audio.currentTimeSeconds()),
        })
        .then(ctx.handleRoomAck);
    }
  }

  /** 房主播放队列项：本地先行（最新请求门），成功后再广播 DELTA 与 CHANGE_SONG */
  async function playQueueSongAsHost(
    item: ListenTogetherQueueItem,
    transitionId: string,
    emitDelta: boolean,
  ): Promise<void> {
    ctx.hostPlayback.activeTransitionId = transitionId;
    try {
      const song = fromListenTogetherSong(item.song);
      const loaded = await ctx.loadSongGated(song, { autoPlay: true, seekMs: 0 });
      if (!loaded || ctx.hostPlayback.activeTransitionId !== transitionId) return;
      if (emitDelta) emitQueueDelta();
      await emitChangeSongAsHost(
        sanitizeProtocolSong(item.song),
        true,
        transitionId,
        item.queueItemId,
      );
    } catch (error) {
      void reportError(error, {
        scope: "listenTogether",
        action: "playQueueSongAsHost",
        songId: item.song.id,
        source: item.song.source,
        roomId: ctx.room.value?.roomId,
      });
      ctx.toastError("切歌失败");
    } finally {
      if (ctx.hostPlayback.activeTransitionId === transitionId) {
        ctx.hostPlayback.activeTransitionId = null;
      }
    }
  }

  async function emitChangeSongAsHost(
    song: ListenTogetherSong,
    autoPlay: boolean,
    transitionId: string,
    queueItemId: string | null,
  ): Promise<void> {
    const currentRoom = ctx.room.value;
    if (!currentRoom) return;
    const ack = await ctx.emitCommand<ListenTogetherRoomAckData>({
      type: "changeSong",
      roomId: currentRoom.roomId,
      song,
      autoPlay,
      transitionId,
      queueItemId,
    });
    ctx.handleRoomAck(ack);
    if (ack.success && ack.data?.applied !== false) {
      // ACK 的 transitionId 优先于本地传入值
      ctx.endTransition(ack.data?.transitionId ?? transitionId, "CHANGE_SONG");
    }
  }

  /** 队列指针跟随权威 room.song；无法精确定位时由成员重新请求快照 */
  function alignQueuePointerToRoomSong(
    song: ListenTogetherSong | null,
    queueItemId: string | null,
  ): void {
    const resolution = resolveQueuePointer(ctx.queue.value, song, queueItemId);
    if (resolution.queueItemId && ctx.queue.value.currentItemId !== resolution.queueItemId) {
      ctx.queue.value = { ...ctx.queue.value, currentItemId: resolution.queueItemId };
    }
    if (resolution.requestSnapshot && !ctx.isHost.value) {
      requestQueueSnapshot();
    }
  }

  return {
    resetProtocol,
    ensureHostQueueInitialized,
    handleQueueEvent,
    requestQueueSnapshot,
    sendQueueSnapshot,
    emitQueueCommand,
    addSongAndPlayAsHost,
    playQueueItemAsHost,
    playOffsetQueueItemAsHost,
    removeQueueItemAsHost,
    emitChangeSongAsHost,
    alignQueuePointerToRoomSong,
  };
}

export type ListenTogetherQueueEngine = ReturnType<typeof createListenTogetherQueueEngine>;
