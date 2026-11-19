import { createHash, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import { recordDeviceDailyActivity } from "../db/analyticsStore";
import { getDeviceDb } from "../db/deviceInfoDb";
import { issueDeviceMessageToken } from "../middleware/deviceMessageToken";
import {
  DeviceReportValidationError,
  androidDeviceFingerprint,
  reportAndroidDevice,
  resolveClientIp,
} from "../services/deviceReportService";
import { fail, ok } from "../types/response";

export const deviceRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_LEN = 512;

function clip(s: string, max = MAX_LEN): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max);
}

export const clientIp = resolveClientIp;

export const deviceFingerprint = androidDeviceFingerprint;

function desktopDeviceFingerprint(clientId: string, hostname: string, platform: string, arch: string): string {
  return createHash("sha256")
    .update(`${clientId.trim()}\0${hostname.trim()}\0${platform.trim()}\0${arch.trim()}`, "utf8")
    .digest("hex");
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

deviceRouter.post("/desktop/report", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const clientId = clip(String(body.clientId ?? ""), 256);
    const deviceName = clip(String(body.deviceName ?? ""));
    const hostname = clip(String(body.hostname ?? ""));
    const osName = clip(String(body.osName ?? ""));
    const osVersion = clip(String(body.osVersion ?? ""));
    const platform = clip(String(body.platform ?? ""), 64);
    const arch = clip(String(body.arch ?? ""), 64);
    const appVersion = clip(String(body.appVersion ?? ""), 128);

    if (!clientId || !deviceName || !hostname || !osName || !osVersion || !platform || !arch || !appVersion) {
      res.status(400).json(fail("缺少必填字段", 400));
      return;
    }

    const fp = desktopDeviceFingerprint(clientId, hostname, platform, arch);
    const now = Date.now();
    const ip = clientIp(req);
    const db = getDeviceDb();
    const extras = JSON.stringify(asRecord(body.extras));

    type ExistingRow = {
      id: string;
      locked: number;
      lock_end_time: number | null;
    };
    const existing = (await db.queryOne(`SELECT id, locked, lock_end_time FROM desktop_device_info WHERE fingerprint = ?`, [fp])) as ExistingRow | undefined;

    if (existing) {
      (await db.execute(`UPDATE desktop_device_info SET
          device_name = ?,
          hostname = ?,
          os_name = ?,
          os_version = ?,
          platform = ?,
          arch = ?,
          app_version = ?,
          last_active_at = ?,
          last_seen_ip = ?,
          extra_info = ?
        WHERE fingerprint = ?`, [deviceName, hostname, osName, osVersion, platform, arch, appVersion, now, ip, extras, fp]));
    } else {
      const id = randomUUID();
      (await db.execute(`INSERT INTO desktop_device_info (
          id, fingerprint, device_name, hostname, os_name, os_version, platform,
          arch, app_version, locked, lock_end_time, first_seen_at, last_active_at,
          first_seen_ip, last_seen_ip, extra_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?)`, [id, fp, deviceName, hostname, osName, osVersion, platform, arch, appVersion, now, now, ip, ip, extras]));
    }

    type OutRow = {
      id: string;
      locked: number;
      lock_end_time: number | null;
      last_active_at: number;
      first_seen_at: number;
    };
    const out = (await db.queryOne(`SELECT id, locked, lock_end_time, last_active_at, first_seen_at FROM desktop_device_info WHERE fingerprint = ?`, [fp])) as OutRow | undefined;

    if (!out) {
      res.status(500).json(fail("写入后读取失败", 500));
      return;
    }

    try {
      (await recordDeviceDailyActivity({
        deviceType: "desktop",
        deviceId: out.id,
        appVersion,
        occurredAt: now,
      }));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[analytics] recordDeviceDailyActivity (desktop) failed:", err);
    }

    res.json(
      ok({
        id: out.id,
        messageToken: issueDeviceMessageToken({ kind: "desktop", deviceId: out.id, fingerprint: fp }),
        locked: out.locked !== 0,
        lockEndTime: out.lock_end_time,
        lastActiveAt: out.last_active_at,
        firstSeenAt: out.first_seen_at,
      }),
    );
  } catch (e) {
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
