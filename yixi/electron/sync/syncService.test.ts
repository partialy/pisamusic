import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppDatabase } from "../database/appDatabase";
import type { SyncChange, SyncPullResult } from "../system/systemClient";

const mocks = vi.hoisted(() => ({
  db: null as AppDatabase | null,
  account: { loggedIn: true, token: "account-token", user: { id: "user-1" } },
  pull: vi.fn(), push: vi.fn(),
}));
vi.mock("electron", () => ({ BrowserWindow: { getAllWindows: () => [] } }));
vi.mock("../database", () => ({ getAppDatabase: () => mocks.db }));
vi.mock("../system/systemClient", () => ({
  getAccountSession: () => mocks.account,
  getDesktopDeviceClientId: () => "this-device",
  getSyncChanges: mocks.pull,
  pushSyncChanges: mocks.push,
}));

function change(itemKey: string, payload: unknown = {}, extra: Partial<SyncChange> = {}): SyncChange {
  return { version: 1, opId: itemKey, deviceId: "other-device", itemType: "favorite_song", itemKey,
    action: "upsert", payload, clientUpdatedAt: "", serverUpdatedAt: 0, ...extra };
}
function snapshot(items: SyncChange[], extra: Partial<SyncPullResult> = {}): SyncPullResult {
  return { mode: "snapshot", version: 10, snapshotVersion: 10, items, changes: items, hasMore: false, cursor: null, ...extra };
}
function song(id: string, favoritedAt = 1000) { return { id, source: "kg", name: id, favoritedAt }; }

describe("桌面同步快照与游标", () => {
  let sync: typeof import("./syncService");
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    mocks.db = new AppDatabase(":memory:");
    mocks.account = { loggedIn: true, token: "account-token", user: { id: "user-1" } };
    mocks.db.setSetting("sync-state", { seededAccountId: "user-1", lastVersion: 0 }, 1);
    mocks.pull.mockReset(); mocks.push.mockReset();
    mocks.push.mockResolvedValue({ version: 999, accepted: 1, skipped: 0 });
    sync = await import("./syncService");
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); mocks.db?.close(); });

  it("收藏时间落库并按远端时间排序，旧字段缺失保留原时间", () => {
    const db = mocks.db!;
    db.addFavoriteSong(song("older", 1000), true);
    db.addFavoriteSong(song("newer", 2000), true);
    db.addFavoriteSong({ id: "older", source: "kg", name: "updated" }, true);
    expect(db.listFavoriteSongs().map((item) => [item.trackId, item.payload.favoritedAt])).toEqual([["newer", 2000], ["older", 1000]]);
    sync.recordFavoriteSongChange({ id: "older", source: "kg" }, "upsert", { schedule: false });
    expect(JSON.parse(String((db.listSyncOutbox()[0] as { payload_json: string }).payload_json)).favoritedAt).toBe(1000);
  });

  it("全分页结束才对账，同设备快照仍应用，缺失四类项被清理", async () => {
    const db = mocks.db!;
    db.addFavoriteSong(song("stale"), true);
    db.addFavoriteSong({ id: "disk", source: "local" });
    db.addFavoritePlaylist({ id: "p", source: "kg", name: "p", desc: "", cover: "", tags: [] });
    db.createUserPlaylist({ id: "gone", name: "gone" });
    db.createUserPlaylist({ id: "keep", name: "keep" });
    db.addUserPlaylistTrack("keep", song("stale-track"));
    mocks.pull.mockResolvedValueOnce(snapshot([change("kg:new", song("new", 4000), { deviceId: "this-device" })], { hasMore: true, cursor: "1" }));
    mocks.pull.mockImplementationOnce(async (_token, since, page) => {
      expect(since).toBe(0); expect(page).toEqual({ snapshotVersion: 10, cursor: "1" });
      expect(db.containsFavoriteSong("kg", "stale")).toBe(true);
      expect(db.containsFavoriteSong("kg", "new")).toBe(false);
      return snapshot([change("local:keep", { id: "keep", source: "local", name: "keep" }, { itemType: "user_playlist" })]);
    });
    const result = await sync.syncNow();
    expect(result.lastVersion).toBe(10);
    expect(db.listFavoriteSongs().map((item) => item.trackId).sort()).toEqual(["disk", "new"]);
    expect(db.listFavoritePlaylists()).toHaveLength(0);
    expect(db.listUserPlaylists("local").map((item) => item.playlistId)).toEqual(["keep"]);
    expect(db.listUserPlaylistTracks("keep")).toHaveLength(0);
  });

  it("分页途中产生的持久pending不被覆盖，pending子项保护父删除", async () => {
    const db = mocks.db!;
    db.createUserPlaylist({ id: "protected", name: "local" });
    db.addUserPlaylistTrack("protected", song("local-track"));
    mocks.pull.mockResolvedValueOnce(snapshot([], { hasMore: true, cursor: "1" }));
    mocks.pull.mockImplementationOnce(async () => {
      db.addFavoriteSong(song("pending", 7000), true);
      for (let i = 0; i < 510; i++) db.enqueueSyncOp({ itemType: "favorite_song", itemKey: `kg:irrelevant-${i}`, action: "delete" });
      db.enqueueSyncOp({ itemType: "favorite_song", itemKey: "kg:pending", action: "upsert", payload: song("pending", 7000) });
      db.enqueueSyncOp({ itemType: "playlist_track", itemKey: "protected|kg:local-track", action: "upsert", payload: song("local-track") });
      return snapshot([change("kg:pending", song("pending", 1000))]);
    });
    mocks.push.mockRejectedValue(new Error("offline"));
    await sync.syncNow();
    expect(db.getFavoriteSong("kg", "pending")?.payload.favoritedAt).toBe(7000);
    expect(db.listUserPlaylists("local").map((item) => item.playlistId)).toContain("protected");
    expect(db.listUserPlaylistTracks("protected")).toHaveLength(1);
  });

  it("409丢弃未完成快照后重拉，空快照有删除权威", async () => {
    mocks.db!.addFavoriteSong(song("stale"), true);
    mocks.pull.mockResolvedValueOnce(snapshot([change("kg:discard", song("discard"))], { hasMore: true, cursor: "1" }));
    mocks.pull.mockRejectedValueOnce(Object.assign(new Error("changed"), { code: 409 }));
    mocks.pull.mockResolvedValueOnce(snapshot([], { version: 12, snapshotVersion: 12 }));
    expect((await sync.syncNow()).lastVersion).toBe(12);
    expect(mocks.db!.listFavoriteSongs()).toHaveLength(0);
  });

  it("旧服务端增量拉到空页，push全局版本不推进游标", async () => {
    const db = mocks.db!;
    db.setSetting("sync-state", { seededAccountId: "user-1", lastVersion: 2 }, 1);
    db.enqueueSyncOp({ itemType: "favorite_song", itemKey: "kg:mine", action: "upsert", payload: song("mine") });
    mocks.pull.mockResolvedValueOnce({ version: 999, changes: [change("kg:a", song("a"), { version: 3 })] });
    mocks.pull.mockResolvedValueOnce({ version: 999, changes: [] });
    mocks.pull.mockResolvedValueOnce({ mode: "delta", version: 999, hasMore: false, changes: [change("kg:b", song("b"), { version: 4 })] });
    expect((await sync.syncNow()).lastVersion).toBe(4);
    expect(mocks.pull.mock.calls.map((call) => call[1])).toEqual([2, 3, 2]);
  });

  it("账号切换后旧请求结果不落库、不覆盖新账号游标", async () => {
    mocks.pull.mockImplementationOnce(async () => {
      mocks.account = { loggedIn: true, token: "new-token", user: { id: "user-2" } };
      return snapshot([change("kg:foreign", song("foreign"))]);
    });
    await sync.syncNow();
    expect(mocks.db!.listFavoriteSongs()).toHaveLength(0);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(sync.getSyncState().userId).toBe("user-2");
    expect(sync.getSyncState().lastVersion).toBe(0);
  });

  it("首次seed超过200项连续推完，保持原收藏时间并重拉权威数据", async () => {
    const db = mocks.db!;
    db.deleteSetting("sync-state");
    for (let i = 0; i < 205; i++) db.addFavoriteSong(song(String(i), 1000 + i), true);
    mocks.pull.mockResolvedValue(snapshot([]));
    await sync.syncNow();
    expect(mocks.push.mock.calls.map((call) => call[1].length)).toEqual([200, 5]);
    const sent = mocks.push.mock.calls.flatMap((call) => call[1]) as { itemKey: string; payload: { favoritedAt: number } }[];
    expect(sent.find((item) => item.itemKey === "kg:0")?.payload.favoritedAt).toBe(1000);
    expect(db.listSyncOutbox()).toHaveLength(0);
    expect(mocks.pull).toHaveBeenCalledTimes(2);
  });

  it("未推送删除阻止快照复活，增量本设备回声仍推进实际游标", async () => {
    const db = mocks.db!;
    db.enqueueSyncOp({ itemType: "favorite_song", itemKey: "kg:deleted", action: "delete" });
    mocks.pull.mockResolvedValueOnce(snapshot([change("kg:deleted", song("deleted"))]));
    mocks.push.mockRejectedValueOnce(new Error("offline"));
    await sync.syncNow();
    expect(db.containsFavoriteSong("kg", "deleted")).toBe(false);
    db.clearSyncOutbox();
    db.setSetting("sync-state", { seededAccountId: "user-1", lastVersion: 10 }, 1);
    mocks.pull.mockResolvedValueOnce({ mode: "delta", version: 20, hasMore: false,
      changes: [change("kg:echo", song("echo"), { version: 11, deviceId: "this-device" })] });
    expect((await sync.syncNow()).lastVersion).toBe(11);
    expect(db.containsFavoriteSong("kg", "echo")).toBe(false);
  });

  it("完整快照落库失败时回滚全部变更且不推进游标", async () => {
    const db = mocks.db!;
    db.addFavoriteSong(song("existing"), true);
    mocks.pull.mockResolvedValueOnce(snapshot([
      change("kg:first", song("first")),
      change("invalid:playlist", { id: "bad", source: "invalid" }, { itemType: "favorite_playlist" }),
    ]));
    const result = await sync.syncNow();
    expect(result.lastVersion).toBe(0);
    expect(result.lastError).not.toBe("");
    expect(db.listFavoriteSongs().map((item) => item.trackId)).toEqual(["existing"]);
  });

  it("LWW拒绝已过游标的旧pending后，用快照恢复远端winner", async () => {
    const db = mocks.db!;
    db.setSetting("sync-state", { seededAccountId: "user-1", lastVersion: 20 }, 1);
    db.addFavoriteSong({ ...song("winner", 1000), name: "stale-local" }, true);
    db.enqueueSyncOp({ itemType: "favorite_song", itemKey: "kg:winner", action: "upsert", payload: song("winner", 1000) });
    mocks.pull.mockResolvedValueOnce({ mode: "delta", version: 20, changes: [], hasMore: false });
    mocks.push.mockResolvedValueOnce({ version: 20, accepted: 0, skipped: 1 });
    mocks.pull.mockResolvedValueOnce(snapshot([
      change("kg:winner", { ...song("winner", 5000), name: "remote-winner" }, { version: 12, deviceId: "this-device" }),
    ], { version: 20, snapshotVersion: 20 }));
    const result = await sync.syncNow();
    expect(mocks.pull.mock.calls.map((call) => call[1])).toEqual([20, 0]);
    expect(db.getFavoriteSong("kg", "winner")?.payload).toMatchObject({ name: "remote-winner", favoritedAt: 5000 });
    expect(result.lastVersion).toBe(20);
    expect(db.listSyncOutbox()).toHaveLength(0);
  });
});
