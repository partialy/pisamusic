import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { before, beforeEach, describe } from "node:test";
import type { DatabaseSync } from "node:sqlite";

const testDbPath = path.resolve(process.cwd(), "data/listen-together-history-test.db");

function cleanupTestDb() {
  for (const file of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
    }
  }
}

describe("listenTogetherHistoryStore", () => {
  let db: DatabaseSync;
  let historyStore: typeof import("./listenTogetherHistoryStore.js");

  before(async () => {
    cleanupTestDb();
    process.env.PISA_APP_DB_PATH = testDbPath;
    const appDb = await import("./appDb.js");
    db = appDb.getAppDb();
    historyStore = await import("./listenTogetherHistoryStore.js");
  });

  beforeEach(() => {
    db.exec("DELETE FROM listen_together_room_members;");
    db.exec("DELETE FROM listen_together_room_records;");
  });

  test("openRoomRecord creates active record and member segment", () => {
    const host = {
      userId: "u_host1",
      username: "host1",
      nickname: "Host Nick",
      avatarUrl: "http://avatar.com/1.png",
    };

    historyStore.openRoomRecord({
      id: "rec_1",
      roomId: "100001",
      roomName: "Test Room 1",
      host,
      maxPeople: 4,
      memberOperation: true,
      createdAt: 1000,
    });

    const detail = historyStore.readRoomHistoryDetail("rec_1");
    assert.ok(detail);
    assert.equal(detail.recordId, "rec_1");
    assert.equal(detail.roomId, "100001");
    assert.equal(detail.roomName, "Test Room 1");
    assert.equal(detail.lifecycleStatus, "active");
    assert.equal(detail.initialHost.userId, "u_host1");
    assert.equal(detail.finalHost.userId, "u_host1");
    assert.equal(detail.peakPeople, 1);
    assert.equal(detail.totalJoinCount, 1);
    assert.equal(detail.uniquePeople, 1);
    assert.equal(detail.members.length, 1);
    assert.equal(detail.members[0].userId, "u_host1");
    assert.equal(detail.members[0].role, "host");
    assert.equal(detail.members[0].leftAt, null);
  });

  test("member join, leave, and rejoin creates multiple segments with accurate counts", () => {
    const host = { userId: "u_host", username: "host", nickname: "Host", avatarUrl: "" };
    const member = { userId: "u_m1", username: "m1", nickname: "Member 1", avatarUrl: "" };

    historyStore.openRoomRecord({
      id: "rec_2",
      roomId: "100002",
      roomName: "Room 2",
      host,
      maxPeople: 4,
      memberOperation: false,
      createdAt: 1000,
    });

    // Member joins
    historyStore.recordMemberJoined({
      roomRecordId: "rec_2",
      user: member,
      role: "member",
      joinedAt: 1100,
    });

    let detail = historyStore.readRoomHistoryDetail("rec_2");
    assert.ok(detail);
    assert.equal(detail.peakPeople, 2);
    assert.equal(detail.totalJoinCount, 2);
    assert.equal(detail.uniquePeople, 2);
    assert.equal(detail.members.length, 2);

    // Member leaves
    historyStore.recordMemberLeft({
      roomRecordId: "rec_2",
      userId: "u_m1",
      leftAt: 1200,
      leaveReason: "left",
    });

    detail = historyStore.readRoomHistoryDetail("rec_2");
    assert.ok(detail);
    const m1Segments = detail.members.filter((m) => m.userId === "u_m1");
    assert.equal(m1Segments.length, 1);
    assert.equal(m1Segments[0].leftAt, 1200);
    assert.equal(m1Segments[0].leaveReason, "left");

    // Member rejoins
    historyStore.recordMemberJoined({
      roomRecordId: "rec_2",
      user: member,
      role: "member",
      joinedAt: 1300,
    });

    detail = historyStore.readRoomHistoryDetail("rec_2");
    assert.ok(detail);
    assert.equal(detail.peakPeople, 2); // peak is still 2
    assert.equal(detail.totalJoinCount, 3); // 1 + 1 + 1
    assert.equal(detail.uniquePeople, 2); // host + member
    assert.equal(detail.members.filter((m) => m.userId === "u_m1").length, 2);
  });

  test("song snapshot sanitize strips sensitive url, urlParam, and filePath", () => {
    const host = { userId: "u_host", username: "host", nickname: "Host", avatarUrl: "" };
    historyStore.openRoomRecord({
      id: "rec_3",
      roomId: "100003",
      roomName: "Room 3",
      host,
      maxPeople: 2,
      memberOperation: false,
      createdAt: 1000,
    });

    historyStore.updateRoomRecordSnapshot({
      roomRecordId: "rec_3",
      song: {
        id: "song_123",
        source: "wy",
        name: "Test Song",
        singer: "Test Singer",
        album: "Test Album",
        cover: "http://cover.jpg",
        duration: 240,
        url: "https://secret-audio-url.com/stream.mp3?token=secret123",
        urlParam: "token=secret",
        filePath: "/var/local/music/123.mp3",
      },
      playbackStatus: "playing",
      position: 45.5,
      updatedAt: 1050,
    });

    const row = db
      .prepare("SELECT last_song_snapshot_json FROM listen_together_room_records WHERE id = ?")
      .get("rec_3") as { last_song_snapshot_json: string };
    const saved = JSON.parse(row.last_song_snapshot_json);
    assert.equal(saved.id, "song_123");
    assert.equal(saved.name, "Test Song");
    assert.equal(saved.singer, "Test Singer");
    assert.equal(saved.url, undefined);
    assert.equal(saved.urlParam, undefined);
    assert.equal(saved.filePath, undefined);
  });

  test("closeRoomRecord allows reusing roomId for a subsequent room", () => {
    const host = { userId: "u_host", username: "host", nickname: "Host", avatarUrl: "" };

    historyStore.openRoomRecord({
      id: "rec_4a",
      roomId: "100004",
      roomName: "Room 4 First Run",
      host,
      maxPeople: 2,
      memberOperation: false,
      createdAt: 1000,
    });

    historyStore.closeRoomRecord({
      roomRecordId: "rec_4a",
      endedAt: 2000,
      endReason: "empty",
      finalHost: host,
      finalPlaybackStatus: "paused",
      finalPosition: 10,
    });

    // Opening a new room with identical roomId must succeed
    historyStore.openRoomRecord({
      id: "rec_4b",
      roomId: "100004",
      roomName: "Room 4 Second Run",
      host,
      maxPeople: 4,
      memberOperation: true,
      createdAt: 3000,
    });

    const activeList = historyStore.listRoomHistory({ keyword: "100004", offset: 0, limit: 10 });
    assert.equal(activeList.total, 2);
  });

  test("closeStaleActiveRoomRecords closes leftover active rooms with server_restart", () => {
    const host = { userId: "u_host", username: "host", nickname: "Host", avatarUrl: "" };
    historyStore.openRoomRecord({
      id: "rec_stale",
      roomId: "100005",
      roomName: "Stale Room",
      host,
      maxPeople: 2,
      memberOperation: false,
      createdAt: 1000,
    });

    const closedCount = historyStore.closeStaleActiveRoomRecords(5000);
    assert.equal(closedCount, 1);

    const detail = historyStore.readRoomHistoryDetail("rec_stale");
    assert.ok(detail);
    assert.equal(detail.lifecycleStatus, "closed");
    assert.equal(detail.endReason, "server_restart");
    assert.equal(detail.endedAt, 5000);
    assert.equal(detail.members[0].leftAt, 5000);
    assert.equal(detail.members[0].leaveReason, "server_restart");
  });
});
