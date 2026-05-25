import { BrowserWindow, app } from "electron";
import { hostname } from "node:os";
import { getAppDatabase } from "../database";
import { favoriteKey, normalizePlaylistSnapshot, normalizeTrackSnapshot } from "../database/normalizers";
import type { PlaylistSnapshot, TrackSnapshot } from "../database/types";
import {
  createSyncSpace as requestCreateSyncSpace,
  getSyncChanges,
  joinSyncSpace as requestJoinSyncSpace,
  pushSyncChanges,
  resetSyncSpace as requestResetSyncSpace,
  unbindSyncDevice,
  type SyncChange,
} from "../system/systemClient";

const SYNC_SETTING_KEY = "sync-state";
const TYPE_FAVORITE_SONG = "favorite_song";
const TYPE_FAVORITE_PLAYLIST = "favorite_playlist";
const TYPE_USER_PLAYLIST = "user_playlist";
const TYPE_PLAYLIST_TRACK = "playlist_track";

type SyncState = {
  token: string;
  syncCode: string;
  deviceId: string;
  spaceId: string;
  lastServerVersion: number;
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

let syncRunning = false;
let syncQueued = false;

export function getSyncState(): SyncState {
  return getAppDatabase().getSetting<SyncState>(SYNC_SETTING_KEY)?.value ?? emptyState();
}

export async function createSyncSpace() {
  const state = getSyncState();
  const result = state.token
    ? await requestResetSyncSpace(state.token, deviceName())
    : await requestCreateSyncSpace(deviceName());
  saveSyncState({
    token: result.token,
    syncCode: result.syncCode,
    deviceId: result.deviceId,
    spaceId: result.spaceId,
    lastServerVersion: result.version,
    lastSyncAt: "",
    lastError: "",
  });
  seedInitialOutbox();
  return syncNow();
}

export async function joinSyncSpace(syncCode: string) {
  const result = await requestJoinSyncSpace(syncCode.trim(), deviceName());
  saveSyncState({
    token: result.token,
    syncCode: result.syncCode,
    deviceId: result.deviceId,
    spaceId: result.spaceId,
    lastServerVersion: 0,
    lastSyncAt: "",
    lastError: "",
  });
  seedInitialOutbox();
  return syncNow();
}

export async function syncNow(): Promise<SyncState> {
  if (syncRunning) {
    syncQueued = true;
    return getSyncState();
  }
  syncRunning = true;
  try {
    const state = getSyncState();
    if (!state.token) return state;

    let nextVersion = state.lastServerVersion || 0;
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
        lastServerVersion: nextVersion,
        lastSyncAt: new Date().toISOString(),
        lastError: "",
      });
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
      setTimeout(() => void syncNow(), 250);
    }
  }
}

export async function unbindSync() {
  const state = getSyncState();
  if (state.token) {
    await unbindSyncDevice(state.token).catch(() => null);
  }
  getAppDatabase().deleteSetting(SYNC_SETTING_KEY);
  emitSyncChanged();
  return getSyncState();
}

export function startSyncOnStartup() {
  if (!getSyncState().token) return;
  setTimeout(() => void syncNow(), 1500);
}

export function recordFavoriteSongChange(track: TrackSnapshot, action: "upsert" | "delete") {
  const normalized = normalizeTrackSnapshot(track);
  if (normalized.source === "local") return;
  enqueueAndSync(TYPE_FAVORITE_SONG, favoriteKey(normalized.source, normalized.id), action, action === "delete" ? {} : syncSongPayload(normalized));
}

export function recordFavoriteSongDelete(source: string, id: string) {
  if (source === "local") return;
  enqueueAndSync(TYPE_FAVORITE_SONG, favoriteKey(source, id), "delete", {});
}

export function recordFavoritePlaylistChange(playlist: PlaylistSnapshot, action: "upsert" | "delete") {
  const normalized = normalizePlaylistSnapshot(playlist);
  if (normalized.source === "local") return;
  enqueueAndSync(TYPE_FAVORITE_PLAYLIST, favoriteKey(normalized.source, normalized.id), action, action === "delete" ? {} : normalized);
}

export function recordFavoritePlaylistDelete(source: string, id: string) {
  if (source === "local") return;
  enqueueAndSync(TYPE_FAVORITE_PLAYLIST, favoriteKey(source, id), "delete", {});
}

export function recordUserPlaylistChange(playlist: PlaylistSnapshot, action: "upsert" | "delete") {
  const normalized = clearLocalFileCover(normalizePlaylistSnapshot(playlist));
  if (normalized.source !== "local") return;
  enqueueAndSync(TYPE_USER_PLAYLIST, favoriteKey(normalized.source, normalized.id), action, action === "delete" ? {} : normalized);
}

export function recordUserPlaylistTrackChange(playlistId: string, track: TrackSnapshot, action: "upsert" | "delete") {
  const normalized = normalizeTrackSnapshot(track);
  if (normalized.source === "local") return;
  enqueueAndSync(
    TYPE_PLAYLIST_TRACK,
    `${playlistId}|${favoriteKey(normalized.source, normalized.id)}`,
    action,
    action === "delete" ? {} : syncSongPayload(normalized)
  );
}

function seedInitialOutbox() {
  const db = getAppDatabase();
  db.listFavoriteSongs().forEach((item) => recordFavoriteSongChange(item.payload, "upsert"));
  db.listFavoritePlaylists().forEach((item) => recordFavoritePlaylistChange(item.payload, "upsert"));
  db.listUserPlaylists("local").forEach((playlist) => {
    recordUserPlaylistChange(playlist.payload, "upsert");
    db.listUserPlaylistTracks(playlist.playlistId).forEach((track) => {
      recordUserPlaylistTrackChange(playlist.playlistId, track.payload, "upsert");
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

function enqueueAndSync(itemType: string, itemKey: string, action: "upsert" | "delete", payload: unknown) {
  if (!getSyncState().token) return;
  getAppDatabase().enqueueSyncOp({ itemType, itemKey, action, payload });
  setTimeout(() => void syncNow(), 500);
}

function saveSyncState(state: SyncState) {
  getAppDatabase().setSetting(SYNC_SETTING_KEY, state, 1);
}

function emptyState(): SyncState {
  return {
    token: "",
    syncCode: "",
    deviceId: "",
    spaceId: "",
    lastServerVersion: 0,
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

function deviceName() {
  return `${app.name || "PisaMusic"} ${hostname()}`.trim();
}
