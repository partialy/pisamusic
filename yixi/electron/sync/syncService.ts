import { captureAccountLibrary, isCurrentLibrary, type AccountLibraryContext } from "../account/accountLibraryContext";
import { onAccountIdentityChanged } from "../account/accountIdentity";
import { logicalTrackId, seedAccountLibrary, syncPayload } from "./syncPayload";
import { BrowserWindow } from "electron";
import { getAppDatabase } from "../database";
import { normalizePlaylistSnapshot, normalizeTrackSnapshot } from "../database/normalizers";
import type { PlaylistSnapshot, TrackSnapshot } from "../database/types";
import {
  getSyncChanges,
  pushSyncChanges,
  type SyncChange,
  type SyncPullResult,
} from "../system/systemClient";

const SYNC_SETTING_KEY = "sync-state";
const TYPE_FAVORITE_SONG = "favorite_song";
const TYPE_FAVORITE_PLAYLIST = "favorite_playlist";
const TYPE_USER_PLAYLIST = "user_playlist";
const TYPE_PLAYLIST_TRACK = "playlist_track";
const DUPLICATE_PULL_GUARD_MS = 1500;

type SyncState = {
  identityRevision: number;
  userId: string;
  seededAccountId: string;
  lastVersion: number;
  lastSyncAt: string;
  lastError: string;
};

type SyncOutboxRow = {
  op_id: string;
  item_type: string;
  item_key: string;
  action: "upsert" | "delete";
  payload_json: string;
  created_at: string;
};

type SyncContext = AccountLibraryContext & { state: SyncState; token: string };

let syncRunning = false;
let syncQueued = false;
let syncTimer: NodeJS.Timeout | null = null;
let syncInFlight: Promise<SyncState> | null = null;
let lastNetworkSyncAt = 0;
let lastNetworkSyncToken = "";
let lastNetworkSyncVersion = 0;
let syncGeneration = 0;
let retryAttempt = 0;
let retryDelayMs = 0;

export function getSyncState(): SyncState {
  const context = captureAccountLibrary();
  const saved = context.scope.accountId ? getAppDatabase().getSetting<Partial<SyncState>>(stateKey(context.scope.accountId))?.value ?? {} : {};
  return { identityRevision: context.revision, userId: context.scope.accountId,
    seededAccountId: saved.seededAccountId ?? "", lastVersion: saved.lastVersion ?? 0,
    lastSyncAt: saved.lastSyncAt ?? "", lastError: saved.lastError ?? "" };
}
function stateKey(accountId: string) { return `${SYNC_SETTING_KEY}:${accountId}`; }
function captureSync(): SyncContext {
  const context = captureAccountLibrary();
  return { ...context, state: getSyncState(), token: context.session.token };
}

export function syncNow(): Promise<SyncState> {
  clearPendingSyncTimer();
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSyncNow().finally(() => {
    syncInFlight = null;
    const delay = retryDelayMs;
    retryDelayMs = 0;
    if (syncQueued || delay) {
      syncQueued = false;
      requestSync(delay || 250);
    }
  });
  return syncInFlight;
}

async function runSyncNow(): Promise<SyncState> {
  const generation = syncGeneration;
  const context = captureSync();
  syncRunning = true;
  try {
    let state = context.state;
    if (!context.token) return state;
    if (state.userId && state.seededAccountId !== state.userId) {
      getAppDatabase().applySyncTransaction(() => seedAccountLibrary(context.repo));
      saveSyncState(context, { ...state, seededAccountId: state.userId, lastVersion: 0, lastSyncAt: "", lastError: "" });
      state = getSyncState();
    }

    let nextVersion = state.lastVersion || 0;
    if (shouldSkipDuplicatePull(context, nextVersion)) {
      return state;
    }
    try {
      nextVersion = await pullRemoteChanges(context, state, generation);
      if (!isCurrentSync(context, generation)) return getSyncState();

      let pending = context.repo.listSyncOutbox(200) as SyncOutboxRow[];
      const hadPending = pending.length > 0;
      let needsSnapshot = false;
      while (pending.length) {
        const pushed = await pushSyncChanges(
          context.token,
          pending.map((row) => ({
            opId: row.op_id,
            itemType: row.item_type,
            itemKey: row.item_key,
            action: row.action,
            payload: row.action === "delete" ? {} : syncPayload(row.item_type, parsePayload(row.payload_json)),
            clientUpdatedAt: row.created_at,
          }))
        );
        if (!isCurrentSync(context, generation)) return getSyncState();
        needsSnapshot ||= pushed.skipped > 0;
        context.repo.removeSyncOps(pending.map((row) => row.op_id));
        pending = context.repo.listSyncOutbox(200) as SyncOutboxRow[];
      }
      if (hadPending) {
        // 推送版本不是已拉取游标；再拉一次，避免跨过其他设备同时产生的变更。
        // skipped 可能是比起始游标更早的远端胜出，必须从快照恢复权威状态。
        nextVersion = await pullRemoteChanges(context, needsSnapshot ? { ...state, lastVersion: 0 } : state, generation);
      }

      if (!isCurrentSync(context, generation)) return getSyncState();

      saveSyncState(context, {
        ...state,
        lastVersion: nextVersion,
        lastSyncAt: new Date().toISOString(),
        lastError: "",
      });
      retryAttempt = 0;
      recordNetworkSync(context.token, nextVersion);
      emitSyncChanged();
    } catch (error) {
      if (!isCurrentSync(context, generation)) return getSyncState();
      const code = (error as { code?: number })?.code;
      if (retryAttempt < 2 && (error instanceof TypeError || (typeof code === "number" && code >= 500))) retryDelayMs = 1000 * 3 ** retryAttempt++;
      saveSyncState(context, {
        ...state,
        lastError: error instanceof Error ? error.message : String(error),
      });
      emitSyncChanged();
    }
    return getSyncState();
  } finally {
    syncRunning = false;
  }
}

export async function clearSyncState() {
  syncGeneration++;
  retryAttempt = 0;
  retryDelayMs = 0;
  clearPendingSyncTimer();
  syncQueued = false;
  lastNetworkSyncAt = 0;
  lastNetworkSyncToken = "";
  lastNetworkSyncVersion = 0;
  // 只重置当前账号游标，所有账号及未关联区 pending 保留。
  const accountId = captureAccountLibrary().scope.accountId;
  if (accountId) getAppDatabase().deleteSetting(stateKey(accountId));
  emitSyncChanged();
  return getSyncState();
}
export function startSyncOnStartup() { requestSync(1500); }
/** 旧 main 调用兼容入口：一次账号事务完成关系与 outbox，不能在已提交变更后重复调用。 */
export function recordFavoriteSongChange(track: TrackSnapshot, action: "upsert" | "delete", options?: { schedule?: boolean }) {
  const { repo } = captureAccountLibrary();
  if (action === "upsert") repo.addFavoriteSong(track);
  else repo.removeFavoriteSong(track.source, track.id);
  if (options?.schedule !== false) scheduleLibrarySync();
}
export function scheduleLibrarySync() { requestSync(500); }
onAccountIdentityChanged(() => {
  syncGeneration++;
  retryAttempt = 0;
  retryDelayMs = 0;
  clearPendingSyncTimer();
  syncQueued = true;
  emitSyncChanged();
  requestSync(500);
});
function isCurrentSync(context: SyncContext, generation: number) {
  return generation === syncGeneration && isCurrentLibrary(context);
}
async function pullRemoteChanges(context: SyncContext, state: SyncState, generation: number): Promise<number> {
  let since = state.lastVersion;
  let snapshot: SyncChange[] = [];
  let page: { snapshotVersion: number; cursor: string } | undefined;
  let restarts = 0;
  while (true) {
    let result: SyncPullResult;
    try {
      result = await getSyncChanges(context.token, page ? 0 : since, page);
    } catch (error) {
      if (page && (error as { code?: number })?.code === 409 && restarts++ < 3) {
        snapshot = [];
        page = undefined;
        since = 0;
        continue;
      }
      throw error;
    }
    if (!isCurrentSync(context, generation)) return state.lastVersion;
    if (result.mode === "snapshot") {
      const version = result.snapshotVersion ?? result.version;
      if (page && version !== page.snapshotVersion) throw new Error("同步快照版本不一致，请重试");
      snapshot.push(...(result.items ?? result.changes));
      if (result.hasMore) {
        if (!result.cursor || result.cursor === page?.cursor) throw new Error("同步快照分页未前进");
        page = { snapshotVersion: version, cursor: result.cursor };
        continue;
      }
      getAppDatabase().applySyncTransaction(() => reconcileSnapshot(context, snapshot));
      return version;
    }
    if (page) throw new Error("同步快照分页模式已改变，请重试");
    getAppDatabase().applySyncTransaction(() => {
      const pending = pendingSyncKeys(context);
      result.changes.forEach((change) => {
        if (change.deviceId !== context.scope.deviceIdentity && !hasPendingChange(change, pending)) applyRemoteChange(context, change);
      });
    });
    // 旧服务端没有 mode/hasMore；继续拉到空页，绝不使用全局 version 跳过日志。
    const next = Math.max(since, ...result.changes.map((change) => change.version));
    if (!result.changes.length) {
      if (result.hasMore) throw new Error("同步增量分页未前进");
      return since;
    }
    if (next <= since) throw new Error("同步增量游标未前进");
    since = next;
    if (result.hasMore === false) return since;
  }
}

function syncItemKey(type: string, key: string) {
  return JSON.stringify([type, key]);
}

function pendingSyncKeys(context: SyncContext) {
  const keys = new Set<string>();
  context.repo.listPendingSyncKeys().forEach((row) => {
    keys.add(syncItemKey(row.item_type, row.item_key));
    // 歌单删除会级联删除曲目；未推送曲目同时保护父歌单。
    if (row.item_type === TYPE_PLAYLIST_TRACK) {
      const parsed = playlistTrackFromKey(row.item_key);
      if (parsed) keys.add(syncItemKey(`${TYPE_USER_PLAYLIST}:pending_children`, `local:${parsed.playlistId}`));
    }
  });
  return keys;
}

function hasPendingChange(change: Pick<SyncChange, "itemType" | "itemKey" | "action">, pending: Set<string>) {
  if (pending.has(syncItemKey(change.itemType, change.itemKey))) return true;
  if (change.itemType === TYPE_USER_PLAYLIST && change.action === "delete") {
    return pending.has(syncItemKey(`${TYPE_USER_PLAYLIST}:pending_children`, change.itemKey));
  }
  if (change.itemType === TYPE_PLAYLIST_TRACK) {
    const parsed = playlistTrackFromKey(change.itemKey);
    return Boolean(parsed && pending.has(syncItemKey(TYPE_USER_PLAYLIST, `local:${parsed.playlistId}`)));
  }
  return false;
}

function reconcileSnapshot(context: SyncContext, items: SyncChange[]) {
  const db = context.repo;
  const pending = pendingSyncKeys(context);
  const remoteKeys = new Set(items.map((item) => syncItemKey(item.itemType, item.itemKey)));
  const removeMissing = (itemType: string, itemKey: string, remove: () => void) => {
    if (!remoteKeys.has(syncItemKey(itemType, itemKey)) && !hasPendingChange({ itemType, itemKey, action: "delete" }, pending)) remove();
  };
  // 只有完整快照才能删本地缺失项，快照不跳过同设备条目。
  items.filter((item) => item.itemType === TYPE_USER_PLAYLIST).forEach((item) => {
    if (!hasPendingChange(item, pending)) applyRemoteChange(context, item);
  });
  items.filter((item) => item.itemType !== TYPE_USER_PLAYLIST).forEach((item) => {
    if (!hasPendingChange(item, pending)) applyRemoteChange(context, item);
  });
  db.listFavoriteSongs().filter((item) => item.source !== "local").forEach((item) => {
    removeMissing(TYPE_FAVORITE_SONG, item.favoriteKey, () => db.removeFavoriteSong(item.source, item.trackId, { fromSync: true }));
  });
  db.listFavoritePlaylists().forEach((item) => {
    removeMissing(TYPE_FAVORITE_PLAYLIST, item.favoriteKey, () => db.removeFavoritePlaylist(item.source, item.playlistId, { fromSync: true }));
  });
  db.listUserPlaylists("local").forEach((playlist) => {
    db.listUserPlaylistTracks(playlist.playlistId).forEach((track) => {
      removeMissing(TYPE_PLAYLIST_TRACK, `${playlist.playlistId}|${track.source}:${logicalTrackId(db, track.payload)}`, () => db.removeUserPlaylistTrack(playlist.playlistId, track.source, track.trackId, { fromSync: true }));
    });
    removeMissing(TYPE_USER_PLAYLIST, playlist.playlistKey, () => db.removeUserPlaylist(playlist.source, playlist.playlistId, { fromSync: true }));
  });
}

function applyRemoteChange(context: SyncContext, change: SyncChange) {
  switch (change.itemType) {
    case TYPE_FAVORITE_SONG:
      applyFavoriteSong(context, change);
      break;
    case TYPE_FAVORITE_PLAYLIST:
      applyFavoritePlaylist(context, change);
      break;
    case TYPE_USER_PLAYLIST:
      applyUserPlaylist(context, change);
      break;
    case TYPE_PLAYLIST_TRACK:
      applyPlaylistTrack(context, change);
      break;
  }
}

function applyFavoriteSong(context: SyncContext, change: SyncChange) {
  const parsed = songFromPayloadOrKey(change.payload, change.itemKey);
  if (!parsed || parsed.source === "local") return;
  if (change.action === "delete") {
    context.repo.removeFavoriteSong(parsed.source, parsed.id, { fromSync: true });
  } else {
    context.repo.addFavoriteSong(parsed, true);
  }
}

function applyFavoritePlaylist(context: SyncContext, change: SyncChange) {
  const parsed = playlistFromPayloadOrKey(change.payload, change.itemKey);
  if (!parsed) return;
  if (change.action === "delete") {
    context.repo.removeFavoritePlaylist(parsed.source, parsed.id, { fromSync: true });
  } else {
    context.repo.addFavoritePlaylist(parsed, { fromSync: true });
  }
}

function applyUserPlaylist(context: SyncContext, change: SyncChange) {
  const parsed = playlistFromPayloadOrKey(change.payload, change.itemKey);
  if (!parsed || parsed.source !== "local") return;
  if (change.action === "delete") {
    context.repo.removeUserPlaylist(parsed.source, parsed.id, { fromSync: true });
  } else {
    context.repo.upsertUserPlaylist(clearLocalFileCover(parsed), { fromSync: true });
  }
}

function applyPlaylistTrack(context: SyncContext, change: SyncChange) {
  const parsed = playlistTrackFromKey(change.itemKey);
  if (!parsed || !context.repo.listUserPlaylists("local").some(item => item.playlistId === parsed.playlistId)) return;
  const song = songFromPayloadOrKey(change.payload, parsed.trackKey);
  if (!song) return;
  const resolved = context.repo.resolveIncomingTrack(song);
  if (change.action === "delete") {
    context.repo.removeUserPlaylistTrack(parsed.playlistId, resolved.source, resolved.id, { fromSync: true });
  } else {
    context.repo.addUserPlaylistTrack(parsed.playlistId, song, { fromSync: true, serverVersion: change.version, sortOrder: (change.payload as { sortOrder?: number | null })?.sortOrder });
  }
}

function requestSync(delayMs = 500) {
  if (!captureSync().token) return;
  if (syncRunning || syncInFlight) {
    syncQueued = true;
    return;
  }
  if (syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncNow();
  }, delayMs);
}

function clearPendingSyncTimer() {
  if (!syncTimer) return;
  clearTimeout(syncTimer);
  syncTimer = null;
}

function shouldSkipDuplicatePull(context: SyncContext, nextVersion: number) {
  if (context.repo.listSyncOutbox(1).length > 0) return false;
  if (context.token !== lastNetworkSyncToken) return false;
  if (nextVersion !== lastNetworkSyncVersion) return false;
  return Date.now() - lastNetworkSyncAt < DUPLICATE_PULL_GUARD_MS;
}

function recordNetworkSync(token: string, version: number) {
  lastNetworkSyncAt = Date.now();
  lastNetworkSyncToken = token;
  lastNetworkSyncVersion = version;
}

function saveSyncState(context: SyncContext, state: SyncState) {
  getAppDatabase().setSetting(
    stateKey(context.scope.accountId),
    {
      lastVersion: state.lastVersion,
      lastSyncAt: state.lastSyncAt,
      lastError: state.lastError,
      seededAccountId: state.seededAccountId,
    },
    1
  );
}

function parsePayload(raw: string) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function songFromPayloadOrKey(payload: unknown, key: string): TrackSnapshot | null {
  try {
    if (payload && typeof payload === "object" && "id" in payload) {
      return normalizeTrackSnapshot(payload as Record<string, unknown>);
    }
  } catch {
    // fallback to key below
  }
  const parts = key.split(":");
  if (parts.length < 2 || !parts[1]) return null;
  return normalizeTrackSnapshot({
    source: parts[0],
    id: parts.slice(1).join(":"),
    urlParam: parts.slice(1).join(":"),
    name: "",
    singer: "",
  });
}

function playlistFromPayloadOrKey(payload: unknown, key: string): PlaylistSnapshot | null {
  try {
    if (payload && typeof payload === "object" && "id" in payload) {
      return normalizePlaylistSnapshot(payload as Record<string, unknown>);
    }
  } catch {
    // fallback to key below
  }
  const parts = key.split(":");
  if (parts.length < 2 || !parts[1]) return null;
  return normalizePlaylistSnapshot({
    source: parts[0],
    id: parts.slice(1).join(":"),
    name: "",
    desc: "",
    cover: "",
    tags: [],
  });
}

function playlistTrackFromKey(key: string) {
  const [playlistId, ...rest] = key.split("|");
  const trackKey = rest.join("|");
  if (!playlistId || !trackKey) return null;
  return { playlistId, trackKey };
}

function clearLocalFileCover(playlist: PlaylistSnapshot): PlaylistSnapshot {
  if (playlist.source !== "local") return playlist;
  const cover = playlist.cover.trim().toLowerCase();
  if (cover.startsWith("http://") || cover.startsWith("https://")) return playlist;
  if (!cover.startsWith("file:") && !cover.includes("\\") && !cover.includes("/covers/playlists/")) {
    return playlist;
  }
  return { ...playlist, cover: "" };
}

function emitSyncChanged() {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("sync:changed", getSyncState());
    win.webContents.send("favorites:changed");
    win.webContents.send("mine-library:changed");
  });
}
