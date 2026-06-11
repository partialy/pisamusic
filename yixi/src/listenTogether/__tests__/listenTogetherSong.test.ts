import { describe, expect, it } from "vitest";
import type { Song } from "../../types/song";
import type { ListenTogetherSong } from "../../types/listenTogether";
import {
  canShareSong,
  fromListenTogetherSong,
  sameSongRef,
  songKeyOf,
  songRefOf,
  toListenTogetherSong,
} from "../listenTogetherSong";

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: "song-1",
    urlParam: "hash-1",
    name: "测试歌曲",
    singer: "测试歌手",
    album: "测试专辑",
    cover: "https://example.com/cover.jpg",
    duration: 240_000,
    source: "kg",
    ...overrides,
  };
}

describe("canShareSong", () => {
  it("在线歌曲允许分享", () => {
    expect(canShareSong(makeSong())).toBe(true);
  });

  it("本地歌曲拒绝", () => {
    expect(canShareSong(makeSong({ source: "local" }))).toBe(false);
  });

  it("缺少 id 或歌曲为空时拒绝", () => {
    expect(canShareSong(makeSong({ id: "" }))).toBe(false);
    expect(canShareSong(null)).toBe(false);
    expect(canShareSong(undefined)).toBe(false);
  });
});

describe("toListenTogetherSong", () => {
  it("不发送本地 filePath 和真实播放 URL", () => {
    const song = makeSong({
      url: "https://cdn.example.com/account-bound.mp3?token=secret",
      filePath: "D:/music/local.mp3",
    });
    const remote = toListenTogetherSong(song);
    expect(remote.url).toBe("");
    expect("filePath" in remote).toBe(false);
  });

  it("保留歌曲身份与展示字段", () => {
    const song = makeSong({
      coverSize: { s: "s.jpg", m: "m.jpg", l: "l.jpg", xl: "xl.jpg" },
      vip: true,
      size: { "128": 4_000_000 },
    });
    const remote = toListenTogetherSong(song);
    expect(remote).toMatchObject({
      id: "song-1",
      source: "kg",
      urlParam: "hash-1",
      name: "测试歌曲",
      singer: "测试歌手",
      album: "测试专辑",
      duration: 240_000,
      vip: true,
    });
    expect(remote.coverSize).toEqual(song.coverSize);
    expect(remote.size).toEqual(song.size);
  });

  it("空 name/singer 用占位文案兜底（服务端要求非空）", () => {
    const remote = toListenTogetherSong(makeSong({ name: "", singer: "" }));
    expect(remote.name).not.toBe("");
    expect(remote.singer).not.toBe("");
  });

  it("urlParam 缺失时回退为 id，时长取整裁负", () => {
    const remote = toListenTogetherSong(makeSong({ urlParam: "", duration: -5 }));
    expect(remote.urlParam).toBe("song-1");
    expect(remote.duration).toBe(0);
  });
});

describe("fromListenTogetherSong", () => {
  function makeRemote(overrides: Partial<ListenTogetherSong> = {}): ListenTogetherSong {
    return {
      id: "song-9",
      source: "wy",
      urlParam: "param-9",
      name: "远端歌曲",
      singer: "远端歌手",
      album: "",
      cover: "https://example.com/9.jpg",
      url: "https://evil.example.com/dont-trust.mp3",
      duration: 180_000,
      ...overrides,
    };
  }

  it("不信任远端 url，本端转换后 url 为空待自行取链", () => {
    const song = fromListenTogetherSong(makeRemote());
    expect(song.url).toBe("");
  });

  it("不还原 filePath", () => {
    const song = fromListenTogetherSong(makeRemote({ filePath: "C:/other/pc.mp3" }));
    expect("filePath" in song).toBe(false);
  });

  it("保留歌曲身份与毫秒时长", () => {
    const song = fromListenTogetherSong(makeRemote());
    expect(song).toMatchObject({
      id: "song-9",
      source: "wy",
      urlParam: "param-9",
      name: "远端歌曲",
      singer: "远端歌手",
      duration: 180_000,
    });
  });
});

describe("songRefOf / sameSongRef / songKeyOf", () => {
  it("songRefOf 提取 source+id", () => {
    expect(songRefOf(makeSong())).toEqual({ source: "kg", id: "song-1" });
  });

  it("sameSongRef 来源大小写不敏感，空值不相等", () => {
    expect(sameSongRef({ source: "kg", id: "1" }, { source: "KG" as never, id: "1" })).toBe(true);
    expect(sameSongRef({ source: "kg", id: "1" }, { source: "wy", id: "1" })).toBe(false);
    expect(sameSongRef({ source: "kg", id: "1" }, null)).toBe(false);
    expect(sameSongRef(null, null)).toBe(false);
  });

  it("songKeyOf 输出 source:id", () => {
    expect(songKeyOf(makeSong())).toBe("kg:song-1");
  });
});
