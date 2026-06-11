import assert from "node:assert/strict";
import test from "node:test";
import { createRoom, deleteRoom, getRoom } from "../db/listenTogetherStore";
import type {
  ListenTogetherRoom,
  ListenTogetherSocketUser,
} from "../realtime/listenTogether/listenTogetherTypes";
import {
  changeListenTogetherSong,
  playListenTogether,
  seekListenTogether,
} from "./listenTogetherService";

const user: ListenTogetherSocketUser = {
  userId: "host-user",
  username: "host",
  nickname: "Host",
  avatarUrl: "",
};

function makeSong(id: string) {
  return {
    id,
    source: "kg" as const,
    urlParam: id,
    name: id,
    singer: "artist",
    album: "",
    cover: "",
    url: "",
    duration: 180_000,
  };
}

function createTestRoom(roomId: string): ListenTogetherRoom {
  const room: ListenTogetherRoom = {
    roomId,
    roomName: "test",
    hostUserId: user.userId,
    song: makeSong("B"),
    status: "playing",
    position: 4_000,
    maxPeople: 2,
    memberOperation: false,
    createdAt: 1,
    updatedAt: 1,
    version: 7,
    members: [
      {
        ...user,
        role: "host",
        online: true,
        joinedAt: 1,
        lastSeenAt: 1,
      },
    ],
  };
  return createRoom(room);
}

test("stale PLAY heartbeat cannot overwrite the current song position", () => {
  const roomId = "910001";
  createTestRoom(roomId);
  try {
    const result = playListenTogether(user, {
      roomId,
      data: {
        song: makeSong("A"),
        songRef: { source: "kg", id: "A" },
        position: 80_000,
        transitionId: "old-A",
      },
    });

    assert.equal(result.applied, false);
    assert.equal(result.broadcast, undefined);
    assert.equal(result.transitionId, "old-A");
    assert.equal(getRoom(roomId)?.song?.id, "B");
    assert.equal(getRoom(roomId)?.position, 4_000);
    assert.equal(getRoom(roomId)?.version, 7);
  } finally {
    deleteRoom(roomId);
  }
});

test("matching progress event updates state and broadcasts once", () => {
  const roomId = "910002";
  createTestRoom(roomId);
  try {
    const result = seekListenTogether(user, {
      roomId,
      data: {
        songRef: { source: "kg", id: "B" },
        position: 12_000,
      },
    });

    assert.equal(result.applied, true);
    assert.equal(result.broadcast?.event, "ROOM_STATE_CHANGED");
    assert.equal(getRoom(roomId)?.position, 12_000);
    assert.equal(getRoom(roomId)?.version, 8);
  } finally {
    deleteRoom(roomId);
  }
});

test("CHANGE_SONG echoes transition and queue item identity", () => {
  const roomId = "910003";
  createTestRoom(roomId);
  try {
    const result = changeListenTogetherSong(user, {
      roomId,
      data: {
        song: makeSong("C"),
        autoPlay: true,
        transitionId: "transition-C",
        queueItemId: "queue-C-2",
      },
    });
    const data = result.broadcast?.data as {
      transitionId?: string;
      queueItemId?: string;
    };

    assert.equal(result.applied, true);
    assert.equal(result.transitionId, "transition-C");
    assert.equal(data.transitionId, "transition-C");
    assert.equal(data.queueItemId, "queue-C-2");
    assert.equal(getRoom(roomId)?.song?.id, "C");
  } finally {
    deleteRoom(roomId);
  }
});
