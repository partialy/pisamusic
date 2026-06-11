import { describe, expect, it } from "vitest";
import type {
  ListenTogetherQueueItem,
  ListenTogetherQueueSnapshotChunk,
  ListenTogetherQueueState,
} from "../../types/listenTogether";
import {
  appendQueueItem,
  applyQueueDelta,
  applySnapshotChunk,
  buildSnapshotChunks,
  currentQueueIndex,
  emptyQueueState,
  removeQueueItem,
  resolveQueuePointer,
  uniqueQueueItemIdForSong,
  wrapAroundIndex,
} from "../listenTogetherQueue";

function makeItem(queueItemId: string, songId: string, source = "kg"): ListenTogetherQueueItem {
  return {
    queueItemId,
    song: {
      id: songId,
      source: source as ListenTogetherQueueItem["song"]["source"],
      urlParam: songId,
      name: `歌曲${songId}`,
      singer: "歌手",
      album: "",
      cover: "",
      url: "",
      duration: 200_000,
    },
    addedByUserId: "u-1",
    addedAt: 0,
  };
}

function makeQueue(
  items: ListenTogetherQueueItem[],
  currentItemId: string | null = null,
  queueVersion = 1,
): ListenTogetherQueueState {
  return { queueVersion, currentItemId, items, syncing: false, snapshotId: null };
}

describe("resolveQueuePointer", () => {
  const duplicated = [makeItem("q-1", "s-1"), makeItem("q-2", "s-1"), makeItem("q-3", "s-2")];

  it("queueItemId 能从重复歌曲中选中正确项", () => {
    const result = resolveQueuePointer(makeQueue(duplicated), duplicated[1].song, "q-2");
    expect(result).toEqual({ queueItemId: "q-2", requestSnapshot: false });
  });

  it("未知 queueItemId 时要求重新请求快照", () => {
    const result = resolveQueuePointer(makeQueue(duplicated), duplicated[0].song, "q-404");
    expect(result).toEqual({ queueItemId: null, requestSnapshot: true });
  });

  it("缺少 queueItemId 且歌曲重复时要求重新请求快照，不猜第一项", () => {
    const result = resolveQueuePointer(makeQueue(duplicated), duplicated[0].song, null);
    expect(result).toEqual({ queueItemId: null, requestSnapshot: true });
  });

  it("缺少 queueItemId 但歌曲唯一时直接定位", () => {
    const result = resolveQueuePointer(makeQueue(duplicated), duplicated[2].song, undefined);
    expect(result).toEqual({ queueItemId: "q-3", requestSnapshot: false });
  });

  it("缺少 queueItemId 且本地无此歌时要求快照", () => {
    const result = resolveQueuePointer(
      makeQueue(duplicated),
      { source: "wy", id: "missing" },
      null,
    );
    expect(result).toEqual({ queueItemId: null, requestSnapshot: true });
  });

  it("歌曲为空时不定位也不请求快照", () => {
    const result = resolveQueuePointer(makeQueue(duplicated), null, null);
    expect(result).toEqual({ queueItemId: null, requestSnapshot: false });
  });

  it("来源大小写不敏感", () => {
    const result = resolveQueuePointer(
      makeQueue(duplicated),
      { source: "KG" as never, id: "s-2" },
      null,
    );
    expect(result).toEqual({ queueItemId: "q-3", requestSnapshot: false });
  });
});

describe("uniqueQueueItemIdForSong", () => {
  const items = [makeItem("q-1", "s-1"), makeItem("q-2", "s-1"), makeItem("q-3", "s-2")];

  it("唯一匹配返回对应 id，重复返回 null", () => {
    expect(uniqueQueueItemIdForSong(makeQueue(items), { source: "kg", id: "s-2" })).toBe("q-3");
    expect(uniqueQueueItemIdForSong(makeQueue(items), { source: "kg", id: "s-1" })).toBeNull();
    expect(uniqueQueueItemIdForSong(makeQueue(items), { source: "kg", id: "s-404" })).toBeNull();
  });
});

describe("applySnapshotChunk", () => {
  function makeChunk(
    overrides: Partial<ListenTogetherQueueSnapshotChunk>,
  ): ListenTogetherQueueSnapshotChunk {
    return {
      snapshotId: "snap-1",
      queueVersion: 7,
      total: 3,
      chunkIndex: 0,
      chunkCount: 2,
      currentItemId: "q-2",
      items: [],
      ...overrides,
    };
  }

  it("分片乱序到齐后按 chunkIndex 顺序拼接", () => {
    const first = applySnapshotChunk(null, makeChunk({ chunkIndex: 1, items: [makeItem("q-3", "s-3")] }));
    expect(first.completed).toBeNull();
    const second = applySnapshotChunk(
      first.assembly,
      makeChunk({ chunkIndex: 0, items: [makeItem("q-1", "s-1"), makeItem("q-2", "s-2")] }),
    );
    expect(second.assembly).toBeNull();
    expect(second.completed).not.toBeNull();
    expect(second.completed?.items.map((item) => item.queueItemId)).toEqual(["q-1", "q-2", "q-3"]);
    expect(second.completed?.queueVersion).toBe(7);
    expect(second.completed?.currentItemId).toBe("q-2");
    expect(second.completed?.syncing).toBe(false);
  });

  it("snapshotId 变化时丢弃旧组装", () => {
    const first = applySnapshotChunk(null, makeChunk({ chunkIndex: 0 }));
    const next = applySnapshotChunk(
      first.assembly,
      makeChunk({ snapshotId: "snap-2", chunkIndex: 0, chunkCount: 2 }),
    );
    expect(next.completed).toBeNull();
    expect(next.assembly?.snapshotId).toBe("snap-2");
    expect(Object.keys(next.assembly?.chunks ?? {})).toHaveLength(1);
  });

  it("非法分片（无 snapshotId 或 chunkCount<=0）被忽略", () => {
    expect(applySnapshotChunk(null, makeChunk({ snapshotId: "" })).completed).toBeNull();
    expect(applySnapshotChunk(null, makeChunk({ chunkCount: 0 })).completed).toBeNull();
  });

  it("单片快照立即完成（空队列）", () => {
    const result = applySnapshotChunk(
      null,
      makeChunk({ chunkCount: 1, total: 0, items: [], currentItemId: null }),
    );
    expect(result.completed?.items).toEqual([]);
    expect(result.completed?.currentItemId).toBeNull();
  });
});

describe("buildSnapshotChunks", () => {
  it("超过分片大小拆为多片并保留元信息", () => {
    const items = Array.from({ length: 5 }, (_, i) => makeItem(`q-${i}`, `s-${i}`));
    const chunks = buildSnapshotChunks(makeQueue(items, "q-2", 9), "snap-x", 2);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.items.length)).toEqual([2, 2, 1]);
    expect(chunks[0]).toMatchObject({
      snapshotId: "snap-x",
      queueVersion: 9,
      total: 5,
      chunkIndex: 0,
      chunkCount: 3,
      currentItemId: "q-2",
    });
  });

  it("空队列也产出一片空 items", () => {
    const chunks = buildSnapshotChunks(makeQueue([], null, 1), "snap-y");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].items).toEqual([]);
    expect(chunks[0].chunkCount).toBe(1);
  });
});

describe("applyQueueDelta", () => {
  it("旧 queueVersion 的 delta 被忽略", () => {
    const queue = makeQueue([makeItem("q-1", "s-1")], "q-1", 5);
    expect(applyQueueDelta(queue, { queueVersion: 4, currentItemId: null, items: [] })).toBeNull();
  });

  it("currentItemId 仍存在时保留，不存在时置空", () => {
    const queue = makeQueue([makeItem("q-1", "s-1")], "q-1", 5);
    const kept = applyQueueDelta(queue, {
      queueVersion: 6,
      currentItemId: null,
      items: [makeItem("q-1", "s-1"), makeItem("q-2", "s-2")],
    });
    expect(kept?.currentItemId).toBe("q-1");
    const dropped = applyQueueDelta(queue, {
      queueVersion: 6,
      currentItemId: null,
      items: [makeItem("q-2", "s-2")],
    });
    expect(dropped?.currentItemId).toBeNull();
  });
});

describe("wrapAroundIndex", () => {
  it("下一首在末尾时回到开头", () => {
    expect(wrapAroundIndex(3, 2, 1)).toBe(0);
    expect(wrapAroundIndex(3, 0, 1)).toBe(1);
  });

  it("上一首在开头时跳到末尾", () => {
    expect(wrapAroundIndex(3, 0, -1)).toBe(2);
    expect(wrapAroundIndex(3, 2, -1)).toBe(1);
  });

  it("offset 为 0 保持原位，空队列返回 -1", () => {
    expect(wrapAroundIndex(3, 1, 0)).toBe(1);
    expect(wrapAroundIndex(0, 0, 1)).toBe(-1);
  });
});

describe("removeQueueItem", () => {
  const items = [makeItem("q-1", "s-1"), makeItem("q-2", "s-2"), makeItem("q-3", "s-3")];

  it("删除非当前项保持指针并 bump queueVersion", () => {
    const result = removeQueueItem(makeQueue(items, "q-1", 3), "q-2");
    expect(result?.removedCurrent).toBe(false);
    expect(result?.queue.currentItemId).toBe("q-1");
    expect(result?.queue.queueVersion).toBe(4);
    expect(result?.queue.items.map((item) => item.queueItemId)).toEqual(["q-1", "q-3"]);
  });

  it("删除当前项时指针落到原位置的下一项", () => {
    const result = removeQueueItem(makeQueue(items, "q-2", 3), "q-2");
    expect(result?.removedCurrent).toBe(true);
    expect(result?.queue.currentItemId).toBe("q-3");
  });

  it("删除末尾当前项时指针落到新末项", () => {
    const result = removeQueueItem(makeQueue(items, "q-3", 3), "q-3");
    expect(result?.queue.currentItemId).toBe("q-2");
  });

  it("删空队列后指针为空", () => {
    const result = removeQueueItem(makeQueue([makeItem("q-1", "s-1")], "q-1", 3), "q-1");
    expect(result?.queue.items).toEqual([]);
    expect(result?.queue.currentItemId).toBeNull();
  });

  it("目标不存在时返回 null", () => {
    expect(removeQueueItem(makeQueue(items, "q-1", 3), "q-404")).toBeNull();
  });
});

describe("appendQueueItem / currentQueueIndex / emptyQueueState", () => {
  it("追加歌曲后指针指向新项且版本 +1", () => {
    const queue = appendQueueItem(makeQueue([makeItem("q-1", "s-1")], "q-1", 2), makeItem("q-2", "s-1"));
    expect(queue.queueVersion).toBe(3);
    expect(queue.currentItemId).toBe("q-2");
    expect(queue.items).toHaveLength(2);
  });

  it("currentQueueIndex 找不到指针返回 -1", () => {
    expect(currentQueueIndex(makeQueue([makeItem("q-1", "s-1")], null))).toBe(-1);
    expect(currentQueueIndex(makeQueue([makeItem("q-1", "s-1")], "q-1"))).toBe(0);
  });

  it("emptyQueueState 初始版本为 0", () => {
    expect(emptyQueueState()).toEqual({
      queueVersion: 0,
      currentItemId: null,
      items: [],
      syncing: false,
      snapshotId: null,
    });
  });
});
