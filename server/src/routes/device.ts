import type { Request, Response } from "express";
import { Router } from "express";
import { getDeviceDb } from "../db/deviceInfoDb";
import {
  DeviceReportValidationError,
  androidDeviceFingerprint,
  reportAndroidDevice,
  reportDesktopDevice,
  resolveClientIp,
} from "../services/deviceReportService";
import { fail, ok } from "../types/response";

export const deviceRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const clientIp = resolveClientIp;

export const deviceFingerprint = androidDeviceFingerprint;

deviceRouter.post("/desktop/report", async (req: Request, res: Response) => {
  try {
    const result = await reportDesktopDevice(req.body, resolveClientIp(req));
    res.json(ok(result));
  } catch (e) {
    if (e instanceof DeviceReportValidationError) {
      res.status(400).json(fail(e.message, 400));
      return;
    }
    const msg = e instanceof Error ? e.message : "上报失败";
    res.status(500).json(fail(msg, 500));
  }
});

deviceRouter.get("/desktop/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) {
    res.status(404).json(fail("Not Found", 404));
    return;
  }
  try {
    const db = getDeviceDb();
    type GetRow = {
      id: string;
      locked: number;
      lock_end_time: number | null;
      last_active_at: number;
      first_seen_at: number;
      platform: string;
      arch: string;
      app_version: string;
    };
    const row = (await db.queryOne(`SELECT id, locked, lock_end_time, last_active_at, first_seen_at, platform, arch, app_version
         FROM desktop_device_info WHERE id = ?`, [id])) as GetRow | undefined;
    if (!row) {
      res.status(404).json(fail("Not Found", 404));
      return;
    }
    res.json(
      ok({
        id: row.id,
        locked: row.locked !== 0,
        lockEndTime: row.lock_end_time,
        lastActiveAt: row.last_active_at,
        firstSeenAt: row.first_seen_at,
        platform: row.platform,
        arch: row.arch,
        appVersion: row.app_version,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "查询失败";
    res.status(500).json(fail(msg, 500));
  }
});

deviceRouter.post("/report", async (req: Request, res: Response) => {
  try {
    const result = await reportAndroidDevice(req.body, resolveClientIp(req));
    res.json(ok(result));
  } catch (e) {
    if (e instanceof DeviceReportValidationError) {
      res.status(400).json(fail(e.message, 400));
      return;
    }
    const msg = e instanceof Error ? e.message : "上报失败";
    res.status(500).json(fail(msg, 500));
  }
});

deviceRouter.get("/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) {
    res.status(404).json(fail("Not Found", 404));
    return;
  }
  try {
    const db = getDeviceDb();
    type GetRow = {
      id: string;
      locked: number;
      lock_end_time: number | null;
      last_active_at: number;
      first_seen_at: number;
      brand: string;
      model: string;
      app_version: string;
    };
    const row = (await db.queryOne(`SELECT id, locked, lock_end_time, last_active_at, first_seen_at, brand, model, app_version
         FROM device_info WHERE id = ?`, [id])) as GetRow | undefined;
    if (!row) {
      res.status(404).json(fail("Not Found", 404));
      return;
    }
    res.json(
      ok({
        id: row.id,
        locked: row.locked !== 0,
        lockEndTime: row.lock_end_time,
        lastActiveAt: row.last_active_at,
        firstSeenAt: row.first_seen_at,
        brand: row.brand,
        model: row.model,
        appVersion: row.app_version,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "查询失败";
    res.status(500).json(fail(msg, 500));
  }
});
