import { Router } from "express";
import {
  AppShareTrackingError,
  managedTrackingList,
  managedTrackingDetail,
  invalidateManagedTracking,
  exportManagedTracking,
} from "../services/appShareTrackingService";
import { fail, ok } from "../types/response";
export const adminAppShareRecordsRouter = Router();
adminAppShareRecordsRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
function errorResponse(error: unknown, res: import("express").Response) {
  const status = error instanceof AppShareTrackingError ? error.status : 500;
  if (status === 500) console.warn("[app-share] admin failed", error);
  return res
    .status(status)
    .json(
      fail(
        status === 500 ? "分享记录操作失败" : (error as Error).message,
        status,
      ),
    );
}
adminAppShareRecordsRouter.get("/", (req, res) => {
  try {
    return res.json(ok(managedTrackingList(req.query)));
  } catch (error) {
    return errorResponse(error, res);
  }
});
adminAppShareRecordsRouter.get("/export", (req, res) => {
  try {
    return res.json(ok(exportManagedTracking(req.query)));
  } catch (error) {
    return errorResponse(error, res);
  }
});
adminAppShareRecordsRouter.get("/:id", (req, res) => {
  try {
    return res.json(
      ok(managedTrackingDetail(String(req.params.id), req.query)),
    );
  } catch (error) {
    return errorResponse(error, res);
  }
});
adminAppShareRecordsRouter.patch("/:id/invalid", (req, res) => {
  try {
    return res.json(ok(invalidateManagedTracking(String(req.params.id))));
  } catch (error) {
    return errorResponse(error, res);
  }
});
