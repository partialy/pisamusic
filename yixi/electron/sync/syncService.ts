import { BrowserWindow } from "electron";
import { getAppDatabase } from "../database";
import { favoriteKey, normalizePlaylistSnapshot, normalizeTrackSnapshot } from "../database/normalizers";
import type { PlaylistSnapshot, TrackSnapshot } from "../database/types";
import {
  getAccountSession,
  getSyncChanges,
  pushSyncChanges,
  type SyncChange,
} from "../system/systemClient";

const SYNC_SETTING_KEY = "sync-state";
const TYPE_FAVORITE_SONG = "favorite_song";
const TYPE_FAVORITE_PLAYLIST = "favorite_playlist";
const TYPE_USER_PLAYLIST = "user_playlist";
const TYPE_PLAYLIST_TRACK = "playlist_track";
const DUPLICATE_PULL_GUARD_MS = 1500;

type SyncState = {
  token: string;
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

type SyncRecordOptions = {
  schedule?: boolean;
};

let syncRunning = false;
let syncQueued = false;
let syncTimer: NodeJS.Timeout | null = null;
let syncInFlight: Promise<SyncState> | null = null;
let lastNetworkSyncAt = 0;
let lastNetworkSyncToken = "";
let lastNetworkSyncVersion = 0;

export function getSyncState(): SyncState {
  const saved = getAppDatabase().getSetting<Partial<SyncState> & Record<string, unknown>>(SYNC_SETTING_KEY)?.value ?? {};
  const account = getAccountSession();
  const userId = account.loggedIn ? account.user.id : "";
  const seededAccountId = saved.seededAccountId ?? "";
  const sameAccount = Boolean(userId && seededAccountId === userId);
  return {
    ...emptyState(),
    ...saved,
    token: account.loggedIn ? account.token : "",
    userId,
    seededAccountId,
    lastVersion: sameAccount ? (saved.lastVersion ?? 0) : 0,
    lastSyncAt: sameAccount ? saved.lastSyncAt ?? "" : "",
    lastError: sameAccount ? saved.lastError ?? "" : "",
  };
}

export function syncNow(): Promise<SyncState> {
  clearPendingSyncTimer();
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSyncNow().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function runSyncNow(): Promise<SyncState> {
  syncRunning = true;
  try {
    let state = getSyncState();
    if (!state.token) return state;
    if (state.userId && state.seededAccountId !== state.userId) {
      getAppDatabase().clearSyncOutbox();
      seedInitialOutbox();
      saveSyncState({ ...state, seededAccountId: state.userId, lastVersion: 0, lastSyncAt: "", lastError: "" });
      state = getSyncState();
    }

    let nextVersion = state.lastVersion || 0;
    if (shouldSkipDuplicatePull(state, nextVersion)) {
      return state;
    }
    try {
      const pulled = await getSyncChanges(state.token, nextVersion);
      pulled.changes.forEach(applyRemoteChange);
      nextVersion = Math.max(nextVersion, pulled.version || 0);

      const pending = getAppDatabase().listSyncOutbox(200) as SyncOutboxRow[];
      if (pending.length) {
        const pushed = await pushSyncChanges(
          state.token,
          pending.map((row) => ({
            opId: row.op_id,
            itemType: row.item_type,
            itemKey: row.item_key,
            action: row.action,
            payload: parsePayload(row.payload_json),
            clientUpdatedAt: row.created_at,
          }))
        );
        getAppDatabase().removeSyncOps(pending.map((row) => row.op_id));
        nextVersion = Math.max(nextVersion, pushed.version || 0);
      }

      saveSyncState({
        ...state,
        lastVersion: nextVersion,
        lastSyncAt: new Date().toISOString(),
        lastError: "",
      });
      recordNetworkSync(state.token, nextVersion);
      emitSyncChanged();
    } catch (error) {
      saveSyncState({
        ...state,
        lastError: error instanceof Error ? error.message : String(error),
      });
      emitSyncChanged();
    }
    return getSyncState();
  } finally {
    syncRunning = false;
    if (syncQueued) {
      syncQueued = false;
      requestSync(250);
    }
  }
}

export async function clearSyncState() {
  clearPendingSyncTimer();
  syncQueued = false;
  lastNetworkSyncAt = 0;
  lastNetworkSyncToken = "";
  lastNetworkSyncVersion = 0;
  getAppDatabase().clearSyncOutbox();
  getAppDatabase().deleteSetting(SYNC_SETTING_KEY);
  emitSyncChanged();
  return getSyncState();
}

export function startSyncOnStartup() {
  if (!getSyncState().token) return;
  requestSync(1500);
}

export function recordFavoriteSongChange(track: TrackSnapshot, action: "upsert" | "delete", options?: SyncRecordOptions) {
  const normalized = normalizeTrackSnapshot(track);
  if (normalized.source === "local") return;
  enqueueAndSync(TYPE_FAVORITE_SONG, favoriteKey(normalized.source, normalized.id), action, action === "delete" ? {} : syncSongPayload(normalized), options);
}

export function recordFavoriteSongDelete(source: string, id: string, options?: SyncRecordOptions) {
  if (source === "local") return;
  enqueueAndSync(TYPE_FAVORITE_SONG, favoriteKey(source, id), "delete", {}, options);
}

export function recordFavoritePlaylistChange(playlist: PlaylistSnapshot, action: "upsert" | "delete", options?: SyncRecordOptions) {
  const normalized = normalizePlaylistSnapshot(playlist);
  if (normalized.source === "local") return;
  enqueueAndSync(TYPE_FAVORITE_PLAYLIST, favoriteKey(normalized.source, normalized.id), action, action === "delete" ? {} : normalized, options);
}

export function recordFavoritePlaylistDelete(source: string, id: string, options?: SyncRecordOptions) {
  if (source === "local") return;
  enqueueAndSync(TYPE_FAVORITE_PLAYLIST, favoriteKey(source, id), "delete", {}, options);
}

export function recordUserPlaylistChange(playlist: PlaylistSnapshot, action: "upsert" | "delete", options?: SyncRecordOptions) {
  const normalized = clearLocalFileCover(normalizePlaylistSnapshot(playlist));
  if (normalized.source !== "local") return;
  enqueueAndSync(TYPE_USER_PLAYLIST, favoriteKey(normalized.source, normalized.id), action, action === "delete" ? {} : normalized, options);
}

export function recordUserPlaylistTrackChange(playlistId: string, track: TrackSnapshot, action: "upsert" | "delete", options?: SyncRecordOptions) {
  const normalized = normalizeTrackSnapshot(track);
  if (normalized.source === "local") return;
  enqueueAndSync(
    TYPE_PLAYLIST_TRACK,
    `${playlistId}|${favoriteKey(normalized.source, normalized.id)}`,
    action,
    action === "delete" ? {} : syncSongPayload(normalized),
    options
  );
}

function seedInitialOutbox() {
  const db = getAppDatabase();
  const seedOptions: SyncRecordOptions = { schedule: false };
  db.listFavoriteSongs().forEach((item) => recordFavoriteSongChange(item.payload, "upsert", seedOptions));
  db.listFavoritePlaylists().forEach((item) => recordFavoritePlaylistChange(item.payload, "upsert", seedOptions));
  db.listUserPlaylists("local").forEach((playlist) => {
    recordUserPlaylistChange(playlist.payload, "upsert", seedOptions);
    db.listUserPlaylistTracks(playlist.playlistId).forEach((track) => {
      recordUserPlaylistTrackChange(playlist.playlistId, track.payload, "upsert", seedOptions);
    });
  });
}

function applyRemoteChange(change: SyncChange) {
  switch (change.itemType) {
    case TYPE_FAVORITE_SONG:
      applyFavoriteSong(change);
      break;
    case TYPE_FAVORITE_PLAYLIST:
      applyFavoritePlaylist(change);
      break;
    case TYPE_USER_PLAYLIST:
      applyUserPlaylist(change);
      break;
    case TYPE_PLAYLIST_TRACK:
      applyPlaylistTrack(change);
      break;
  }
}

function applyFavoriteSong(change: SyncChange) {
  const parsed = songFromPayloadOrKey(change.payload, change.itemKey);
  if (!parsed || parsed.source === "local") return;
  if (change.action === "delete") {
    getAppDatabase().removeFavoriteSong(parsed.source, parsed.id);
  } else {
    getAppDatabase().addFavoriteSong(parsed);
  }
}

function applyFavoritePlaylist(change: SyncChange) {
  const parsed = playlistFromPayloadOrKey(change.payload, change.itemKey);
  if (!parsed || parsed.source === "local") return;
  if (change.action === "delete") {
    getAppDatabase().removeFavoritePlaylist(parsed.source, parsed.id);
  } else {
    getAppDatabase().addFavoritePlaylist(parsed);
  }
}

function applyUserPlaylist(change: SyncChange) {
  const parsed = playlistFromPayloadOrKey(change.payload, change.itemKey);
  if (!parsed || parsed.source !== "local") return;
  if (change.action === "delete") {
    getAppDatabase().removeUserPlaylist(parsed.source, parsed.id);
  } else {
    getAppDatabase().upsertUserPlaylist(clearLocalFileCover(parsed));
  }
}

function applyPlaylistTrack(change: SyncChange) {
  const parsed = playlistTrackFromKey(change.itemKey);
  if (!parsed) return;
  const song = songFromPayloadOrKey(change.payload, parsed.trackKey);
  if (!song || song.source === "local") return;
  if (change.action === "delete") {
    getAppDatabase().removeUserPlaylistTrack(parsed.playlistId, song.source, song.id);
  } else {
    getAppDatabase().addUserPlaylistTrack(parsed.playlistId, song);
  }
}

function enqueueAndSync(itemType: string, itemKey: string, action: "upsert" | "delete", payload: unknown, options?: SyncRecordOptions) {
  if (!getSyncState().token) return;
  getAppDatabase().enqueueSyncOp({ itemType, itemKey, action, payload });
  if (options?.schedule === false) return;
  requestSync(500);
}

function requestSync(delayMs = 500) {
  if (!getSyncState().token) return;
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

function shouldSkipDuplicatePull(state: SyncState, nextVersion: number) {
  if (getAppDatabase().listSyncOutbox(1).length > 0) return false;
  if (state.token !== lastNetworkSyncToken) return false;
  if (nextVersion !== lastNetworkSyncVersion) return false;
  return Date.now() - lastNetworkSyncAt < DUPLICATE_PULL_GUARD_MS;
}

function recordNetworkSync(token: string, version: number) {
  lastNetworkSyncAt = Date.now();
  lastNetworkSyncToken = token;
  lastNetworkSyncVersion = version;
}

function saveSyncState(state: SyncState) {
  getAppDatabase().setSetting(
    SYNC_SETTING_KEY,
    {
      lastVersion: state.lastVersion,
      lastSyncAt: state.lastSyncAt,
      lastError: state.lastError,
      seededAccountId: state.seededAccountId,
    },
    1
  );
}

function emptyState(): SyncState {
  return {
    token: "",
    userId: "",
    seededAccountId: "",
    lastVersion: 0,
    lastSyncAt: "",
    lastError: "",
  };
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

function syncSongPayload(track: TrackSnapshot): TrackSnapshot {
  const { filePath, url, lyric, krc, ...rest } = track as TrackSnapshot & {
    url?: string;
  };
  return rest;
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
