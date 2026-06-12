import { isProxy, reactive } from "vue";
import { describe, expect, it } from "vitest";
import type {
  ListenTogetherQueueItem,
  ListenTogetherSocketCommand,
} from "../../types/listenTogether";
import { toSerializableListenTogetherCommand } from "../listenTogetherIpcPayload";

function makeReactiveQueueItem(): ListenTogetherQueueItem {
  return reactive({
    queueItemId: "queue-1",
    song: {
      id: "song-1",
      source: "kg",
      urlParam: "song-1",
      name: "测试歌曲",
      singer: "测试歌手",
      album: "",
      cover: "",
      url: "",
      duration: 180_000,
    },
    addedByUserId: "user-1",
    addedAt: 1,
  });
}

describe("toSerializableListenTogetherCommand", () => {
  it("把队列快照中的 Vue Proxy 转为 contextBridge 可克隆的纯 DTO", () => {
    const item = makeReactiveQueueItem();
    const command = reactive<ListenTogetherSocketCommand>({
      type: "queue",
      roomId: "545100",
      kind: "SNAPSHOT_CHUNK",
      targetUserId: "user-2",
      data: {
        snapshotId: "snapshot-1",
        queueVersion: 1,
        total: 1,
        chunkIndex: 0,
        chunkCount: 1,
        currentItemId: item.queueItemId,
        items: [item],
      },
    });

    expect(isProxy(command)).toBe(true);
    expect(isProxy(item)).toBe(true);

    const serialized = toSerializableListenTogetherCommand(command);

    expect(isProxy(serialized)).toBe(false);
    if (serialized.type !== "queue") throw new Error("序列化后命令类型异常");
    expect(isProxy((serialized.data?.items as ListenTogetherQueueItem[])[0])).toBe(false);
    expect(() => structuredClone(serialized)).not.toThrow();
  });
});
