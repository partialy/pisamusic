import { getDeviceDb } from "../db/deviceInfoDb";
import {
  announcementExists,
  upsertAnnouncementRead,
  type AnnouncementReadPlatform,
  type AnnouncementReadReceipt,
} from "../db/announcementReadStore";
import type { PublicUser } from "../db/userStore";
import type { DeviceMessageIdentity } from "../middleware/deviceMessageToken";

export class AnnouncementReadValidationError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "AnnouncementReadValidationError";
  }
}

type AndroidDeviceRow = {
  id: string;
  device_name: string;
  brand: string;
  model: string;
  os_version: string;
  sdk_version: number;
  app_version: string;
  app_version_code: number;
  first_seen_at: number;
  last_active_at: number;
};

type DesktopDeviceRow = {
  id: string;
  device_name: string;
  hostname: string;
  os_name: string;
  os_version: string;
  platform: string;
  arch: string;
  app_version: string;
  first_seen_at: number;
  last_active_at: number;
};

function clean(value: string, maxLength: number): string {
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength);
}

function readDeviceSnapshot(identity: DeviceMessageIdentity): Record<string, unknown> {
  const db = getDeviceDb();
  if (identity.kind === "android") {
    const row = db
      .prepare(
        `SELECT id, device_name, brand, model, os_version, sdk_version,
                app_version, app_version_code, first_seen_at, last_active_at
         FROM device_info
         WHERE id = ? AND fingerprint = ?`,
      )
      .get(identity.deviceId, identity.fingerprint) as AndroidDeviceRow | undefined;
    if (!row) throw new AnnouncementReadValidationError("设备身份无效", 401);
    return {
      deviceName: row.device_name,
      brand: row.brand,
      model: row.model,
      osVersion: row.os_version,
      sdkVersion: row.sdk_version,
      appVersion: row.app_version,
      appVersionCode: row.app_version_code,
      firstSeenAt: row.first_seen_at,
      lastActiveAt: row.last_active_at,
    };
  }

  const row = db
    .prepare(
      `SELECT id, device_name, hostname, os_name, os_version, platform, arch,
              app_version, first_seen_at, last_active_at
       FROM desktop_device_info
       WHERE id = ? AND fingerprint = ?`,
    )
    .get(identity.deviceId, identity.fingerprint) as DesktopDeviceRow | undefined;
  if (!row) throw new AnnouncementReadValidationError("设备身份无效", 401);
  return {
    deviceName: row.device_name,
    hostname: row.hostname,
    osName: row.os_name,
    osVersion: row.os_version,
    platform: row.platform,
    arch: row.arch,
    appVersion: row.app_version,
    firstSeenAt: row.first_seen_at,
    lastActiveAt: row.last_active_at,
  };
}

function publicUserSnapshot(user: PublicUser | null): Record<string, unknown> | null {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone ?? null,
    avatarKey: user.avatarKey,
    avatarUrl: user.avatarUrl,
    vip: user.vip,
    vipExpiresAt: user.vipExpiresAt,
    createdAt: user.createdAt,
  };
}

export function recordAnnouncementRead(input: {
  announcementId: string;
  platform: AnnouncementReadPlatform;
  deviceIdentity: DeviceMessageIdentity;
  user: PublicUser | null;
  clientIp: string;
  userAgent: string;
}): AnnouncementReadReceipt {
  if (!announcementExists(input.announcementId)) {
    throw new AnnouncementReadValidationError("公告不存在", 404);
  }
  if (input.deviceIdentity.kind !== input.platform) {
    throw new AnnouncementReadValidationError("设备平台与请求不匹配", 400);
  }

  const deviceSnapshot = readDeviceSnapshot(input.deviceIdentity);
  const userSnapshot = publicUserSnapshot(input.user);
  const readerKey = `${input.user ? `user:${input.user.id}` : "guest"}:${input.platform}:${input.deviceIdentity.deviceId}`;
  const now = Date.now();

  return upsertAnnouncementRead({
    announcementId: input.announcementId,
    readerKey,
    userId: input.user?.id ?? null,
    userSnapshot,
    platform: input.platform,
    deviceId: input.deviceIdentity.deviceId,
    deviceSnapshot,
    clientIp: clean(input.clientIp, 128),
    userAgent: clean(input.userAgent, 512),
    readAt: now,
  });
}
