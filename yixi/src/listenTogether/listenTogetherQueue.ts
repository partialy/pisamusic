// 一起听房间队列纯规则：快照组装、增量应用、指针解析、环绕切换与删除。
// 语义逐条对齐 PM ListenTogetherManager / ListenTogetherSyncRules，保证跨端一致。

import type {
  ListenTogetherQueueDelta,
  ListenTogetherQueueItem,
  ListenTogetherQueueSnapshotChunk,
  ListenTogetherQueueState,
  ListenTogetherSong,
  ListenTogetherSongRef,
} from "../types/listenTogether";
import { LISTEN_TOGETHER_QUEUE_SNAPSHOT_CHUNK_SIZE } from "../types/listenTogether";

export function emptyQueueState(): ListenTogetherQueueState {
  return {
    queueVersion: 0,
    currentItemId: null,
    items: [],
    syncing: false,
    snapshotId: null,
  };
}

export type QueuePointerResolution = {
  queueItemId: string | null;
  /** 无法精确定位（未知 queueItemId / 重复歌曲无指针 / 本地无此歌）时要求重新请求快照 */
  requestSnapshot: boolean;
};

/**
 * 解析队列当前指针：
 * - 显式 queueItemId 命中即用；未命中说明本地队列过期，要求快照。
 * - 没有 queueItemId 时按歌曲匹配：恰好 1 项可用；0 项或重复多项一律要求快照，禁止猜测第一项。
 */
export function resolveQueuePointer(
  queue: Pick<ListenTogetherQueueState, "items">,
  song: Pick<ListenTogetherSong, "source" | "id"> | null,
  queueItemId: string | null | undefined,
): QueuePointerResolution {
  if (queueItemId) {
    const exact = queue.items.find((item) => item.queueItemId === queueItemId);
    if (exact) return { queueItemId: exact.queueItemId, requestSnapshot: false };
    return { queueItemId: null, requestSnapshot: true };
  }
  if (!song) return { queueItemId: null, requestSnapshot: false };
  const matches = queue.items.filter(
    (item) =>
      item.song.source.toLowerCase() === song.source.toLowerCase() && item.song.id === song.id,
  );
  if (matches.length === 1) {
    return { queueItemId: matches[0].queueItemId, requestSnapshot: false };
  }
  return { queueItemId: null, requestSnapshot: true };
}

/** 歌曲在队列中恰好出现一次时返回该项 id，否则返回 null（重复歌曲必须依赖显式 queueItemId） */
export function uniqueQueueItemIdForSong(
  queue: Pick<ListenTogetherQueueState, "items">,
  ref: ListenTogetherSongRef,
): string | null {
  const matches = queue.items.filter(
    (item) =>
      item.song.source.toLowerCase() === ref.source.toLowerCase() && item.song.id === ref.id,
  );
  return matches.length === 1 ? matches[0].queueItemId : null;
}

// ---------------------------------------------------------------------------
// 快照组装（成员端）
// ---------------------------------------------------------------------------

export type SnapshotAssembly = {
  snapshotId: string;
  chunkCount: number;
  chunks: Record<number, ListenTogetherQueueItem[]>;
};

export type SnapshotChunkResult = {
  assembly: SnapshotAssembly | null;
  /** 全部分片到齐后产出的完整队列状态；未完成时为 null */
  completed: ListenTogetherQueueState | null;
};

/**
 * 应用一个快照分片。snapshotId 变化时丢弃旧组装重新开始；
 * 分片可乱序到达，凑齐 chunkCount 片后按 chunkIndex 顺序拼接。
 */
export function applySnapshotChunk(
  assembly: SnapshotAssembly | null,
  chunk: ListenTogetherQueueSnapshotChunk,
): SnapshotChunkResult {
  if (!chunk.snapshotId || chunk.chunkCount <= 0) {
    return { assembly, completed: null };
  }
  const current: SnapshotAssembly =
    assembly && assembly.snapshotId === chunk.snapshotId
      ? { ...assembly, chunks: { ...assembly.chunks } }
      : { snapshotId: chunk.snapshotId, chunkCount: chunk.chunkCount, chunks: {} };
  current.chunks[chunk.chunkIndex] = chunk.items ?? [];
  if (Object.keys(current.chunks).length < current.chunkCount) {
    return { assembly: current, completed: null };
  }
  const items: ListenTogetherQueueItem[] = [];
  for (let i = 0; i < current.chunkCount; i += 1) {
    items.push(...(current.chunks[i] ?? []));
  }
  return {
    assembly: null,
    completed: {
      queueVersion: chunk.queueVersion,
      currentItemId: chunk.currentItemId ?? null,
      items,
      syncing: false,
      snapshotId: null,
    },
  };
}

/** 房主端把当前队列拆成快照分片（至少一片，空队列也发一片空 items） */
export function buildSnapshotChunks(
  queue: Pick<ListenTogetherQueueState, "queueVersion" | "currentItemId" | "items">,
  snapshotId: string,
  chunkSize: number = LISTEN_TOGETHER_QUEUE_SNAPSHOT_CHUNK_SIZE,
): ListenTogetherQueueSnapshotChunk[] {
  const groups: ListenTogetherQueueItem[][] = [];
  for (let i = 0; i < queue.items.length; i += chunkSize) {
    groups.push(queue.items.slice(i, i + chunkSize));
  }
  if (groups.length === 0) groups.push([]);
  return groups.map((items, index) => ({
    snapshotId,
    queueVersion: queue.queueVersion,
    total: queue.items.length,
    chunkIndex: index,
    chunkCount: groups.length,
    currentItemId: queue.currentItemId,
    items,
  }));
}

// ---------------------------------------------------------------------------
// 增量与结构变更
// ---------------------------------------------------------------------------

/**
 * 应用 QUEUE_DELTA：版本落后于本地时返回 null（忽略）；
 * currentItemId 仅在仍存在于新 items 中时保留，否则置空等 CHANGE_SONG 对齐。
 */
export function applyQueueDelta(
  queue: Pick<ListenTogetherQueueState, "queueVersion" | "currentItemId">,
  delta: ListenTogetherQueueDelta,
): ListenTogetherQueueState | null {
  if (delta.queueVersion < queue.queueVersion) return null;
  const items = delta.items ?? [];
  const retainedCurrentItemId =
    queue.currentItemId && items.some((item) => item.queueItemId === queue.currentItemId)
      ? queue.currentItemId
      : null;
  return {
    queueVersion: delta.queueVersion,
    currentItemId: retainedCurrentItemId,
    items,
    syncing: false,
    snapshotId: null,
  };
}

/** 环绕式上一首/下一首目标索引，与 PM playOffsetQueueItemAsHost 一致 */
export function wrapAroundIndex(length: number, currentIndex: number, offset: number): number {
  const lastIndex = length - 1;
  if (length <= 0) return -1;
  if (offset > 0) return currentIndex >= lastIndex ? 0 : currentIndex + 1;
  if (offset < 0) return currentIndex <= 0 ? lastIndex : currentIndex - 1;
  return currentIndex;
}

export type QueueRemovalResult = {
  queue: ListenTogetherQueueState;
  /** 被删的是当前项时为 true，调用方需要继续播放 nextCurrentItemId 或暂停 */
  removedCurrent: boolean;
};

/**
 * 删除队列项（房主结构性变更，queueVersion +1）。
 * 删除当前项时指针落到原位置的下一项（越界取末项），队列删空则指针置空。
 * 目标项不存在时返回 null（无变更）。
 */
export function removeQueueItem(
  queue: ListenTogetherQueueState,
  queueItemId: string,
): QueueRemovalResult | null {
  const removeIndex = queue.items.findIndex((item) => item.queueItemId === queueItemId);
  if (removeIndex < 0) return null;
  const wasCurrent = queue.currentItemId === queueItemId;
  const nextItems = queue.items.filter((item) => item.queueItemId !== queueItemId);
  const nextCurrent = !wasCurrent
    ? queue.currentItemId
    : nextItems.length === 0
      ? null
      : nextItems[Math.min(removeIndex, nextItems.length - 1)].queueItemId;
  return {
    queue: {
      queueVersion: queue.queueVersion + 1,
      currentItemId: nextCurrent,
      items: nextItems,
      syncing: false,
      snapshotId: null,
    },
    removedCurrent: wasCurrent,
  };
}

/** 追加歌曲并把指针指向新项（ADD_AND_PLAY 的结构性部分，queueVersion +1） */
export function appendQueueItem(
  queue: ListenTogetherQueueState,
  item: ListenTogetherQueueItem,
): ListenTogetherQueueState {
  return {
    queueVersion: queue.queueVersion + 1,
    currentItemId: item.queueItemId,
    items: [...queue.items, item],
    syncing: false,
    snapshotId: null,
  };
}

/** 队列当前指针索引；找不到返回 -1 */
export function currentQueueIndex(
  queue: Pick<ListenTogetherQueueState, "items" | "currentItemId">,
): number {
  if (!queue.currentItemId) return -1;
  return queue.items.findIndex((item) => item.queueItemId === queue.currentItemId);
}
