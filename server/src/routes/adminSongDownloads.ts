import { Router, type Response } from "express";
import {
  getAdminDefaultQuotaLimits,
  getAdminQuotaStates,
  getAdminSongDownloadOverview,
  getAdminSongDownloadRecords,
  getAdminSubjectQuotaDetail,
  getAdminTopDownloadedSongs,
  saveAdminDefaultQuotaLimits,
  saveAdminSubjectQuotaOverride,
} from "../services/songDownloadAdminService";
import { SongDownloadValidationError } from "../services/songDownloadService";
import { fail, ok } from "../types/response";

export const adminSongDownloadsRouter = Router();

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof SongDownloadValidationError) {
    return res.status(error.statusCode).json(fail(error.message, error.statusCode));
  }
  const message = error instanceof Error ? error.message : fallback;
  return res.status(500).json(fail(message, 500));
}

adminSongDownloadsRouter.get("/overview", async (req, res) => {
  try {
    return res.json(ok(await getAdminSongDownloadOverview(req.query.days)));
  } catch (error) {
    return handleError(res, error, "读取下载概览失败");
  }
});

adminSongDownloadsRouter.get("/top-songs", async (req, res) => {
  try {
    return res.json(ok(await getAdminTopDownloadedSongs(req.query as Record<string, unknown>)));
  } catch (error) {
    return handleError(res, error, "读取下载排行失败");
  }
});

adminSongDownloadsRouter.get("/records", async (req, res) => {
  try {
    return res.json(ok(await getAdminSongDownloadRecords(req.query as Record<string, unknown>)));
  } catch (error) {
    return handleError(res, error, "读取下载流水失败");
  }
});

adminSongDownloadsRouter.get("/default-quota", (_req, res) => {
  try {
    return res.json(ok(getAdminDefaultQuotaLimits()));
  } catch (error) {
    return handleError(res, error, "读取默认下载配额失败");
  }
});

adminSongDownloadsRouter.put("/default-quota", async (req, res) => {
  try {
    return res.json(ok(await saveAdminDefaultQuotaLimits(req.body), "默认下载配额已保存"));
  } catch (error) {
    return handleError(res, error, "保存默认下载配额失败");
  }
});

adminSongDownloadsRouter.get("/quotas", async (req, res) => {
  try {
    return res.json(ok(await getAdminQuotaStates(req.query as Record<string, unknown>)));
  } catch (error) {
    return handleError(res, error, "读取配额列表失败");
  }
});

adminSongDownloadsRouter.get("/quotas/:subjectType/:subjectKey", async (req, res) => {
  try {
    return res.json(ok(await getAdminSubjectQuotaDetail(req.params.subjectType, req.params.subjectKey)));
  } catch (error) {
    return handleError(res, error, "读取配额详情失败");
  }
});

adminSongDownloadsRouter.put("/quotas/:subjectType/:subjectKey", async (req, res) => {
  try {
    return res.json(
      ok(await saveAdminSubjectQuotaOverride(req.params.subjectType, req.params.subjectKey, req.body), "下载配额已更新"),
    );
  } catch (error) {
    return handleError(res, error, "更新下载配额失败");
  }
});
