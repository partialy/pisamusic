import { createHash, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import { getDeviceDb } from "../db/deviceInfoDb";
import { fail, ok } from "../types/response";

export const deviceRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_LEN = 512;

function clip(s: string, max = MAX_LEN): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max);
}

export function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    const first = xf.split(",")[0]?.trim();
    if (first) return clip(first, 128);
  }
  const rip = typeof req.ip === "string" && req.ip.length > 0 ? req.ip : req.socket?.remoteAddress;
  return clip(String(rip ?? ""), 128);
}

export function deviceFingerprint(androidId: string, model: string): string {
  return createHash("sha256")
    .update(`${androidId.trim()}\0${model.trim()}`, "utf8")
    .digest("hex");
}

function desktopDeviceFingerprint(clientId: string, hostname: string, platform: string, arch: string): string {
  return createHash("sha256")
    .update(`${clientId.trim()}\0${hostname.trim()}\0${platform.trim()}\0${arch.trim()}`, "utf8")
    .digest("hex");
}

function mergeExtraJson(existingStr: string, patch: Record<string, unknown>): string {
  let base: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(existingStr) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      base = parsed as Record<string, unknown>;
    }
  } catch {
    base = {};
  }
  return JSON.stringify({ ...base, ...patch });
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

deviceRouter.post("/desktop/report", (req: Request, res: Response) => {
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
    const existing = db
      .prepare(`SELECT id, locked, lock_end_time FROM desktop_device_info WHERE fingerprint = ?`)
      .get(fp) as ExistingRow | undefined;

    if (existing) {
      db.prepare(
        `UPDATE desktop_device_info SET
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
        WHERE fingerprint = ?`,
      ).run(
        deviceName,
        hostname,
        osName,
        osVersion,
        platform,
        arch,
        appVersion,
        now,
        ip,
        extras,
        fp,
      );
    } else {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO desktop_device_info (
          id, fingerprint, device_name, hostname, os_name, os_version, platform,
          arch, app_version, locked, lock_end_time, first_seen_at, last_active_at,
          first_seen_ip, last_seen_ip, extra_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        fp,
        deviceName,
        hostname,
        osName,
        osVersion,
        platform,
        arch,
        appVersion,
        now,
        now,
        ip,
        ip,
        extras,
      );
    }

    type OutRow = {
      id: string;
      locked: number;
      lock_end_time: number | null;
      last_active_at: number;
      first_seen_at: number;
    };
    const out = db
      .prepare(
        `SELECT id, locked, lock_end_time, last_active_at, first_seen_at FROM desktop_device_info WHERE fingerprint = ?`,
      )
      .get(fp) as OutRow | undefined;

    if (!out) {
      res.status(500).json(fail("写入后读取失败", 500));
      return;
    }

    res.json(
      ok({
        id: out.id,
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

deviceRouter.get("/desktop/:id", (req: Request, res: Response) => {
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
    const row = db
      .prepare(
        `SELECT id, locked, lock_end_time, last_active_at, first_seen_at, platform, arch, app_version
         FROM desktop_device_info WHERE id = ?`,
      )
      .get(id) as GetRow | undefined;
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

deviceRouter.post("/report", (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const androidId = clip(String(body.androidId ?? ""), 256);
    const deviceName = clip(String(body.deviceName ?? ""));
    const brand = clip(String(body.brand ?? ""));
    const model = clip(String(body.model ?? ""));
    const osVersion = clip(String(body.osVersion ?? ""));
    const sdkVersion = Number(body.sdkVersion);
    const appVersion = clip(String(body.appVersion ?? ""));
    const appVersionCode = Number(body.appVersionCode);
    const certModel = body.certModel != null ? clip(String(body.certModel), 128) : "";
    const countryCode = body.countryCode != null ? clip(String(body.countryCode), 32) : "";
    const timezone = body.timezone != null ? clip(String(body.timezone), 128) : "";
    const locale = body.locale != null ? clip(String(body.locale), 64) : "";

    if (!androidId || !deviceName || !brand || !model || !osVersion) {
      res.status(400).json(fail("缺少必填字段", 400));
      return;
    }
    if (!Number.isFinite(sdkVersion) || !Number.isFinite(appVersionCode)) {
      res.status(400).json(fail("sdkVersion / appVersionCode 无效", 400));
      return;
    }

    const extrasIn = asRecord(body.extras);
    const extraPatch: Record<string, unknown> = { ...extrasIn };
    if (certModel) extraPatch.certModel = certModel;

    const fp = deviceFingerprint(androidId, model);
    const now = Date.now();
    const ip = clientIp(req);
    const db = getDeviceDb();

    type ExistingRow = {
      id: string;
      extra_info: string;
      locked: number;
      lock_end_time: number | null;
    };
    const existing = db
      .prepare(`SELECT id, extra_info, locked, lock_end_time FROM device_info WHERE fingerprint = ?`)
      .get(fp) as ExistingRow | undefined;

    const mergedExtra = mergeExtraJson(existing?.extra_info ?? "{}", extraPatch);
    const sdkT = Math.trunc(sdkVersion);
    const appVcT = Math.trunc(appVersionCode);
    const cc = countryCode || null;
    const tz = timezone || null;
    const loc = locale || null;

    if (existing) {
      db.prepare(
        `UPDATE device_info SET
          device_name = ?,
          brand = ?,
          model = ?,
          os_version = ?,
          sdk_version = ?,
          app_version = ?,
          app_version_code = ?,
          last_active_at = ?,
          last_seen_ip = ?,
          last_country_code = ?,
          last_timezone = ?,
          last_locale = ?,
          extra_info = ?
        WHERE fingerprint = ?`,
      ).run(
        deviceName,
        brand,
        model,
        osVersion,
        sdkT,
        appVersion,
        appVcT,
        now,
        ip,
        cc,
        tz,
        loc,
        mergedExtra,
        fp,
      );
    } else {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO device_info (
          id, fingerprint, device_name, brand, model, os_version, sdk_version,
          app_version, app_version_code, locked, lock_end_time,
          first_seen_at, last_active_at, first_seen_ip, last_seen_ip,
          last_country_code, last_timezone, last_locale, extra_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        fp,
        deviceName,
        brand,
        model,
        osVersion,
        sdkT,
        appVersion,
        appVcT,
        now,
        now,
        ip,
        ip,
        cc,
        tz,
        loc,
        mergedExtra,
      );
    }

    type OutRow = {
      id: string;
      locked: number;
      lock_end_time: number | null;
      last_active_at: number;
      first_seen_at: number;
    };
    const out = db
      .prepare(
        `SELECT id, locked, lock_end_time, last_active_at, first_seen_at FROM device_info WHERE fingerprint = ?`,
      )
      .get(fp) as OutRow | undefined;

    if (!out) {
      res.status(500).json(fail("写入后读取失败", 500));
      return;
    }

    res.json(
      ok({
        id: out.id,
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

deviceRouter.get("/:id", (req: Request, res: Response) => {
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
    const row = db
      .prepare(
        `SELECT id, locked, lock_end_time, last_active_at, first_seen_at, brand, model, app_version
         FROM device_info WHERE id = ?`,
      )
      .get(id) as GetRow | undefined;
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
