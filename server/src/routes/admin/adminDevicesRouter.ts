import { Router } from "express";
import { getDeviceDb } from "../../db/deviceInfoDb";
import { deleteSubjectQuotaState } from "../../db/songDownloadStore";
import { fail, ok } from "../../types/response";

export const adminDevicesRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DeviceInfoRow = {
  id: string;
  fingerprint: string;
  device_name: string;
  brand: string;
  model: string;
  os_version: string;
  sdk_version: number;
  app_version: string;
  app_version_code: number;
  locked: number;
  lock_end_time: number | null;
  first_seen_at: number;
  last_active_at: number;
  first_seen_ip: string | null;
  last_seen_ip: string | null;
  last_country_code: string | null;
  last_timezone: string | null;
  last_locale: string | null;
  extra_info: string;
};

function mapDeviceRow(row: DeviceInfoRow) {
  let extraInfo: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.extra_info) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) extraInfo = parsed as Record<string, unknown>;
  } catch {
    extraInfo = {};
  }
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    deviceName: row.device_name,
    brand: row.brand,
    model: row.model,
    osVersion: row.os_version,
    sdkVersion: row.sdk_version,
    appVersion: row.app_version,
    appVersionCode: row.app_version_code,
    locked: row.locked !== 0,
    lockEndTime: row.lock_end_time,
    firstSeenAt: row.first_seen_at,
    lastActiveAt: row.last_active_at,
    firstSeenIp: row.first_seen_ip,
    lastSeenIp: row.last_seen_ip,
    lastCountryCode: row.last_country_code,
    lastTimezone: row.last_timezone,
    lastLocale: row.last_locale,
    extraInfo,
  };
}

type DesktopDeviceInfoRow = {
  id: string;
  fingerprint: string;
  device_name: string;
  hostname: string;
  os_name: string;
  os_version: string;
  platform: string;
  arch: string;
  app_version: string;
  locked: number;
  lock_end_time: number | null;
  first_seen_at: number;
  last_active_at: number;
  first_seen_ip: string | null;
  last_seen_ip: string | null;
  extra_info: string;
};

function mapDesktopDeviceRow(row: DesktopDeviceInfoRow) {
  let extraInfo: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.extra_info) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) extraInfo = parsed as Record<string, unknown>;
  } catch {
    extraInfo = {};
  }
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    deviceName: row.device_name,
    hostname: row.hostname,
    osName: row.os_name,
    osVersion: row.os_version,
    platform: row.platform,
    arch: row.arch,
    appVersion: row.app_version,
    locked: row.locked !== 0,
    lockEndTime: row.lock_end_time,
    firstSeenAt: row.first_seen_at,
    lastActiveAt: row.last_active_at,
    firstSeenIp: row.first_seen_ip,
    lastSeenIp: row.last_seen_ip,
    extraInfo,
  };
}

// Android Devices
adminDevicesRouter.get("/device/list", async (req, res) => {
  try {
    const db = getDeviceDb();
    const search = String(req.query.search ?? "").trim();
    const lockedParam = req.query.locked;
    const brand = String(req.query.brand ?? "").trim();
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];
    if (search) {
      whereClauses.push("(brand LIKE ? OR model LIKE ? OR device_name LIKE ? OR id LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (lockedParam === "true" || lockedParam === "1") whereClauses.push("locked = 1");
    else if (lockedParam === "false" || lockedParam === "0") whereClauses.push("locked = 0");
    if (brand) {
      whereClauses.push("brand LIKE ?");
      params.push(`%${brand}%`);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const countRow = (await db.queryOne(`SELECT COUNT(*) as total FROM device_info ${where}`, [...params])) as {
      total: number;
    };
    const rows = (await db.query(
      `SELECT * FROM device_info ${where} ORDER BY last_active_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )) as DeviceInfoRow[];

    return res.json(ok({ devices: rows.map(mapDeviceRow), total: countRow.total, offset, limit }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "查询设备列表失败";
    return res.status(500).json(fail(msg, 500));
  }
});

adminDevicesRouter.get("/device/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid device ID", 400));
  try {
    const db = getDeviceDb();
    const row = (await db.queryOne("SELECT * FROM device_info WHERE id = ?", [id])) as DeviceInfoRow | undefined;
    if (!row) return res.status(404).json(fail("Device not found", 404));
    return res.json(ok(mapDeviceRow(row)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "查询设备详情失败";
    return res.status(500).json(fail(msg, 500));
  }
});

adminDevicesRouter.post("/device/:id/lock", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid device ID", 400));
  try {
    const body = req.body as Record<string, unknown>;
    const locked = Boolean(body.locked);
    const lockEndTime = body.lockEndTime != null ? Number(body.lockEndTime) : null;
    if (lockEndTime !== null && !Number.isFinite(lockEndTime)) {
      return res.status(400).json(fail("lockEndTime must be a valid timestamp or null", 400));
    }

    const db = getDeviceDb();
    const existing = (await db.queryOne("SELECT id FROM device_info WHERE id = ?", [id])) as { id: string } | undefined;
    if (!existing) return res.status(404).json(fail("Device not found", 404));

    await db.execute("UPDATE device_info SET locked = ?, lock_end_time = ? WHERE id = ?", [
      locked ? 1 : 0,
      lockEndTime,
      id,
    ]);
    const updated = (await db.queryOne("SELECT * FROM device_info WHERE id = ?", [id])) as DeviceInfoRow;
    return res.json(ok(mapDeviceRow(updated)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "操作失败";
    return res.status(500).json(fail(msg, 500));
  }
});

adminDevicesRouter.delete("/device/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid device ID", 400));
  try {
    const db = getDeviceDb();
    const existing = (await db.queryOne("SELECT id FROM device_info WHERE id = ?", [id])) as { id: string } | undefined;
    if (!existing) return res.status(404).json(fail("Device not found", 404));
    await db.transaction(async (tx) => {
      await deleteSubjectQuotaState(tx, "device", `android:${id}`);
      await tx.execute("DELETE FROM device_info WHERE id = ?", [id]);
    });
    return res.json(ok(null, "设备已删除"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "删除设备失败";
    return res.status(500).json(fail(msg, 500));
  }
});

// Desktop Devices
adminDevicesRouter.get("/desktop-device/list", async (req, res) => {
  try {
    const db = getDeviceDb();
    const search = String(req.query.search ?? "").trim();
    const lockedParam = req.query.locked;
    const platform = String(req.query.platform ?? "").trim();
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];
    if (search) {
      whereClauses.push("(device_name LIKE ? OR hostname LIKE ? OR os_name LIKE ? OR id LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (lockedParam === "true" || lockedParam === "1") whereClauses.push("locked = 1");
    else if (lockedParam === "false" || lockedParam === "0") whereClauses.push("locked = 0");
    if (platform) {
      whereClauses.push("platform LIKE ?");
      params.push(`%${platform}%`);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const countRow = (await db.queryOne(`SELECT COUNT(*) as total FROM desktop_device_info ${where}`, [
      ...params,
    ])) as { total: number };
    const rows = (await db.query(
      `SELECT * FROM desktop_device_info ${where} ORDER BY last_active_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )) as DesktopDeviceInfoRow[];

    return res.json(ok({ devices: rows.map(mapDesktopDeviceRow), total: countRow.total, offset, limit }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "查询桌面设备列表失败";
    return res.status(500).json(fail(msg, 500));
  }
});

adminDevicesRouter.get("/desktop-device/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid device ID", 400));
  try {
    const db = getDeviceDb();
    const row = (await db.queryOne("SELECT * FROM desktop_device_info WHERE id = ?", [id])) as
      | DesktopDeviceInfoRow
      | undefined;
    if (!row) return res.status(404).json(fail("Device not found", 404));
    return res.json(ok(mapDesktopDeviceRow(row)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "查询桌面设备详情失败";
    return res.status(500).json(fail(msg, 500));
  }
});

adminDevicesRouter.post("/desktop-device/:id/lock", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid device ID", 400));
  try {
    const body = req.body as Record<string, unknown>;
    const locked = Boolean(body.locked);
    const lockEndTime = body.lockEndTime != null ? Number(body.lockEndTime) : null;
    if (lockEndTime !== null && !Number.isFinite(lockEndTime)) {
      return res.status(400).json(fail("lockEndTime must be a valid timestamp or null", 400));
    }

    const db = getDeviceDb();
    const existing = (await db.queryOne("SELECT id FROM desktop_device_info WHERE id = ?", [id])) as
      | { id: string }
      | undefined;
    if (!existing) return res.status(404).json(fail("Device not found", 404));

    await db.execute("UPDATE desktop_device_info SET locked = ?, lock_end_time = ? WHERE id = ?", [
      locked ? 1 : 0,
      lockEndTime,
      id,
    ]);
    const updated = (await db.queryOne("SELECT * FROM desktop_device_info WHERE id = ?", [id])) as DesktopDeviceInfoRow;
    return res.json(ok(mapDesktopDeviceRow(updated)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "操作失败";
    return res.status(500).json(fail(msg, 500));
  }
});

adminDevicesRouter.delete("/desktop-device/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!UUID_RE.test(id)) return res.status(400).json(fail("Invalid device ID", 400));
  try {
    const db = getDeviceDb();
    const existing = (await db.queryOne("SELECT id FROM desktop_device_info WHERE id = ?", [id])) as
      | { id: string }
      | undefined;
    if (!existing) return res.status(404).json(fail("Device not found", 404));
    await db.transaction(async (tx) => {
      await deleteSubjectQuotaState(tx, "device", `desktop:${id}`);
      await tx.execute("DELETE FROM desktop_device_info WHERE id = ?", [id]);
    });
    return res.json(ok(null, "桌面设备已删除"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "删除桌面设备失败";
    return res.status(500).json(fail(msg, 500));
  }
});
