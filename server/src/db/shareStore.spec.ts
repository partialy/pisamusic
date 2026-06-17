import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const dbPath = path.resolve(process.cwd(), "data/share-store-test.db");
for (const suffix of ["", "-shm", "-wal"]) {
  fs.rmSync(`${dbPath}${suffix}`, { force: true });
}
process.env.PISA_APP_DB_PATH = dbPath;

const sharer = {
  userId: "user-1",
  user: {
    id: "user-1",
    email: "share@example.com",
    username: "分享用户",
    avatar: "/static/account-avatars/default.jpg",
    avatarKey: "default",
    avatarUrl: "/static/account-avatars/default.jpg",
    createdAt: 1,
    lastLoginAt: null,
  },
};

const song = {
  id: "song-1",
  source: "kg",
  name: "测试歌曲",
  singer: "测试歌手",
  album: "测试专辑",
  cover: "https://example.com/song.jpg",
  duration: 180000,
};

const playlist = {
  id: "playlist-1",
  source: "wy",
  name: "测试歌单",
  desc: "适合测试的歌单",
  cover: "https://example.com/playlist.jpg",
  song_count: 12,
};

test("创建歌曲和歌单分享后可公开读取", async () => {
  const store = await import("./shareStore.js");
  const songShare = store.createShareRecord({ type: "song", rawJson: song }, sharer);
  assert.equal(songShare.type, "song");
  assert.equal(songShare.title, song.name);
  assert.equal(songShare.description, song.singer);
  assert.equal(songShare.coverUrl, song.cover);
  assert.equal(songShare.rawJson.album, song.album);
  assert.equal(songShare.sharer.username, sharer.user.username);

  const playlistShare = store.createShareRecord({ type: "playlist", rawJson: playlist }, sharer);
  assert.equal(playlistShare.type, "playlist");
  assert.equal(playlistShare.title, playlist.name);
  assert.equal(playlistShare.description, playlist.desc);
  assert.equal(playlistShare.coverUrl, playlist.cover);
  assert.equal(playlistShare.rawJson.song_count, playlist.song_count);
});

test("公开读取会递增访问次数", async () => {
  const store = await import("./shareStore.js");
  const share = store.createShareRecord({ type: "song", rawJson: song }, sharer);
  assert.equal(share.accessCount, 0);
  assert.equal(store.readPublicShareAndIncrement(share.uuid)?.accessCount, 1);
  assert.equal(store.readPublicShareAndIncrement(share.uuid)?.accessCount, 2);
  assert.equal(store.readPublicShare(share.uuid)?.accessCount, 2);
});

test("失效记录不可公开读取", async () => {
  const store = await import("./shareStore.js");
  const { getAppDb } = await import("./appDb.js");
  const share = store.createShareRecord({ type: "playlist", rawJson: playlist }, sharer);
  getAppDb().prepare("UPDATE share_records SET valid = 0, invalidated_at = ? WHERE uuid = ?").run(Date.now(), share.uuid);
  assert.equal(store.readPublicShare(share.uuid), null);
  assert.equal(store.readPublicShareAndIncrement(share.uuid), null);
});

test("非法分享数据会被拒绝", async () => {
  const store = await import("./shareStore.js");
  assert.throws(
    () => store.createShareRecord({ type: "album" as never, rawJson: song }, sharer),
    /无效的分享类型/,
  );
  assert.throws(
    () => store.createShareRecord({ type: "song", rawJson: { ...song, singer: "" } }, sharer),
    /歌手不能为空/,
  );
  assert.throws(
    () => store.createShareRecord({ type: "song", rawJson: { ...song, playUrl: "https://example.com/a.mp3" } }, sharer),
    /不能包含 playUrl 字段/,
  );
  assert.throws(
    () => store.createShareRecord({ type: "song", rawJson: { ...song, extra: "x".repeat(70 * 1024) } }, sharer),
    /分享数据字段过长|不能超过64KB/,
  );
});
