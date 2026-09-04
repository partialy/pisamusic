import { Router } from "express";
import {
  type WebMusicSource,
  getWebRecommendations,
  getWebSongLyric,
  getWebSongUrl,
  searchWebMusic,
} from "../services/webMusicService";
import { fail, ok } from "../types/response";

export const webMusicRouter = Router();

function parseSource(val: unknown): WebMusicSource {
  const s = String(val ?? "").toLowerCase();
  if (s === "kg" || s === "kw" || s === "wy") return s;
  return "wy";
}

webMusicRouter.get("/search", async (req, res) => {
  try {
    const source = parseSource(req.query.source);
    const keywords = String(req.query.keywords ?? "").trim();
    if (!keywords) {
      res.json(ok({ songs: [], total: 0, hasMore: false }));
      return;
    }
    const result = await searchWebMusic(source, keywords);
    res.json(ok(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "搜索失败";
    res.status(500).json(fail(message, 500));
  }
});

webMusicRouter.get("/recommend", async (req, res) => {
  try {
    const source = parseSource(req.query.source);
    const result = await getWebRecommendations(source);
    res.json(ok(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取推荐失败";
    res.status(500).json(fail(message, 500));
  }
});

webMusicRouter.get("/url", async (req, res) => {
  try {
    const source = parseSource(req.query.source);
    const id = String(req.query.id ?? "").trim();
    if (!id) {
      res.status(400).json(fail("id 不能为空", 400));
      return;
    }
    const result = await getWebSongUrl(source, id);
    res.json(ok(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取播放地址失败";
    res.status(500).json(fail(message, 500));
  }
});

webMusicRouter.get("/lyric", async (req, res) => {
  try {
    const source = parseSource(req.query.source);
    const id = String(req.query.id ?? "").trim();
    if (!id) {
      res.status(400).json(fail("id 不能为空", 400));
      return;
    }
    const result = await getWebSongLyric(source, id);
    res.json(ok(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取歌词失败";
    res.status(500).json(fail(message, 500));
  }
});
