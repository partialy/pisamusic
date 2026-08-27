import { Router } from "express";
import {
  getPublicLyricsUrl,
  getPublicPlayUrl,
  getPublicTrackDetail,
  searchPublicTracks,
} from "../services/cloudMusicService";
import { fail, ok } from "../types/response";

export const cloudMusicRouter = Router();

cloudMusicRouter.get("/search", (req, res) => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : undefined;
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "30"), 10) || 30));

    const result = searchPublicTracks({
      keyword,
      offset,
      limit,
    });
    res.json(ok(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "搜索网盘音乐失败";
    res.status(500).json(fail(message, 500));
  }
});

cloudMusicRouter.get("/tracks/:uuid", (req, res) => {
  try {
    const { uuid } = req.params;
    const track = getPublicTrackDetail(uuid);
    if (!track) {
      res.status(404).json(fail("曲目不存在", 404));
      return;
    }
    res.json(ok(track));
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取曲目详情失败";
    res.status(500).json(fail(message, 500));
  }
});

cloudMusicRouter.get("/tracks/:uuid/play-url", (req, res) => {
  try {
    const { uuid } = req.params;
    const playInfo = getPublicPlayUrl(uuid);
    res.json(ok(playInfo));
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
    const message = error instanceof Error ? error.message : "获取播放地址失败";
    res.status(statusCode).json(fail(message, statusCode));
  }
});

cloudMusicRouter.get("/tracks/:uuid/lyrics-url", (req, res) => {
  try {
    const { uuid } = req.params;
    const lyricsInfo = getPublicLyricsUrl(uuid);
    res.json(ok(lyricsInfo));
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
    const message = error instanceof Error ? error.message : "获取歌词地址失败";
    res.status(statusCode).json(fail(message, statusCode));
  }
});
