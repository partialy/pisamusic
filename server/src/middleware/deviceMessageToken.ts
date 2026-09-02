import type { Request } from "express";
import jwt from "jsonwebtoken";
import { getDeviceDb } from "../db/deviceInfoDb";

export type DeviceMessageKind = "android" | "desktop";

export type DeviceMessageIdentity = {
  kind: DeviceMessageKind;
  deviceId: string;
  fingerprint: string;
};

type DeviceMessageJwtPayload = jwt.JwtPayload & {
  purpose: "direct-message-device";
  kind: DeviceMessageKind;
  deviceId: string;
  fingerprint: string;
};

export function getDeviceMessageJwtSecret(): string {
  const configured = String(process.env.DEVICE_MESSAGE_JWT_SECRET ?? "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("生产环境必须配置 DEVICE_MESSAGE_JWT_SECRET");
  }
  return String(process.env.USER_JWT_SECRET ?? "").trim()
    || "pisa-device-message-dev-secret-change-in-production";
}

if (process.env.NODE_ENV === "production") {
  getDeviceMessageJwtSecret();
}

export function issueDeviceMessageToken(identity: DeviceMessageIdentity): string {
  return jwt.sign(
    {
      purpose: "direct-message-device",
      kind: identity.kind,
      deviceId: identity.deviceId,
      fingerprint: identity.fingerprint,
    },
    getDeviceMessageJwtSecret(),
    { expiresIn: "30d" },
  );
}

function isDeviceMessagePayload(value: unknown): value is DeviceMessageJwtPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<DeviceMessageJwtPayload>;
  return payload.purpose === "direct-message-device"
    && (payload.kind === "android" || payload.kind === "desktop")
    && typeof payload.deviceId === "string"
    && payload.deviceId.length > 0
    && typeof payload.fingerprint === "string"
    && payload.fingerprint.length > 0;
}

function isCurrentDeviceIdentity(identity: DeviceMessageIdentity): boolean {
  const table = identity.kind === "android" ? "device_info" : "desktop_device_info";
  const row = getDeviceDb()
    .prepare(`SELECT 1 FROM ${table} WHERE id = ? AND fingerprint = ?`)
    .get(identity.deviceId, identity.fingerprint) as { 1: number } | undefined;
  return Boolean(row);
}

export function verifyDeviceMessageToken(rawToken: string): DeviceMessageIdentity | null {
  if (!rawToken) return null;
  try {
    const payload = jwt.verify(rawToken, getDeviceMessageJwtSecret());
    if (!isDeviceMessagePayload(payload)) return null;
    const identity: DeviceMessageIdentity = {
      kind: payload.kind,
      deviceId: payload.deviceId,
      fingerprint: payload.fingerprint,
    };
    return isCurrentDeviceIdentity(identity) ? identity : null;
  } catch {
    return null;
  }
}

export function deviceMessageIdentityFromRequest(req: Request): DeviceMessageIdentity | null {
  const rawToken = req.header("x-pm-device-token");
  return rawToken ? verifyDeviceMessageToken(rawToken.trim()) : null;
}
