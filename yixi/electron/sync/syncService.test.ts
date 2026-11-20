import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppDatabase } from "../database/appDatabase";
import { advanceHlc } from "../database/syncStateStore";
import type { SyncChange, SyncPullResult } from "../system/systemClient";

const mocks = vi.hoisted(() => ({
  db: null as AppDatabase | null,
  account: { loggedIn: true, token: "account-token", user: { id: "user-1" } },
  pull: vi.fn(),
  push: vi.fn(),
}));
vi.mock("electron", () => ({
  app: { isPackaged: true, getPath: () => "" },
  BrowserWindow: { getAllWindows: () => [] },
  powerMonitor: { on: vi.fn() },
}));
vi.mock("../database", () => ({ getAppDatabase: () => mocks.db }));
vi.mock("../system/systemClient", () => ({
  getAccountSession: () => mocks.account,
  getDesktopDeviceClientId: () => "this-device",
  getSyncChanges: mocks.pull,
  pushSyncChanges: mocks.push,
}));

function change(itemKey: string, payload: unknown = {}, extra: Partial<SyncChange> = {}): SyncChange {
  return {
    version: 1,
    opId: itemKey,
    deviceId: "other-device",
    itemType: "favorite_song",
    itemKey,
    action: "upsert",
    payload,
    clientUpdatedAt: "",
    serverUpdatedAt: 0,
    ...extra,
  };
}

function snapshot(items: SyncChange[], extra: Partial<SyncPullResult> = {}): SyncPullResult {
  return {
    mode: "snapshot",
    version: 10,
    snapshotVersion: 10,
    items,
    changes: items,
    hasMore: false,
    cursor: null,
    serverTime: 1_700_000_000_000,
    ...extra,
  };
}

function song(id: string, favoritedAt = 1000) {
  return { id, source: "kg", name: id, favoritedAt };
}

function userRepo(db: AppDatabase, accountId = "user-1") {
  return db.accountLibrary({ accountId, deviceIdentity: "this-device" });
}

describe("桌面同步快照与游标", () => {
  let sync: typeof import("./syncService");
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    mocks.db = new AppDatabase(":memory:");
    mocks.account = { loggedIn: true, token: "account-token", user: { id: "user-1" } };
    mocks.db.syncState.markSeeded("user-1");
    mocks.pull.mockReset();
    mocks.push.mockReset();
    mocks.push.mockResolvedValue({ version: 999, accepted: 1, skipped: 0, serverTime: 1_700_000_000_000 });
    sync = await import("./syncService");
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    mocks.db?.close();
  });

  it("收藏时间落库并按远端时间排序，旧字段缺失保留原时间", () => {
    const repo = userRepo(mocks.db!);
    repo.addFavoriteSong(song("older", 1000), true);
    repo.addFavoriteSong(song("newer", 2000), true);
    repo.addFavoriteSong({ id: "older", source: "kg", name: "updated" }, true);
    expect(repo.listFavoriteSongs().map((item) => [item.trackId, item.payload.favoritedAt])).toEqual([
      ["newer", 2000],
      ["older", 1000],
    ]);
    sync.recordFavoriteSongChange({ id: "older", source: "kg" }, "upsert", { schedule: false });
    expect(JSON.parse(String((repo.listSyncOutbox()[0] as { payload_json: string }).payload_json)).favoritedAt).toBe(1000);
  });

  it("全分页结束才对账，同设备快照仍应用，缺失四类项被清理", async () => {
    const repo = userRepo(mocks.db!);
    repo.addFavoriteSong(song("stale"), true);
    repo.addFavoriteSong({ id: "disk", source: "local" }, true);
    repo.addFavoritePlaylist({ id: "p", source: "kg", name: "p", desc: "", cover: "", tags: [] }, { fromSync: true });
    repo.upsertUserPlaylist({ id: "gone", source: "local", name: "gone", desc: "", cover: "", tags: [] }, { fromSync: true });
    repo.upsertUserPlaylist({ id: "keep", source: "local", name: "keep", desc: "", cover: "", tags: [] }, { fromSync: true });
    repo.addUserPlaylistTrack("keep", song("stale-track"), { fromSync: true });
    mocks.pull.mockResolvedValueOnce(
      snapshot([change("kg:new", song("new", 4000), { deviceId: "this-device", version: 5 })], { hasMore: true, cursor: "1" }),
    );
    mocks.pull.mockImplementationOnce(async (_token, since, page) => {
      expect(since).toBe(0);
      expect(page).toEqual({ snapshotVersion: 10, cursor: "1" });
      expect(repo.containsFavoriteSong("kg", "stale")).toBe(true);
      expect(repo.containsFavoriteSong("kg", "new")).toBe(false);
      return snapshot([change("local:keep", { id: "keep", source: "local", name: "keep" }, { itemType: "user_playlist", version: 6 })]);
    });
    const result = await sync.syncNow();
    expect(result.lastVersion).toBe(10);
    expect(repo.listFavoriteSongs().map((item) => item.trackId).sort()).toEqual(["disk", "new"]);
    expect(repo.listFavoritePlaylists()).toHaveLength(0);
    expect(repo.listUserPlaylists("local").map((item) => item.playlistId)).toEqual(["keep"]);
    expect(repo.listUserPlaylistTracks("keep")).toHaveLength(0);
    expect(mocks.db!.syncState.readBaseVersion("user-1", "favorite_song", "kg:new")).toBe(5);
  });

  it("分页途中产生的持久pending不被覆盖，pending子项保护父删除", async () => {
    const repo = userRepo(mocks.db!);
    repo.upsertUserPlaylist({ id: "protected", source: "local", name: "local", desc: "", cover: "", tags: [] }, { fromSync: true });
    repo.addUserPlaylistTrack("protected", song("local-track"), { fromSync: true });
    mocks.pull.mockResolvedValueOnce(snapshot([], { hasMore: true, cursor: "1" }));
    mocks.pull.mockImplementationOnce(async () => {
      repo.addFavoriteSong(song("pending", 7000), true);
      for (let i = 0; i < 510; i++) repo.enqueueSyncOp({ itemType: "favorite_song", itemKey: `kg:irrelevant-${i}`, action: "delete" });
      repo.enqueueSyncOp({ itemType: "favorite_song", itemKey: "kg:pending", action: "upsert", payload: song("pending", 7000) });
      repo.enqueueSyncOp({ itemType: "playlist_track", itemKey: "protected|kg:local-track", action: "upsert", payload: song("local-track") });
      return snapshot([change("kg:pending", song("pending", 1000))]);
    });
    mocks.push.mockRejectedValue(new Error("offline"));
    await sync.syncNow();
    expect(repo.listFavoriteSongs().find((item) => item.trackId === "pending")?.payload.favoritedAt).toBe(7000);
    expect(repo.listUserPlaylists("local").map((item) => item.playlistId)).toContain("protected");
    expect(repo.listUserPlaylistTracks("protected")).toHaveLength(1);
  });

  it("409丢弃未完成快照后重拉，空快照有删除权威", async () => {
    const repo = userRepo(mocks.db!);
    repo.addFavoriteSong(song("stale"), true);
    mocks.pull.mockResolvedValueOnce(snapshot([change("kg:discard", song("discard"))], { hasMore: true, cursor: "1" }));
    mocks.pull.mockRejectedValueOnce(Object.assign(new Error("changed"), { code: 409 }));
    mocks.pull.mockResolvedValueOnce(snapshot([], { version: 12, snapshotVersion: 12 }));
    expect((await sync.syncNow()).lastVersion).toBe(12);
    expect(repo.listFavoriteSongs()).toHaveLength(0);
  });

  it("旧服务端增量拉到空页，push全局版本不推进游标，推送携带baseVersion与写操作日志", async () => {
    const db = mocks.db!;
    const repo = userRepo(db);
    db.syncState.markSyncSuccess("user-1", 2);
    db.syncState.upsertEntityVersion("user-1", "favorite_song", "kg:mine", 2, false);
    const opId = repo.enqueueSyncOp({ itemType: "favorite_song", itemKey: "kg:mine", action: "upsert", payload: song("mine") });
    mocks.pull.mockResolvedValueOnce({ version: 999, changes: [change("kg:a", song("a"), { version: 3 })] });
    mocks.pull.mockResolvedValueOnce({ version: 999, changes: [] });
    mocks.push.mockResolvedValueOnce({
      version: 999,
      accepted: 1,
      skipped: 0,
      serverTime: 1_700_000_000_500,
      appliedItems: [{ opId, itemType: "favorite_song", itemKey: "kg:mine", version: 4 }],
      rejectedItems: [],
    });
    mocks.pull.mockResolvedValueOnce({
      mode: "delta",
      version: 999,
      hasMore: false,
      changes: [change("kg:b", song("b"), { version: 5 })],
    });
    expect((await sync.syncNow()).lastVersion).toBe(5);
    expect(mocks.pull.mock.calls.map((call) => call[1])).toEqual([2, 3, 3]);
    expect(mocks.push.mock.calls[0]?.[1][0]?.baseVersion).toBe(2);
    const history = db.syncState.listOpHistory("user-1", 10);
    expect(history[0]).toMatchObject({ op_id: opId, status: "synced", server_version: 4, base_version: 2 });
    expect(db.syncState.readBaseVersion("user-1", "favorite_song", "kg:mine")).toBe(4);
  });

  it("账号切换后旧请求结果不落库、不覆盖新账号游标", async () => {
    const db = mocks.db!;
    mocks.pull.mockImplementationOnce(async () => {
      mocks.account = { loggedIn: true, token: "new-token", user: { id: "user-2" } };
      return snapshot([change("kg:foreign", song("foreign"))]);
    });
    await sync.syncNow();
    expect(userRepo(db, "user-1").listFavoriteSongs()).toHaveLength(0);
    expect(userRepo(db, "user-2").listFavoriteSongs()).toHaveLength(0);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(sync.getSyncState().userId).toBe("user-2");
    expect(sync.getSyncState().lastVersion).toBe(0);
  });

  it("首次seed超过200项连续推完，保持原历史时间并重拉增量不双拉快照", async () => {
    const db = mocks.db!;
    const repo = userRepo(db);
    db.syncState.clearEntityVersions("user-1");
    // 重置为未 seed 状态
    (db as unknown as { db: { exec: (sql: string) => void } }).db.exec("DELETE FROM sync_account_state WHERE account_id = 'user-1'");
    for (let i = 0; i < 205; i++) repo.addFavoriteSong(song(String(i), 1000 + i), true);
    mocks.pull.mockResolvedValueOnce(snapshot([]));
    mocks.pull.mockResolvedValueOnce({ mode: "delta", version: 10, changes: [], hasMore: false });
    await sync.syncNow();
    expect(mocks.push.mock.calls.map((call) => call[1].length)).toEqual([200, 5]);
    const sent = mocks.push.mock.calls.flatMap((call) => call[1]) as {
      itemKey: string;
      clientUpdatedAt: string;
      payload: { favoritedAt: number };
    }[];
    expect(sent.find((item) => item.itemKey === "kg:0")?.payload.favoritedAt).toBe(1000);
    expect(Date.parse(sent.find((item) => item.itemKey === "kg:0")!.clientUpdatedAt)).toBe(1000);
    expect(repo.listSyncOutbox()).toHaveLength(0);
    // 第二次 pull 从快照版本 10 走增量，避免双拉全量快照
    expect(mocks.pull.mock.calls.map((call) => call[1])).toEqual([0, 10]);
  });

  it("登出保留水位与seeded状态，同账号重登直接增量拉取不再重seed", async () => {
    const db = mocks.db!;
    db.syncState.markSyncSuccess("user-1", 42);
    sync.onAccountLogout();
    expect(db.syncState.readState("user-1")).toMatchObject({ seeded: true, lastVersion: 42 });
    mocks.pull.mockResolvedValueOnce({ mode: "delta", version: 42, changes: [], hasMore: false });
    const state = await sync.syncNow();
    expect(state.lastVersion).toBe(42);
    expect(mocks.pull).toHaveBeenCalledWith("account-token", 42, undefined);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("断网恢复通知触发待同步队列自动补传", async () => {
    const db = mocks.db!;
    const repo = userRepo(db);
    db.syncState.markSyncSuccess("user-1", 10);
    repo.addFavoriteSong(song("offline-song", 3000));
    mocks.pull.mockResolvedValueOnce({ mode: "delta", version: 10, changes: [], hasMore: false });
    mocks.push.mockRejectedValueOnce(new TypeError("fetch failed"));
    const failed = await sync.syncNow();
    expect(failed.lastError).toContain("fetch failed");
    expect(repo.listSyncOutbox()).toHaveLength(1);

    mocks.pull.mockResolvedValue({ mode: "delta", version: 11, changes: [], hasMore: false });
    mocks.push.mockResolvedValueOnce({ version: 11, accepted: 1, skipped: 0 });
    sync.notifyNetworkOnline();
    await vi.advanceTimersByTimeAsync(300);
    expect(repo.listSyncOutbox()).toHaveLength(0);
  });

  it("未推送删除阻止快照复活，增量本设备回声仍推进实际游标", async () => {
    const db = mocks.db!;
    const repo = userRepo(db);
    repo.enqueueSyncOp({ itemType: "favorite_song", itemKey: "kg:deleted", action: "delete" });
    mocks.pull.mockResolvedValueOnce(snapshot([change("kg:deleted", song("deleted"))]));
    mocks.push.mockRejectedValueOnce(new Error("offline"));
    await sync.syncNow();
    expect(repo.containsFavoriteSong("kg", "deleted")).toBe(false);
    repo.clearSyncOutbox();
    db.syncState.markSyncSuccess("user-1", 10);
    mocks.pull.mockResolvedValueOnce({
      mode: "delta",
      version: 20,
      hasMore: false,
      changes: [change("kg:echo", song("echo"), { version: 11, deviceId: "this-device" })],
    });
    expect((await sync.syncNow()).lastVersion).toBe(11);
    expect(repo.containsFavoriteSong("kg", "echo")).toBe(false);
  });

  it("完整快照落库失败时回滚全部变更且不推进游标", async () => {
    const repo = userRepo(mocks.db!);
    repo.addFavoriteSong(song("existing"), true);
    mocks.pull.mockResolvedValueOnce(
      snapshot([
        change("kg:first", song("first")),
        change("invalid:playlist", { id: "bad", source: "invalid" }, { itemType: "favorite_playlist" }),
      ]),
    );
    const result = await sync.syncNow();
    expect(result.lastVersion).toBe(0);
    expect(result.lastError).not.toBe("");
    expect(repo.listFavoriteSongs().map((item) => item.trackId)).toEqual(["existing"]);
  });

  it("LWW拒绝已过游标的旧pending后，用快照恢复远端winner并记录dropped_by_lww", async () => {
    const db = mocks.db!;
    const repo = userRepo(db);
    db.syncState.markSyncSuccess("user-1", 20);
    repo.addFavoriteSong({ ...song("winner", 1000), name: "stale-local" }, true);
    const opId = repo.enqueueSyncOp({ itemType: "favorite_song", itemKey: "kg:winner", action: "upsert", payload: song("winner", 1000) });
    mocks.pull.mockResolvedValueOnce({ mode: "delta", version: 20, changes: [], hasMore: false });
    mocks.push.mockResolvedValueOnce({
      version: 20,
      accepted: 0,
      skipped: 1,
      rejectedItems: [{ opId, itemType: "favorite_song", itemKey: "kg:winner", reason: "lww_lost", serverVersion: 12 }],
    });
    mocks.pull.mockResolvedValueOnce(
      snapshot([change("kg:winner", { ...song("winner", 5000), name: "remote-winner" }, { version: 12, deviceId: "this-device" })], {
        version: 20,
        snapshotVersion: 20,
      }),
    );
    const result = await sync.syncNow();
    expect(mocks.pull.mock.calls.map((call) => call[1])).toEqual([20, 0]);
    expect(repo.listFavoriteSongs().find((item) => item.trackId === "winner")?.payload).toMatchObject({
      name: "remote-winner",
      favoritedAt: 5000,
    });
    expect(result.lastVersion).toBe(20);
    expect(repo.listSyncOutbox()).toHaveLength(0);
    expect(db.syncState.listOpHistory("user-1", 10)[0]).toMatchObject({ op_id: opId, status: "dropped_by_lww" });
  });

  it("HLC时钟单调不回退并应用服务端时间偏移", () => {
    const t1 = advanceHlc(1000, 0, 1500, 5000);
    expect(t1).toEqual({ pt: 6500, lc: 0 });
    const t2 = advanceHlc(t1.pt, t1.lc, 1000, 0);
    expect(t2).toEqual({ pt: 6500, lc: 1 });
    const t3 = advanceHlc(t2.pt, t2.lc, 7000, 0);
    expect(t3).toEqual({ pt: 7000, lc: 0 });
  });
});
