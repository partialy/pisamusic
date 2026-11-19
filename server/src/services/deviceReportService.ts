import { createHash, randomUUID } from "node:crypto";
import type { Request } from "express";
import { recordDeviceDailyActivity } from "../db/analyticsStore";
import { getDeviceDb } from "../db/deviceInfoDb";
import { issueDeviceMessageToken } from "../middleware/deviceMessageToken";

const MAX_LEN = 512;

export class DeviceReportValidationError extends Error {}

export type AndroidDeviceReportResult = {
  id: string;
  messageToken: string;
  locked: boolean;
  lockEndTime: number | null;
  lastActiveAt: number;
  firstSeenAt: number;
};

function clip(s: string, max = MAX_LEN): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max);
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

export function resolveClientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    const first = xf.split(",")[0]?.trim();
    if (first) return clip(first, 128);
  }
  const rip = typeof req.ip === "string" && req.ip.length > 0 ? req.ip : req.socket?.remoteAddress;
  return clip(String(rip ?? ""), 128);
}

export function androidDeviceFingerprint(androidId: string, model: string): string {
  return createHash("sha256")
    .update(`${androidId.trim()}\0${model.trim()}`, "utf8")
    .digest("hex");
}

/**
 * Android 设备上报核心逻辑：校验、入库更新、记录日活并签发 30 天设备消息令牌。
 */
export async function reportAndroidDevice(
  rawBody: unknown,
  ip: string,
): Promise<AndroidDeviceReportResult> {
  const body = asRecord(rawBody);
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
    throw new DeviceReportValidationError("缺少必填字段");
  }
  if (!Number.isFinite(sdkVersion) || !Number.isFinite(appVersionCode)) {
    throw new DeviceReportValidationError("sdkVersion / appVersionCode 无效");
  }

  const extrasIn = asRecord(body.extras);
  const extraPatch: Record<string, unknown> = { ...extrasIn };
  if (certModel) extraPatch.certModel = certModel;

  const fp = androidDeviceFingerprint(androidId, model);
  const now = Date.now();
  const db = getDeviceDb();

  type ExistingRow = {
    id: string;
    extra_info: string;
    locked: number;
    lock_end_time: number | null;
  };
  const existing = (await db.queryOne(
    `SELECT id, extra_info, locked, lock_end_time FROM device_info WHERE fingerprint = ?`,
    [fp],
  )) as ExistingRow | undefined;

  const mergedExtra = mergeExtraJson(existing?.extra_info ?? "{}", extraPatch);
  const sdkT = Math.trunc(sdkVersion);
  const appVcT = Math.trunc(appVersionCode);
  const cc = countryCode || null;
  const tz = timezone || null;
  const loc = locale || null;

  if (existing) {
    await db.execute(
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
      [deviceName, brand, model, osVersion, sdkT, appVersion, appVcT, now, ip, cc, tz, loc, mergedExtra, fp],
    );
  } else {
    const id = randomUUID();
    await db.execute(
      `INSERT INTO device_info (
          id, fingerprint, device_name, brand, model, os_version, sdk_version,
          app_version, app_version_code, locked, lock_end_time,
          first_seen_at, last_active_at, first_seen_ip, last_seen_ip,
          last_country_code, last_timezone, last_locale, extra_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, fp, deviceName, brand, model, osVersion, sdkT, appVersion, appVcT, now, now, ip, ip, cc, tz, loc, mergedExtra],
    );
  }

  type OutRow = {
    id: string;
    locked: number;
    lock_end_time: number | null;
    last_active_at: number;
    first_seen_at: number;
  };
  const out = (await db.queryOne(
    `SELECT id, locked, lock_end_time, last_active_at, first_seen_at FROM device_info WHERE fingerprint = ?`,
    [fp],
  )) as OutRow | undefined;

  if (!out) {
    throw new Error("写入后读取失败");
  }

  try {
    await recordDeviceDailyActivity({
      deviceType: "android",
      deviceId: out.id,
      appVersion,
      occurredAt: now,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[analytics] recordDeviceDailyActivity (android) failed:", err);
  }

  return {
    id: out.id,
    messageToken: issueDeviceMessageToken({ kind: "android", deviceId: out.id, fingerprint: fp }),
    locked: out.locked !== 0,
    lockEndTime: out.lock_end_time,
    lastActiveAt: out.last_active_at,
    firstSeenAt: out.first_seen_at,
  };
}
