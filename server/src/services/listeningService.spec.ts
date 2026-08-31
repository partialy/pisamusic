import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.PISA_APP_DB_PATH = path.join(mkdtempSync(path.join(os.tmpdir(), "pisamusic-listening-")), "pm.db");

import { getAppDb } from "../db/appDb";
import { addListeningTotal, mergeCoverage } from "../db/listeningStore";
import {
  getListeningSummary,
  getListeningTracks,
  getListeningLevelConfig,
  ingestListeningBatch,
  saveListeningLevelConfig,
  type ListeningAuth,
} from "./listeningService";

const BASE = 1_700_000_000_000;
let userNumber = 0;

function userAuth(deviceId = "device-a"): ListeningAuth {
  const userId = `listening-test-user-${++userNumber}`;
  getAppDb().prepare(
    `INSERT INTO users (id, email, username, password_hash, avatar, avatar_key, sync_version, created_at, updated_at)
     VALUES (?, ?, ?, 'test', '', 'default', 0, ?, ?)`,
  ).run(userId, `${userId}@example.test`, userId, BASE, BASE);
  return { userId, deviceId };
}

function fragment(overrides: Record<string, unknown> = {}) {
  const start = Number(overrides.startedAtMs ?? BASE);
  const end = Number(overrides.endedAtMs ?? start + 60_000);
  return {
    eventId: "event-1",
    playSessionId: "session-1",
    source: "kg",
    songId: "song-1",
    title: "Song",
    artist: "Artist",
    album: "Album",
    trackDurationMs: 180_000,
    startedAtMs: start,
    endedAtMs: end,
    activeDurationMs: end - start,
    ...overrides,
  };
}

function batch(fragments: unknown[]) {
  return { schemaVersion: 1, platform: "android", fragments };
}

test("schema creates all listening tables and default level", () => {
  const db = getAppDb();
  const requiredTables = [
    "listening_fragments",
    "listening_play_sessions",
    "user_listening_intervals",
    "user_track_listening_intervals",
    "user_listening_stats",
    "user_track_stats",
    "listening_level_config",
    "listening_level_rules",
  ];
  for (const table of requiredTables) {
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
  }
  assert.deepEqual(getListeningSummary(userAuth().userId).level, { level: 1, minMinutes: 0, maxMinutes: null });
});

test("coverage union credits only uncovered milliseconds and joins adjacent ranges", () => {
  assert.equal(mergeCoverage([[0, 30], [10, 20]], [15, 40]).creditedMs, 10);
  const merged = mergeCoverage([[0, 10], [20, 30]], [10, 20]);
  assert.equal(merged.endMs, 30);
  assert.equal(merged.creditedMs, 10);
});

test("same eventId is idempotent and rejects a different payload", () => {
  const auth = userAuth();
  const first = ingestListeningBatch(auth, batch([fragment(), fragment()]));
  assert.deepEqual(first.acceptedEventIds, ["event-1"]);
  assert.deepEqual(first.duplicateEventIds, []);
  const duplicate = ingestListeningBatch(auth, batch([fragment()]));
  assert.deepEqual(duplicate.duplicateEventIds, ["event-1"]);
  assert.equal(duplicate.summary.totalMs, 60_000);
  const conflict = ingestListeningBatch(auth, batch([fragment({ endedAtMs: BASE + 61_000, activeDurationMs: 61_000 })]));
  assert.equal(conflict.rejected[0]?.eventId, "event-1");
  assert.equal(conflict.summary.totalMs, 60_000);
});

test("batch eventId conflicts and play-session track conflicts reject only that event", () => {
  const auth = userAuth();
  const batchConflict = ingestListeningBatch(auth, batch([
    fragment({ eventId: "batch-id", songId: "song-a" }),
    fragment({ eventId: "batch-id", songId: "song-b" }),
  ]));
  assert.deepEqual(batchConflict.acceptedEventIds, []);
  assert.deepEqual(batchConflict.duplicateEventIds, []);
  assert.deepEqual(batchConflict.rejected.map((item) => item.eventId), ["batch-id"]);

  const first = ingestListeningBatch(auth, batch([fragment({ eventId: "session-a", playSessionId: "same-session", songId: "song-a" })]));
  assert.deepEqual(first.acceptedEventIds, ["session-a"]);
  const conflict = ingestListeningBatch(auth, batch([fragment({ eventId: "session-b", playSessionId: "same-session", songId: "song-b" })]));
  assert.deepEqual(conflict.acceptedEventIds, []);
  assert.deepEqual(conflict.rejected.map((item) => item.eventId), ["session-b"]);
  assert.equal(getListeningTracks(auth.userId, { limit: 10 }).total, 1);
});

test("user total uses the all-device interval union", () => {
  const auth = userAuth();
  ingestListeningBatch(auth, batch([
    fragment({ eventId: "a-1", playSessionId: "a-session", startedAtMs: BASE, endedAtMs: BASE + 900_000, activeDurationMs: 900_000 }),
    fragment({ eventId: "a-2", playSessionId: "a-session", startedAtMs: BASE + 900_000, endedAtMs: BASE + 1_800_000, activeDurationMs: 900_000 }),
  ]));
  ingestListeningBatch({ ...auth, deviceId: "device-b" }, batch([
    fragment({ eventId: "b-1", playSessionId: "b-session", startedAtMs: BASE + 600_000, endedAtMs: BASE + 1_200_000, activeDurationMs: 600_000 }),
  ]));
  assert.equal(getListeningSummary(auth.userId).totalMs, 1_800_000);
});

test("different songs can overlap while same-song statistics are also deduplicated", () => {
  const auth = userAuth();
  ingestListeningBatch(auth, batch([
    fragment({ eventId: "a-1", playSessionId: "a-session", songId: "song-a", startedAtMs: BASE, endedAtMs: BASE + 900_000, activeDurationMs: 900_000 }),
    fragment({ eventId: "a-2", playSessionId: "a-session", songId: "song-a", startedAtMs: BASE + 900_000, endedAtMs: BASE + 1_800_000, activeDurationMs: 900_000 }),
  ]));
  ingestListeningBatch({ ...auth, deviceId: "device-b" }, batch([
    fragment({ eventId: "b-1", playSessionId: "b-session", songId: "song-b", startedAtMs: BASE + 600_000, endedAtMs: BASE + 1_560_000, activeDurationMs: 960_000 }),
  ]));
  assert.equal(getListeningSummary(auth.userId).totalMs, 1_800_000);
  const tracks = getListeningTracks(auth.userId, { limit: 10 });
  assert.equal(tracks.items.find((item) => item.songId === "song-a")?.listenedMs, 1_800_000);
  assert.equal(tracks.items.find((item) => item.songId === "song-b")?.listenedMs, 960_000);

  const sameSong = userAuth();
  ingestListeningBatch(sameSong, batch([
    fragment({ eventId: "same-a", playSessionId: "same-session-a", songId: "same", startedAtMs: BASE, endedAtMs: BASE + 900_000, activeDurationMs: 900_000 }),
  ]));
  ingestListeningBatch({ ...sameSong, deviceId: "device-b" }, batch([
    fragment({ eventId: "same-b", playSessionId: "same-session-b", songId: "same", startedAtMs: BASE + 600_000, endedAtMs: BASE + 1_500_000, activeDurationMs: 900_000 }),
  ]));
  assert.equal(getListeningTracks(sameSong.userId, { limit: 10 }).items[0]?.listenedMs, 1_500_000);
});

test("qualified session increments play once and natural end increments completion once", () => {
  const auth = userAuth();
  ingestListeningBatch(auth, batch([
    fragment({ eventId: "session-1", playSessionId: "session-count", endedAtMs: BASE + 20_000, activeDurationMs: 20_000 }),
  ]));
  ingestListeningBatch(auth, batch([
    fragment({ eventId: "session-2", playSessionId: "session-count", startedAtMs: BASE + 20_000, endedAtMs: BASE + 31_000, activeDurationMs: 11_000, terminalReason: "natural_end" }),
  ]));
  const track = getListeningTracks(auth.userId, { limit: 10 }).items[0];
  assert.equal(track?.playCount, 1);
  assert.equal(track?.completedCount, 1);
});

test("level range endpoints are inclusive", () => {
  const auth = userAuth();
  const original = getListeningSummary(auth.userId).level;
  const version = getListeningLevelConfig().version;
  saveListeningLevelConfig({
    expectedVersion: version,
    rules: [
      { level: 1, minMinutes: 0, maxMinutes: 999 },
      { level: 2, minMinutes: 1000, maxMinutes: null },
    ],
  });
  addListeningTotal(auth.userId, 999 * 60_000, BASE);
  assert.equal(getListeningSummary(auth.userId).level.level, 1);
  addListeningTotal(auth.userId, 60_000, BASE);
  assert.equal(getListeningSummary(auth.userId).level.level, 2);
  assert.equal(original.level, 1);
});

test("level replacement rejects a stale version without changing the saved rules", () => {
  const current = getListeningLevelConfig();
  const updated = saveListeningLevelConfig({
    expectedVersion: current.version,
    rules: [{ level: 1, minMinutes: 0, maxMinutes: null }],
  });
  assert.equal(updated.version, current.version + 1);
  assert.throws(
    () => saveListeningLevelConfig({ expectedVersion: current.version, rules: [{ level: 1, minMinutes: 0, maxMinutes: null }] }),
    /已被其他管理员更新/,
  );
  assert.deepEqual(getListeningLevelConfig(), updated);
});
