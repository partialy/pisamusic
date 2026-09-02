import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { before, beforeEach, describe } from "node:test";
import type { DatabaseSync } from "node:sqlite";

const testDbPath = path.resolve(process.cwd(), "data/admin-listen-together-test.db");

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

describe("adminListenTogetherService", () => {
  let db: DatabaseSync;
  let adminService: typeof import("./adminListenTogetherService.js");
  let listenTogetherService: typeof import("./listenTogetherService.js");
  let listenStore: typeof import("../db/listenTogetherStore.js");
  let historyStore: typeof import("../db/listenTogetherHistoryStore.js");

  before(async () => {
    cleanupTestDb();
    process.env.PISA_APP_DB_PATH = testDbPath;
    const appDb = await import("../db/appDb.js");
    db = appDb.getAppDb();
    adminService = await import("./adminListenTogetherService.js");
    listenTogetherService = await import("./listenTogetherService.js");
    listenStore = await import("../db/listenTogetherStore.js");
    historyStore = await import("../db/listenTogetherHistoryStore.js");
  });

  beforeEach(() => {
    db.exec("DELETE FROM listen_together_room_members;");
    db.exec("DELETE FROM listen_together_room_records;");
    for (const room of listenStore.listRooms()) {
      listenStore.deleteRoom(room.roomId);
    }
  });

  test("listAdminOnlineRooms correctly distinguishes onlinePeople from currentPeople", () => {
    const hostUser = {
      id: "u_h1",
      username: "admin_host",
      email: "h1@test.com",
      phone: null,
      avatar: "",
      avatarKey: "",
      avatarUrl: "",
      vip: false,
      vipExpiresAt: null,
      createdAt: 1000,
      lastLoginAt: null,
    };
    const memberUser = {
      userId: "u_m2",
      username: "member_guest",
      nickname: "Guest",
      avatarUrl: "",
    };

    const room = listenTogetherService.createListenTogetherRoom(hostUser, {
      roomName: "Online Room Alpha",
      maxPeople: 4,
    });

    listenTogetherService.joinListenTogetherRoom(memberUser, room.roomId);

    // Host connects socket
    listenTogetherService.connectListenTogetherSocket("u_h1", "sock_h1");
    // Member connects socket
    listenTogetherService.connectListenTogetherSocket("u_m2", "sock_m2");

    // Member disconnects socket (enters offline grace period)
    listenTogetherService.disconnectListenTogetherSocket("u_m2", "sock_m2", () => {});

    const page = adminService.listAdminOnlineRooms({ offset: 0, limit: 10 });
    assert.equal(page.total, 1);
    assert.equal(page.items.length, 1);
    const item = page.items[0];
    assert.equal(item.roomName, "Online Room Alpha");
    assert.equal(item.currentPeople, 2); // both host and offline member
    assert.equal(item.onlinePeople, 1); // only host is online
    assert.equal(item.maxPeople, 4);
  });

  test("readAdminOnlineRoom returns immutable snapshot", () => {
    const hostUser = {
      id: "u_h2",
      username: "snapshot_host",
      email: "h2@test.com",
      phone: null,
      avatar: "",
      avatarKey: "",
      avatarUrl: "",
      vip: false,
      vipExpiresAt: null,
      createdAt: 1000,
      lastLoginAt: null,
    };

    const room = listenTogetherService.createListenTogetherRoom(hostUser, {
      roomName: "Snapshot Room",
      maxPeople: 2,
    });

    const detail = adminService.readAdminOnlineRoom(room.recordId!);
    assert.ok(detail);
    assert.equal(detail.roomName, "Snapshot Room");

    // Modifying detail object shouldn't mutate runtime room
    (detail as any).roomName = "Mutated Name";
    const freshDetail = adminService.readAdminOnlineRoom(room.recordId!);
    assert.equal(freshDetail?.roomName, "Snapshot Room");
  });

  test("dissolveAdminOnlineRoom destroys room, records history and cleans up runtime state", () => {
    const hostUser = {
      id: "u_h3",
      username: "dissolve_host",
      email: "h3@test.com",
      phone: null,
      avatar: "",
      avatarKey: "",
      avatarUrl: "",
      vip: false,
      vipExpiresAt: null,
      createdAt: 1000,
      lastLoginAt: null,
    };

    const room = listenTogetherService.createListenTogetherRoom(hostUser, {
      roomName: "To Be Dissolved",
      maxPeople: 2,
    });

    const recordId = room.recordId!;

    const dissolveResult = adminService.dissolveAdminOnlineRoom({
      recordId,
      adminUsername: "super_admin",
    });

    assert.equal(dissolveResult.recordId, recordId);
    assert.equal(dissolveResult.roomId, room.roomId);
    assert.ok(dissolveResult.endedAt > 0);

    // Online room must be gone
    const onlineDetail = adminService.readAdminOnlineRoom(recordId);
    assert.equal(onlineDetail, null);
    assert.equal(listenStore.getUserRoom("u_h3"), null);

    // History record must be closed with admin_dissolved
    const historyDetail = historyStore.readRoomHistoryDetail(recordId);
    assert.ok(historyDetail);
    assert.equal(historyDetail.lifecycleStatus, "closed");
    assert.equal(historyDetail.endReason, "admin_dissolved");
    assert.equal(historyDetail.endedByAdmin, "super_admin");

    // Repeated dissolve should throw 404 ROOM_NOT_FOUND
    assert.throws(
      () => adminService.dissolveAdminOnlineRoom({ recordId, adminUsername: "super_admin" }),
      (err: any) => err.errorMsg === "ROOM_NOT_FOUND",
    );
  });
});
